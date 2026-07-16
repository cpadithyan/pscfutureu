#!/usr/bin/env node
// ============================================================================
// generate-blog-pages.mjs
//
// WHY THIS EXISTS
// ----------------
// Your blog posts live in Firestore and are rendered by client-side JS. That
// works fine for real visitors, but Google's crawler may not wait for the
// JS/Firestore round-trip to finish, so it can index those pages as empty.
// This script fixes that by producing a real, static .html file per post —
// full title, description, and content already baked in, no JS required to
// see it. It also regenerates sitemap.xml so Google knows every post exists.
//
// THIS NOW RUNS AUTOMATICALLY ON EVERY DEPLOY
// --------------------------------------------
// vercel.json's "buildCommand" runs `npm run build`, which runs this script,
// on every single deploy — including ones triggered just by editing a post
// in the admin panel and clicking "Redeploy" in Vercel (or if you've got
// Vercel connected to auto-deploy from git, on every push). You don't need
// to do anything manually anymore.
//
// It creates/updates, at the project root:
//   blog/index.html            (a static list of all posts)
//   blog/<slug>/index.html     (one real page per post)
//   sitemap.xml                (updated with every post URL)
// On Vercel, static files always win over the vercel.json rewrite rule, so
// /blog/<slug> serves this static page directly — no extra config needed.
//
// RUNNING IT MANUALLY (optional)
// -------------------------------
// If you ever want to preview the output locally before deploying:
//   1. Requires Node.js 18+ (for built-in fetch). Check with: node -v
//   2. From the project root, run:  node generate-blog-pages.mjs
// ============================================================================

const SITE_URL = "https://pscfutureu.com";
const SITE_NAME = "PSC FutureU";
const PROJECT_ID = "pscfutureu"; // from firebaseConfig.projectId in index.html

const STATIC_ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/videos", changefreq: "weekly", priority: "0.8" },
  { path: "/pdfs", changefreq: "weekly", priority: "0.8" },
  { path: "/quizzes", changefreq: "weekly", priority: "0.8" },
  { path: "/mocks", changefreq: "weekly", priority: "0.8" },
  { path: "/syllabus", changefreq: "weekly", priority: "0.6" },
  { path: "/blog", changefreq: "weekly", priority: "0.7" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
];

import fs from "node:fs/promises";
import path from "node:path";

function escapeHTML(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Mirrors inlineMarkdown() + paragraphsToHTML() in index.html — keep both in
// sync if you ever change the supported syntax. Content is plain text with a
// small safe markdown-lite subset (never raw HTML), so this can never inject
// a script tag even though it's admin-authored.
function inlineMarkdown(escapedText) {
  return escapedText
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" style="max-width:100%;border-radius:10px;margin:10px 0;display:block;">')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--primary-dark);font-weight:600;">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
}
function paragraphsToHTML(text) {
  return (text || "")
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const isList = lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l));
      if (isList) {
        const items = lines.map((l) => `<li>${inlineMarkdown(escapeHTML(l.replace(/^[-*]\s+/, "")))}</li>`).join("");
        return `<ul style="margin:0 0 14px; padding-left:22px; line-height:1.75;">${items}</ul>`;
      }
      return `<p style="margin-bottom:14px; line-height:1.75;">${inlineMarkdown(escapeHTML(block.trim())).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

function slugify(s) {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

// ---- Firestore REST API (no SDK / no auth needed — blogPosts is public-read) ----
function parseFirestoreValue(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return parseFirestoreFields(v.mapValue.fields || {});
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(parseFirestoreValue);
  return null;
}
function parseFirestoreFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = parseFirestoreValue(v);
  return out;
}

async function fetchAllBlogPosts() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/blogPosts?pageSize=300`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore fetch failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const docs = data.documents || [];
  const posts = docs.map((doc) => {
    const id = doc.name.split("/").pop();
    const fields = parseFirestoreFields(doc.fields);
    return { id, ...fields, slug: fields.slug || slugify(fields.title) };
  });
  posts.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  return posts;
}

