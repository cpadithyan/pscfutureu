// ============================================================
// APP.JS — routing + all public-facing features
// ============================================================

const cache = { playlists: null, pdfs: null, quizzes: null, mocks: null };
let activeTest = null; // { doc, type, index, answers, timerInterval, timeLeft }

// ---------------- Router ----------------
function router() {
  const hash = (location.hash || "#home").replace("#", "");
  $all(".page").forEach(p => p.classList.remove("active"));
  (document.getElementById("page-" + hash) || document.getElementById("page-home")).classList.add("active");
  $all("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === hash));
  $all("[data-tab]").forEach(a => a.classList.toggle("active", a.dataset.tab === hash));
  const nav = $(".site-nav"); if (nav) nav.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  loadPage(hash);
}
window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);

function loadPage(hash) {
  if (hash === "home") loadHome();
  else if (hash === "videos") loadVideos();
  else if (hash === "pdfs") loadPdfs();
  else if (hash === "quizzes") loadQuizzes();
  else if (hash === "mocks") loadMocks();
  else if (hash === "dashboard") loadDashboard();
}

// ---------------- Auth UI ----------------
window.addEventListener("authReady", (e) => {
  renderAuthArea(e.detail);
  const adminLink = $("#navAdminLink");
  if (adminLink) adminLink.style.display = e.detail.isAdmin ? "" : "none";
  const hash = (location.hash || "#home").replace("#", "");
  if (["quizzes", "mocks", "dashboard"].includes(hash)) loadPage(hash);
});

function renderAuthArea(detail) {
  const area = $("#authArea");
  if (!area) return;
  if (!detail.user) {
    area.innerHTML = `<button class="btn btn-google js-google-signin"><svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 013.68 9c0-.59.1-1.17.29-1.71V4.95H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.05l3.01-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"/></svg> <span class="label">Sign in</span></button>`;
    $(".js-google-signin", area).addEventListener("click", signInWithGoogle);
  } else {
    const initial = (detail.profile?.name || detail.user.displayName || "U").charAt(0).toUpperCase();
    area.innerHTML = `
      <div class="user-chip">
        ${detail.user.photoURL ? `<img src="${detail.user.photoURL}" alt="">` : `<span class="avatar-fallback">${initial}</span>`}
        <span>${(detail.profile?.name || detail.user.displayName || "Student").split(" ")[0]}</span>
      </div>
      <button class="btn btn-ghost btn-sm js-signout">Sign out</button>`;
    $(".js-signout", area).addEventListener("click", signOutUser);
  }
}

function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

// ---------------- Data fetchers (cached) ----------------
async function fetchCollection(name) {
  if (cache[name]) return cache[name];
  const snap = await db.collection(name).orderBy("createdAt", "desc").get();
  cache[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return cache[name];
}

// ---------------- YouTube helpers ----------------
function getYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const parts = u.pathname.split("/");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx !== -1) return parts[embedIdx + 1];
  } catch (e) { /* not a valid URL */ }
  return null;
}

// ---------------- HOME ----------------
async function loadHome() {
  const [pl, pdfs, qz, mk] = await Promise.all([
    fetchCollection("playlists"), fetchCollection("pdfs"), fetchCollection("quizzes"), fetchCollection("mocks")
  ]);
  $("#statVideos").textContent = pl.length;
  $("#statPdfs").textContent = pdfs.length;
  $("#statQuizzes").textContent = qz.length;
  $("#statMocks").textContent = mk.length;
}

// ---------------- VIDEOS ----------------
async function loadVideos() {
  const grid = $("#videoGrid");
  grid.innerHTML = `<p class="muted">Loading playlists…</p>`;
  const playlists = await fetchCollection("playlists");
  populateFilterOptions("#videoSubjectFilter", "#videoExamFilter", playlists);

  const render = () => {
    const search = $("#videoSearch").value.toLowerCase();
    const subj = $("#videoSubjectFilter").value;
    const exam = $("#videoExamFilter").value;
    const filtered = playlists.filter(p =>
      (!subj || p.subject === subj) && (!exam || p.exam === exam) &&
      (!search || p.title.toLowerCase().includes(search))
    );
    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="glyph">🎬</div><p>No playlists match your filters yet.</p></div>`;
      return;
    }
    grid.innerHTML = filtered.map(p => {
      const firstId = p.videos?.[0] ? getYouTubeId(p.videos[0].url) : null;
      const thumb = firstId ? `https://img.youtube.com/vi/${firstId}/hqdefault.jpg` : "";
      return `
      <div class="card js-open-playlist" data-id="${p.id}" style="cursor:pointer;">
        <div class="video-thumb">
          ${thumb ? `<img src="${thumb}" alt="${p.title}">` : ""}
          <div class="play"><span>▶</span></div>
          <div class="playlist-count">${(p.videos || []).length} video${(p.videos || []).length === 1 ? "" : "s"}</div>
        </div>
        <div class="card-body">
          <div class="card-tags">${p.subject ? `<span class="tag">${p.subject}</span>` : ""}${p.exam ? `<span class="tag gold">${p.exam}</span>` : ""}</div>
          <h3>${p.title}</h3>
          <p class="muted">${p.description || ""}</p>
        </div>
      </div>`;
    }).join("");
    $all(".js-open-playlist", grid).forEach(el => el.addEventListener("click", () => openPlaylistModal(el.dataset.id)));
  };
  render();
  $("#videoSearch").oninput = render;
  $("#videoSubjectFilter").onchange = render;
  $("#videoExamFilter").onchange = render;
}

function openPlaylistModal(id) {
  const p = cache.playlists.find(x => x.id === id);
  if (!p || !p.videos?.length) return;
  const modal = $("#videoModal");
  $("#videoModalTag").textContent = [p.subject, p.exam].filter(Boolean).join(" · ") || "PLAYLIST";
  $("#videoModalTitle").textContent = p.title;
  const playVideo = (idx) => {
    const vId = getYouTubeId(p.videos[idx].url);
    $("#videoModalFrame").src = vId ? `https://www.youtube.com/embed/${vId}?autoplay=1` : "";
    $all(".video-list-item", $("#videoModalList")).forEach((el, i) => el.classList.toggle("selected", i === idx));
  };
  $("#videoModalList").innerHTML = p.videos.map((v, i) =>
    `<div class="option-row video-list-item" data-idx="${i}"><span>${i + 1}.</span><span>${v.title}</span></div>`
  ).join("");
  $all(".video-list-item", $("#videoModalList")).forEach(el =>
    el.addEventListener("click", () => playVideo(Number(el.dataset.idx)))
  );
  playVideo(0);
  modal.classList.add("show");
}
$("#videoModal").addEventListener("click", (e) => { if (e.target.id === "videoModal") closeVideoModal(); });
document.addEventListener("DOMContentLoaded", () => {
  $(".js-close-video-modal").addEventListener("click", closeVideoModal);
});
function closeVideoModal() {
  $("#videoModal").classList.remove("show");
  $("#videoModalFrame").src = "";
}