// ---- Page templates (kept lightweight — no dependency on the full app bundle) ----
function pageShell({ title, description, canonical, ogTitle, ogDescription, jsonLd, bodyHTML }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHTML(title)}</title>
<meta name="description" content="${escapeHTML(description)}" />
<link rel="canonical" href="${canonical}" />
<link rel="icon" href="/icon-192.png" type="image/png" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${escapeHTML(ogTitle)}" />
<meta property="og:description" content="${escapeHTML(ogDescription)}" />
<meta property="og:url" content="${canonical}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${escapeHTML(ogTitle)}" />
<meta name="twitter:description" content="${escapeHTML(ogDescription)}" />
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root { --primary:#379777; --primary-dark:#276C55; --ink:#16181A; --ink-soft:#55697A; --border:#E1E6EB; --bg:#F5F7F6; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:'Inter',sans-serif; color:var(--ink); background:var(--bg); line-height:1.6; }
  a { color: var(--primary-dark); }
  header { background:#fff; border-bottom:1px solid var(--border); padding:16px 20px; display:flex; align-items:center; gap:10px; }
  header a.home { font-family:'Sora',sans-serif; font-weight:800; font-size:19px; color:var(--ink); text-decoration:none; display:flex; align-items:center; gap:8px; }
  header img { height:22px; }
  .tag-psc { font-family:monospace; font-size:10.5px; font-weight:700; color:var(--primary-dark); background:#EBF4F1; padding:3px 8px; border-radius:999px; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 20px 60px; }
  .eyebrow { font-family:monospace; font-size:12px; font-weight:700; letter-spacing:.08em; color: var(--ink-soft); text-transform:uppercase; }
  h1 { font-family:'Sora',sans-serif; font-size: clamp(24px,4vw,34px); margin: 10px 0 22px; }
  .card { background:#fff; border:1px solid var(--border); border-radius:16px; padding:20px 22px; margin-bottom:16px; }
  .card h2 { font-family:'Sora',sans-serif; font-size:18px; margin:0 0 8px; }
  .card a.stretched { text-decoration:none; color:inherit; display:block; }
  .muted { color: var(--ink-soft); font-size: 14px; }
  .cta { display:inline-block; margin-top:26px; background:var(--primary); color:#fff !important; font-weight:700; padding:11px 20px; border-radius:10px; text-decoration:none; }
  footer { text-align:center; padding:30px 20px; color:var(--ink-soft); font-size:13px; }
</style>
</head>
<body>
<header><a class="home" href="/"><img src="/logo-wordmark.png" alt="FutureU" /><span class="tag-psc">PSC</span></a></header>
<main>${bodyHTML}</main>
<footer>© ${new Date().getFullYear()} ${SITE_NAME} · Kerala PSC exam preparation</footer>
</body>
</html>`;
}

function renderPostBody(post) {
  return `
    <div class="eyebrow">${escapeHTML(fmtDate(post.publishedAt))}${post.author ? ` · ${escapeHTML(post.author)}` : ""}</div>
    <h1>${escapeHTML(post.title)}</h1>
    ${paragraphsToHTML(post.content)}
    <a class="cta" href="/blog?post=${encodeURIComponent(post.slug)}">Open in the FutureU app →</a>`;
}

function renderListBody(posts) {
  const eyebrow = `<div class="eyebrow">News &amp; updates</div><h1>Blog</h1><p class="muted" style="margin-top:-14px;">Exam notifications, syllabus changes, and study tips for Kerala PSC exams.</p>`;
  if (!posts.length) return eyebrow + `<p class="muted">No posts yet — check back soon.</p>`;
  const cards = posts
    .map(
      (p) => `<div class="card"><a class="stretched" href="/blog/${encodeURIComponent(p.slug)}/">
        <div class="muted" style="margin-bottom:6px;">${escapeHTML(fmtDate(p.publishedAt))}</div>
        <h2>${escapeHTML(p.title)}</h2>
        <p class="muted" style="margin:0;">${escapeHTML(p.excerpt || (p.content || "").slice(0, 140) + "…")}</p>
      </a></div>`
    )
    .join("\n");
  return eyebrow + cards;
}

async function main() {
  console.log("Fetching blog posts from Firestore…");
  const posts = await fetchAllBlogPosts();
  console.log(`Found ${posts.length} post(s).`);

  await fs.mkdir("blog", { recursive: true });

  // 1) Static list page: blog/index.html
  await fs.writeFile(
    path.join("blog", "index.html"),
    pageShell({
      title: `Blog | ${SITE_NAME}`,
      description: "Exam notifications, syllabus changes, and study tips for Kerala PSC exams.",
      canonical: `${SITE_URL}/blog`,
      ogTitle: `Blog | ${SITE_NAME}`,
      ogDescription: "Exam notifications, syllabus changes, and study tips for Kerala PSC exams.",
      bodyHTML: renderListBody(posts),
    }),
    "utf8"
  );

  // 2) One static page per post: blog/<slug>/index.html
  for (const post of posts) {
    if (!post.slug) { console.warn(`Skipping "${post.title}" — no slug.`); continue; }
    const dir = path.join("blog", post.slug);
    await fs.mkdir(dir, { recursive: true });
    const description = post.excerpt || (post.content || "").slice(0, 155);
    await fs.writeFile(
      path.join(dir, "index.html"),
      pageShell({
        title: `${post.title} | ${SITE_NAME}`,
        description,
        canonical: `${SITE_URL}/blog/${post.slug}/`,
        ogTitle: post.title,
        ogDescription: description,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description,
          datePublished: post.publishedAt || undefined,
          author: post.author ? { "@type": "Person", name: post.author } : undefined,
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          mainEntityOfPage: `${SITE_URL}/blog/${post.slug}/`,
        },
        bodyHTML: renderPostBody(post),
      }),
      "utf8"
    );
  }
  console.log(`Wrote blog/index.html + ${posts.length} post page(s).`);

  // 3) Regenerate sitemap.xml with every post URL included
  const urls = [
    ...STATIC_ROUTES.map((r) => ({ loc: `${SITE_URL}${r.path}`, changefreq: r.changefreq, priority: r.priority })),
    ...posts.filter((p) => p.slug).map((p) => ({ loc: `${SITE_URL}/blog/${p.slug}/`, changefreq: "monthly", priority: "0.6" })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
    .join("\n")}\n</urlset>\n`;
  await fs.writeFile("sitemap.xml", sitemap, "utf8");
  console.log(`Wrote sitemap.xml with ${urls.length} URLs.`);

  console.log("\nDone. Upload the blog/ folder and sitemap.xml to your site root, then redeploy.");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