// ---------------- PDFS ----------------
async function loadPdfs() {
  const grid = $("#pdfGrid");
  grid.innerHTML = `<p class="muted">Loading notes…</p>`;
  const pdfs = await fetchCollection("pdfs");
  populateFilterOptions("#pdfSubjectFilter", "#pdfExamFilter", pdfs);

  const render = () => {
    const search = $("#pdfSearch").value.toLowerCase();
    const subj = $("#pdfSubjectFilter").value;
    const exam = $("#pdfExamFilter").value;
    const filtered = pdfs.filter(p =>
      (!subj || p.subject === subj) && (!exam || p.exam === exam) &&
      (!search || p.title.toLowerCase().includes(search))
    );
    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="glyph">📄</div><p>No notes match your filters yet.</p></div>`;
      return;
    }
    grid.innerHTML = filtered.map(p => `
      <div class="card pdf-card">
        <div class="pdf-icon">PDF</div>
        <div class="grow">
          <div class="card-tags">${p.subject ? `<span class="tag">${p.subject}</span>` : ""}${p.exam ? `<span class="tag gold">${p.exam}</span>` : ""}</div>
          <h3>${p.title}</h3>
          <p class="muted">${p.description || ""}</p>
        </div>
        <a href="${p.url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Download</a>
      </div>`).join("");
  };
  render();
  $("#pdfSearch").oninput = render;
  $("#pdfSubjectFilter").onchange = render;
  $("#pdfExamFilter").onchange = render;
}

function populateFilterOptions(subjSel, examSel, items) {
  const subjects = [...new Set(items.map(i => i.subject).filter(Boolean))].sort();
  const exams = [...new Set(items.map(i => i.exam).filter(Boolean))].sort();
  $(subjSel).innerHTML = `<option value="">All subjects</option>` + subjects.map(s => `<option value="${s}">${s}</option>`).join("");
  $(examSel).innerHTML = `<option value="">All exams</option>` + exams.map(s => `<option value="${s}">${s}</option>`).join("");
}

// ---------------- LOCK GATE ----------------
function lockGateHTML(what) {
  return `
    <div class="lock-gate">
      <div class="glyph">🔒</div>
      <h2>Sign in to access ${what}</h2>
      <p>Create a free account with Google to attempt ${what} and track your scores on your dashboard.</p>
      <button class="btn btn-primary js-gate-signin">Sign in with Google</button>
    </div>`;
}
function wireGateButtons(container) {
  const btn = container.querySelector(".js-gate-signin");
  if (btn) btn.addEventListener("click", signInWithGoogle);
}

// ---------------- QUIZZES ----------------
async function loadQuizzes() {
  const el = $("#quizzesContainer");
  if (!currentUser) { el.innerHTML = lockGateHTML("quizzes"); wireGateButtons(el); return; }
  el.innerHTML = `<p class="muted">Loading quizzes…</p>`;
  const quizzes = await fetchCollection("quizzes");
  renderTestList(el, quizzes, "quiz");
}

// ---------------- MOCKS ----------------
async function loadMocks() {
  const el = $("#mocksContainer");
  if (!currentUser) { el.innerHTML = lockGateHTML("mock tests"); wireGateButtons(el); return; }
  el.innerHTML = `<p class="muted">Loading mock tests…</p>`;
  const mocks = await fetchCollection("mocks");
  renderTestList(el, mocks, "mock");
}

function renderTestList(el, items, type) {
  el.innerHTML = `
    <div class="section-head">
      <div><span class="eyebrow">${type === "quiz" ? "Practice" : "Timed · Full length"}</span>
      <h2>${type === "quiz" ? "Quizzes" : "Mock Tests"}</h2>
      <p>${type === "quiz" ? "Short subject-wise quizzes — take your time." : "Full-length tests with a countdown timer, just like the real exam."}</p></div>
    </div>
    <div class="filter-bar">
      <select id="${type}SubjectFilter"><option value="">All subjects</option></select>
      <select id="${type}ExamFilter"><option value="">All exams</option></select>
    </div>
    <div class="grid grid-3" id="${type}Grid"></div>`;
  populateFilterOptions(`#${type}SubjectFilter`, `#${type}ExamFilter`, items);

  const render = () => {
    const subj = $(`#${type}SubjectFilter`).value;
    const exam = $(`#${type}ExamFilter`).value;
    const filtered = items.filter(i => (!subj || i.subject === subj) && (!exam || i.exam === exam));
    const grid = $(`#${type}Grid`);
    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="glyph">📝</div><p>No ${type === "quiz" ? "quizzes" : "mock tests"} available yet — check back soon.</p></div>`;
      return;
    }
    grid.innerHTML = filtered.map(i => `
      <div class="card"><div class="card-body">
        <div class="card-tags">${i.subject ? `<span class="tag">${i.subject}</span>` : ""}${i.exam ? `<span class="tag gold">${i.exam}</span>` : ""}</div>
        <h3>${i.title}</h3>
        <p class="muted">${(i.questions || []).length} question${(i.questions || []).length === 1 ? "" : "s"}${type === "mock" && i.timerMinutes ? ` · ${i.timerMinutes} min` : ""}${i.negativeMarking ? ` · Negative marking` : ""}</p>
        <button class="btn btn-primary btn-block js-start-test" data-id="${i.id}" style="margin-top:10px;">${type === "quiz" ? "Start Quiz" : "Start Mock Test"}</button>
      </div></div>`).join("");
    $all(".js-start-test", grid).forEach(b => b.addEventListener("click", () => startTest(b.dataset.id, type)));
  };
  render();
  $(`#${type}SubjectFilter`).onchange = render;
  $(`#${type}ExamFilter`).onchange = render;
}

// ---------------- TEST RUNTIME (shared by quiz + mock) ----------------
function startTest(id, type) {
  const source = type === "quiz" ? cache.quizzes : cache.mocks;
  const doc = source.find(d => d.id === id);
  if (!doc || !doc.questions?.length) { showToast("This test has no questions yet."); return; }
  activeTest = { doc, type, index: 0, answers: new Array(doc.questions.length).fill(null), timerInterval: null, timeLeft: null };
  renderTestRuntime();
  if (type === "mock" && doc.timerMinutes) {
    activeTest.timeLeft = doc.timerMinutes * 60;
    activeTest.timerInterval = setInterval(tickTimer, 1000);
  }
}

function getRuntimeContainer() {
  return activeTest.type === "quiz" ? $("#quizzesContainer") : $("#mocksContainer");
}

function tickTimer() {
  activeTest.timeLeft--;
  const pill = $("#testTimerPill");
  if (pill) {
    const m = Math.floor(activeTest.timeLeft / 60), s = activeTest.timeLeft % 60;
    pill.textContent = `${m}:${String(s).padStart(2, "0")}`;
    pill.classList.toggle("low", activeTest.timeLeft <= 60);
  }
  if (activeTest.timeLeft <= 0) {
    clearInterval(activeTest.timerInterval);
    submitTest(true);
  }
}

function renderTestRuntime() {
  const el = getRuntimeContainer();
  const { doc, index, answers } = activeTest;
  const q = doc.questions[index];
  const pct = Math.round(((index) / doc.questions.length) * 100);
  el.innerHTML = `
    <div class="quiz-shell">
      <div class="quiz-meta-bar">
        <div><strong>${doc.title}</strong><div class="muted" style="font-size:12.5px;">Question ${index + 1} of ${doc.questions.length}</div></div>
        ${activeTest.timeLeft !== null ? `<span class="timer-pill" id="testTimerPill">${Math.floor(activeTest.timeLeft / 60)}:${String(activeTest.timeLeft % 60).padStart(2, "0")}</span>` : ""}
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="q-block">
        <span class="q-num">Q${index + 1}</span>
        <h3>${q.q}</h3>
        <div id="optionsWrap">
          ${q.options.map((opt, i) => `
            <label class="option-row ${answers[index] === i ? "selected" : ""}" data-idx="${i}">
              <input type="radio" name="opt" ${answers[index] === i ? "checked" : ""} />
              <span>${opt}</span>
            </label>`).join("")}
        </div>
      </div>
      <div class="quiz-nav-actions">
        <button class="btn btn-ghost" id="testPrevBtn" ${index === 0 ? "disabled" : ""}>← Previous</button>
        ${index === doc.questions.length - 1
          ? `<button class="btn btn-accent" id="testSubmitBtn">Submit Test</button>`
          : `<button class="btn btn-primary" id="testNextBtn">Next →</button>`}
      </div>
    </div>`;

  $all(".option-row", el).forEach(row => row.addEventListener("click", () => {
    activeTest.answers[activeTest.index] = Number(row.dataset.idx);
    renderTestRuntime();
  }));
  const prevBtn = $("#testPrevBtn"); if (prevBtn) prevBtn.addEventListener("click", () => { activeTest.index--; renderTestRuntime(); });
  const nextBtn = $("#testNextBtn"); if (nextBtn) nextBtn.addEventListener("click", () => { activeTest.index++; renderTestRuntime(); });
  const submitBtn = $("#testSubmitBtn"); if (submitBtn) submitBtn.addEventListener("click", () => submitTest(false));
}

async function submitTest(autoSubmitted) {
  if (activeTest.timerInterval) clearInterval(activeTest.timerInterval);
  const { doc, answers, type } = activeTest;
  let correct = 0, wrong = 0, unanswered = 0;
  doc.questions.forEach((q, i) => {
    if (answers[i] === null || answers[i] === undefined) unanswered++;
    else if (answers[i] === q.correct) correct++;
    else wrong++;
  });
  const negValue = doc.negativeMarking ? Number(doc.negativeValue || 0) : 0;
  const score = Math.round((correct - wrong * negValue) * 100) / 100;

  try {
    await db.collection("results").add({
      uid: currentUser.uid,
      studentName: currentProfile?.name || currentUser.displayName || "Student",
      type, refId: doc.id, title: doc.title,
      score, total: doc.questions.length, correct, wrong, unanswered,
      date: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) { console.error("Could not save result:", err); }

  renderTestResult(autoSubmitted, { correct, wrong, unanswered, score });
}

function renderTestResult(autoSubmitted, stats) {
  const el = getRuntimeContainer();
  const { doc, answers, type } = activeTest;
  el.innerHTML = `
    ${autoSubmitted ? `<p class="muted" style="text-align:center;">⏱️ Time's up — your test was submitted automatically.</p>` : ""}
    <div class="result-card">
      <div class="result-card-top">
        <div class="eyebrow" style="color:#fff; opacity:.8;">${doc.title}</div>
        <div><span class="score-num">${stats.score}</span><span class="score-total"> / ${doc.questions.length}</span></div>
      </div>
      <div class="result-stats">
        <div><strong style="color:var(--color-success);">${stats.correct}</strong><span>Correct</span></div>
        <div><strong style="color:var(--color-danger);">${stats.wrong}</strong><span>Wrong</span></div>
        <div><strong>${stats.unanswered}</strong><span>Skipped</span></div>
      </div>
    </div>
    <div style="display:flex; gap:10px; justify-content:center; margin:18px 0;">
      <button class="btn btn-ghost" id="reviewBtn">Review Answers</button>
      <button class="btn btn-primary" id="backToListBtn">Back to ${type === "quiz" ? "Quizzes" : "Mock Tests"}</button>
    </div>
    <div id="reviewWrap" class="quiz-shell"></div>`;

  $("#backToListBtn").addEventListener("click", () => { activeTest = null; type === "quiz" ? loadQuizzes() : loadMocks(); });
  $("#reviewBtn").addEventListener("click", () => {
    const wrap = $("#reviewWrap");
    wrap.innerHTML = doc.questions.map((q, i) => `
      <div class="q-block">
        <span class="q-num">Q${i + 1}</span>
        <h3>${q.q}</h3>
        ${q.options.map((opt, oi) => {
          let cls = "";
          if (oi === q.correct) cls = "correct";
          else if (oi === answers[i] && answers[i] !== q.correct) cls = "incorrect";
          return `<div class="option-row ${cls}"><span>${opt}</span></div>`;
        }).join("")}
      </div>`).join("");
  });
}

// ---------------- DASHBOARD ----------------
async function loadDashboard() {
  const el = $("#dashboardContainer");
  if (!currentUser) { el.innerHTML = lockGateHTML("your dashboard"); wireGateButtons(el); return; }
  el.innerHTML = `<p class="muted">Loading your dashboard…</p>`;

  let results = [];
  try {
    const snap = await db.collection("results").where("uid", "==", currentUser.uid).orderBy("date", "desc").limit(30).get();
    results = snap.docs.map(d => d.data());
  } catch (err) {
    console.error(err);
  }

  const attempted = results.length;
  const avg = attempted ? Math.round((results.reduce((s, r) => s + r.score, 0) / attempted) * 100) / 100 : 0;
  const initial = (currentProfile?.name || "S").charAt(0).toUpperCase();

  el.innerHTML = `
    <div class="section-head"><div><span class="eyebrow">Your progress</span><h2>Dashboard</h2></div></div>
    <div class="dash-grid">
      <div>
        <div class="admit-card" style="transform:none;">
          <div class="admit-card-top">
            <span class="tag">STUDENT PROFILE</span>
            <span class="tag" style="background:#FBF0DA;color:#C9860F;">${currentProfile?.district || ""}</span>
          </div>
          <div class="admit-card-body">
            <div class="admit-photo" style="display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--font-mono);font-weight:700;">${initial}</div>
            <div>
              <h4>${currentProfile?.name || currentUser.displayName || "Student"}</h4>
              <span>${currentProfile?.phone || ""}</span><br/>
              <span>${currentUser.email}</span>
            </div>
          </div>
          <div class="admit-perforation"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="card" style="margin-top:16px;"><div class="card-body">
          <p class="muted" style="margin-bottom:4px;">Tests attempted</p>
          <h3 style="font-family:var(--font-mono);">${attempted}</h3>
          <p class="muted" style="margin:12px 0 4px;">Average score</p>
          <h3 style="font-family:var(--font-mono);">${avg}</h3>
        </div></div>
      </div>
      <div class="card"><div class="card-body">
        <h3>Recent attempts</h3>
        <div id="historyList">
          ${attempted ? results.map(r => `
            <div class="history-row">
              <div>
                <h4>${r.title}</h4>
                <p class="muted">${r.type === "quiz" ? "Quiz" : "Mock Test"} · ${r.date?.toDate ? r.date.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}</p>
              </div>
              <span class="history-score">${r.score}/${r.total}</span>
            </div>`).join("") : `<div class="empty-state"><div class="glyph">📊</div><p>No attempts yet — take a quiz or mock test to see your history here.</p></div>`}
        </div>
      </div></div>
    </div>`;
}
