// ============================================================
// ADMIN.JS — protected content-management panel
// ============================================================

let blockUidCounter = 0;

window.addEventListener("authReady", (detail) => {
  const { user, isAdmin } = detail.detail;
  renderAuthArea(detail.detail);
  const root = $("#adminRoot");
  if (!user) {
    root.innerHTML = `
      <div class="lock-gate" style="margin-top:60px;">
        <div class="glyph">🔒</div>
        <h2>Admin sign-in required</h2>
        <p>Sign in with the admin Google account to manage videos, notes, quizzes and mock tests.</p>
        <button class="btn btn-primary js-google-signin">Sign in with Google</button>
      </div>`;
    $(".js-google-signin", root).addEventListener("click", signInWithGoogle);
    return;
  }
  if (!isAdmin) {
    root.innerHTML = `
      <div class="lock-gate" style="margin-top:60px;">
        <div class="glyph">⛔</div>
        <h2>Not authorised</h2>
        <p>You're signed in as ${user.email}, which isn't the admin account for this site.</p>
        <button class="btn btn-ghost js-signout">Sign out</button>
      </div>`;
    $(".js-signout", root).addEventListener("click", signOutUser);
    return;
  }
  renderAuthArea(detail.detail);
  renderAdminShell();
});

function renderAuthArea(detail) {
  const area = $("#authArea");
  if (!area) return;
  if (!detail.user) {
    area.innerHTML = `<button class="btn btn-google js-google-signin">Sign in</button>`;
    $(".js-google-signin", area).addEventListener("click", signInWithGoogle);
  } else {
    area.innerHTML = `
      <div class="user-chip">
        ${detail.user.photoURL ? `<img src="${detail.user.photoURL}" alt="">` : `<span class="avatar-fallback">A</span>`}
        <span>${detail.user.displayName || "Admin"}</span>
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

// ---------------- Shell ----------------
function renderAdminShell() {
  const root = $("#adminRoot");
  root.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-side">
        <a href="#" data-tab="overview">📊 Overview</a>
        <a href="#" data-tab="playlists">🎬 Video Playlists</a>
        <a href="#" data-tab="pdfs">📄 Study Notes</a>
        <a href="#" data-tab="quizzes">📝 Quizzes</a>
        <a href="#" data-tab="mocks">⏱️ Mock Tests</a>
      </aside>
      <div class="admin-main" id="adminContent"></div>
    </div>`;
  $all(".admin-side a").forEach(a => a.addEventListener("click", (e) => {
    e.preventDefault();
    $all(".admin-side a").forEach(x => x.classList.remove("active"));
    a.classList.add("active");
    adminNavigate(a.dataset.tab);
  }));
  $all(".admin-side a")[0].classList.add("active");
  adminNavigate("overview");
}

function adminNavigate(tab) {
  if (tab === "overview") renderOverview();
  else if (tab === "playlists") renderCollectionAdmin("playlists");
  else if (tab === "pdfs") renderPdfsAdmin();
  else if (tab === "quizzes") renderTestAdmin("quizzes");
  else if (tab === "mocks") renderTestAdmin("mocks");
}

// ---------------- Overview ----------------
async function renderOverview() {
  const el = $("#adminContent");
  el.innerHTML = `<p class="muted">Loading…</p>`;
  const [pl, pdfs, qz, mk] = await Promise.all(
    ["playlists", "pdfs", "quizzes", "mocks"].map(c => db.collection(c).get())
  );
  el.innerHTML = `
    <h2 style="margin-bottom:20px;">Overview</h2>
    <div class="grid grid-2">
      <div class="card"><div class="card-body"><p class="muted">Video playlists</p><h3 style="font-family:var(--font-mono);">${pl.size}</h3></div></div>
      <div class="card"><div class="card-body"><p class="muted">Study notes (PDFs)</p><h3 style="font-family:var(--font-mono);">${pdfs.size}</h3></div></div>
      <div class="card"><div class="card-body"><p class="muted">Quizzes</p><h3 style="font-family:var(--font-mono);">${qz.size}</h3></div></div>
      <div class="card"><div class="card-body"><p class="muted">Mock tests</p><h3 style="font-family:var(--font-mono);">${mk.size}</h3></div></div>
    </div>`;
}

// ---------------- Playlists ----------------
function renderCollectionAdmin(collectionName) {
  const el = $("#adminContent");
  el.innerHTML = `
    <h2>Video Playlists</h2>
    <div class="form-card">
      <h3 style="margin-bottom:14px;">Add a new playlist</h3>
      <form id="playlistForm">
        <div class="form-row"><label>Playlist title</label><input type="text" id="pl-title" required placeholder="e.g. Kerala Renaissance — Full Course" /></div>
        <div class="form-row"><label>Description (optional)</label><textarea id="pl-desc" rows="2" placeholder="Short description shown on the card"></textarea></div>
        <div class="form-row-inline">
          <div class="form-row"><label>Subject</label><input type="text" id="pl-subject" placeholder="e.g. General Knowledge" /></div>
          <div class="form-row"><label>Exam</label><input type="text" id="pl-exam" placeholder="e.g. LDC" /></div>
        </div>
        <label style="font-size:13px; font-weight:700;">Videos</label>
        <div id="videoRows" style="margin-top:8px;"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="addVideoRowBtn" style="margin-bottom:16px;">+ Add video</button>
        <button type="submit" class="btn btn-primary">Save playlist</button>
      </form>
    </div>
    <h3 style="margin-bottom:10px;">Existing playlists</h3>
    <table class="admin-table"><thead><tr><th>Title</th><th>Subject</th><th>Exam</th><th>Videos</th><th></th></tr></thead>
    <tbody id="playlistTableBody"><tr><td colspan="5">Loading…</td></tr></tbody></table>`;

  const addVideoRow = (title = "", url = "") => {
    const row = document.createElement("div");
    row.className = "repeat-block video-row";
    row.innerHTML = `
      <button type="button" class="remove-btn">✕</button>
      <div class="form-row"><label>Video title</label><input type="text" class="v-title" value="${title}" placeholder="e.g. Class 1 — Introduction" /></div>
      <div class="form-row"><label>YouTube URL</label><input type="url" class="v-url" value="${url}" placeholder="https://www.youtube.com/watch?v=..." /></div>`;
    row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
    $("#videoRows").appendChild(row);
  };
  addVideoRow();
  $("#addVideoRowBtn").addEventListener("click", () => addVideoRow());

  $("#playlistForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const videos = $all(".video-row", $("#videoRows")).map(row => ({
      title: row.querySelector(".v-title").value.trim(),
      url: row.querySelector(".v-url").value.trim()
    })).filter(v => v.title && v.url);
    if (!videos.length) { showToast("Add at least one video with a title and URL."); return; }
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      await db.collection("playlists").add({
        title: $("#pl-title").value.trim(),
        description: $("#pl-desc").value.trim(),
        subject: $("#pl-subject").value.trim(),
        exam: $("#pl-exam").value.trim(),
        videos,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("Playlist saved!");
      e.target.reset();
      $("#videoRows").innerHTML = ""; addVideoRow();
      loadPlaylistTable();
    } catch (err) { showToast("Error: " + err.message); }
    btn.disabled = false; btn.textContent = "Save playlist";
  });

  loadPlaylistTable();
}

async function loadPlaylistTable() {
  const tbody = $("#playlistTableBody");
  const snap = await db.collection("playlists").orderBy("createdAt", "desc").get();
  if (snap.empty) { tbody.innerHTML = `<tr><td colspan="5">No playlists yet.</td></tr>`; return; }
  tbody.innerHTML = snap.docs.map(d => {
    const p = d.data();
    return `<tr>
      <td>${p.title}</td><td>${p.subject || "—"}</td><td>${p.exam || "—"}</td><td>${(p.videos || []).length}</td>
      <td class="actions"><button class="icon-btn danger js-del" data-id="${d.id}">Delete</button></td>
    </tr>`;
  }).join("");
  $all(".js-del", tbody).forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this playlist?")) return;
    await db.collection("playlists").doc(b.dataset.id).delete();
    showToast("Playlist deleted.");
    loadPlaylistTable();
  }));
}

// ---------------- PDFs ----------------
function renderPdfsAdmin() {
  const el = $("#adminContent");
  el.innerHTML = `
    <h2>Study Notes (PDFs)</h2>
    <div class="form-card">
      <h3 style="margin-bottom:14px;">Add a new note</h3>
      <form id="pdfForm">
        <div class="form-row"><label>Title</label><input type="text" id="pdf-title" required placeholder="e.g. Indian Constitution — Short Notes" /></div>
        <div class="form-row"><label>Description (optional)</label><textarea id="pdf-desc" rows="2"></textarea></div>
        <div class="form-row-inline">
          <div class="form-row"><label>Subject</label><input type="text" id="pdf-subject" placeholder="e.g. Indian Polity" /></div>
          <div class="form-row"><label>Exam</label><input type="text" id="pdf-exam" placeholder="e.g. Degree Level" /></div>
        </div>
        <div class="form-row"><label>PDF link (Google Drive "anyone with link" share URL, or any direct file link)</label><input type="url" id="pdf-url" required placeholder="https://drive.google.com/..." /></div>
        <button type="submit" class="btn btn-primary">Save note</button>
      </form>
    </div>
    <h3 style="margin-bottom:10px;">Existing notes</h3>
    <table class="admin-table"><thead><tr><th>Title</th><th>Subject</th><th>Exam</th><th></th></tr></thead>
    <tbody id="pdfTableBody"><tr><td colspan="4">Loading…</td></tr></tbody></table>`;

  $("#pdfForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      await db.collection("pdfs").add({
        title: $("#pdf-title").value.trim(),
        description: $("#pdf-desc").value.trim(),
        subject: $("#pdf-subject").value.trim(),
        exam: $("#pdf-exam").value.trim(),
        url: $("#pdf-url").value.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("Note saved!");
      e.target.reset();
      loadPdfTable();
    } catch (err) { showToast("Error: " + err.message); }
    btn.disabled = false; btn.textContent = "Save note";
  });

  loadPdfTable();
}

async function loadPdfTable() {
  const tbody = $("#pdfTableBody");
  const snap = await db.collection("pdfs").orderBy("createdAt", "desc").get();
  if (snap.empty) { tbody.innerHTML = `<tr><td colspan="4">No notes yet.</td></tr>`; return; }
  tbody.innerHTML = snap.docs.map(d => {
    const p = d.data();
    return `<tr>
      <td>${p.title}</td><td>${p.subject || "—"}</td><td>${p.exam || "—"}</td>
      <td class="actions"><button class="icon-btn danger js-del" data-id="${d.id}">Delete</button></td>
    </tr>`;
  }).join("");
  $all(".js-del", tbody).forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this note?")) return;
    await db.collection("pdfs").doc(b.dataset.id).delete();
    showToast("Note deleted.");
    loadPdfTable();
  }));
}

// ---------------- Quizzes & Mocks (shared) ----------------
function renderTestAdmin(collectionName) {
  const isMock = collectionName === "mocks";
  const el = $("#adminContent");
  el.innerHTML = `
    <h2>${isMock ? "Mock Tests" : "Quizzes"}</h2>
    <div class="form-card">
      <h3 style="margin-bottom:14px;">Add a new ${isMock ? "mock test" : "quiz"}</h3>
      <form id="testForm">
        <div class="form-row"><label>Title</label><input type="text" id="t-title" required placeholder="e.g. ${isMock ? "LDC Full Mock — Set 1" : "Indian History — Quiz 1"}" /></div>
        <div class="form-row-inline">
          <div class="form-row"><label>Subject</label><input type="text" id="t-subject" placeholder="e.g. History" /></div>
          <div class="form-row"><label>Exam</label><input type="text" id="t-exam" placeholder="e.g. LDC" /></div>
        </div>
        ${isMock ? `<div class="form-row" style="max-width:220px;"><label>Timer (minutes, optional)</label><input type="number" id="t-timer" min="1" placeholder="e.g. 90" /></div>` : ""}
        <div class="toggle-row" style="margin-bottom:16px;">
          <input type="checkbox" id="t-negmark" style="width:18px;height:18px;" />
          <label for="t-negmark" style="font-weight:700; font-size:13.5px;">Enable negative marking</label>
          <input type="number" id="t-negvalue" step="0.01" min="0" placeholder="e.g. 0.33" style="width:100px; padding:8px 10px; border-radius:8px; border:1.5px solid var(--color-border); margin-left:8px;" disabled />
        </div>
        <label style="font-size:13px; font-weight:700;">Questions</label>
        <div id="questionRows" style="margin-top:8px;"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="addQuestionBtn" style="margin-bottom:16px;">+ Add question</button>
        <button type="submit" class="btn btn-primary">Save ${isMock ? "mock test" : "quiz"}</button>
      </form>
    </div>
    <h3 style="margin-bottom:10px;">Existing ${isMock ? "mock tests" : "quizzes"}</h3>
    <table class="admin-table"><thead><tr><th>Title</th><th>Subject</th><th>Exam</th><th>Qs</th><th></th></tr></thead>
    <tbody id="testTableBody"><tr><td colspan="5">Loading…</td></tr></tbody></table>`;

  $("#t-negmark").addEventListener("change", (e) => { $("#t-negvalue").disabled = !e.target.checked; });

  const addQuestionRow = () => {
    blockUidCounter++;
    const uid = blockUidCounter;
    const row = document.createElement("div");
    row.className = "repeat-block question-row";
    row.dataset.uid = uid;
    row.innerHTML = `
      <button type="button" class="remove-btn">✕</button>
      <div class="form-row"><label>Question</label><textarea class="q-text" rows="2" placeholder="Type the question here"></textarea></div>
      ${[0, 1, 2, 3].map(i => `
        <div class="form-row-inline" style="align-items:center;">
          <input type="radio" name="correct-${uid}" class="q-correct" value="${i}" style="width:18px;height:18px;" />
          <div class="form-row" style="flex:1;"><input type="text" class="q-opt" placeholder="Option ${i + 1}" /></div>
        </div>`).join("")}
      <p class="muted" style="font-size:12px;">Select the radio button next to the correct option.</p>`;
    row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
    $("#questionRows").appendChild(row);
  };
  addQuestionRow();
  $("#addQuestionBtn").addEventListener("click", addQuestionRow);

  $("#testForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const questions = [];
    for (const row of $all(".question-row", $("#questionRows"))) {
      const qText = row.querySelector(".q-text").value.trim();
      const opts = $all(".q-opt", row).map(o => o.value.trim());
      const correctRadio = row.querySelector(".q-correct:checked");
      if (!qText || opts.some(o => !o) || !correctRadio) continue;
      questions.push({ q: qText, options: opts, correct: Number(correctRadio.value) });
    }
    if (!questions.length) { showToast("Add at least one complete question with a correct answer marked."); return; }

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const payload = {
        title: $("#t-title").value.trim(),
        subject: $("#t-subject").value.trim(),
        exam: $("#t-exam").value.trim(),
        negativeMarking: $("#t-negmark").checked,
        negativeValue: $("#t-negmark").checked ? Number($("#t-negvalue").value || 0) : 0,
        questions,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (isMock) payload.timerMinutes = $("#t-timer").value ? Number($("#t-timer").value) : null;
      await db.collection(collectionName).add(payload);
      showToast(`${isMock ? "Mock test" : "Quiz"} saved!`);
      e.target.reset();
      $("#questionRows").innerHTML = ""; addQuestionRow();
      loadTestTable(collectionName);
    } catch (err) { showToast("Error: " + err.message); }
    btn.disabled = false; btn.textContent = `Save ${isMock ? "mock test" : "quiz"}`;
  });

  loadTestTable(collectionName);
}

async function loadTestTable(collectionName) {
  const tbody = $("#testTableBody");
  const snap = await db.collection(collectionName).orderBy("createdAt", "desc").get();
  if (snap.empty) { tbody.innerHTML = `<tr><td colspan="5">Nothing added yet.</td></tr>`; return; }
  tbody.innerHTML = snap.docs.map(d => {
    const t = d.data();
    return `<tr>
      <td>${t.title}</td><td>${t.subject || "—"}</td><td>${t.exam || "—"}</td><td>${(t.questions || []).length}</td>
      <td class="actions"><button class="icon-btn danger js-del" data-id="${d.id}">Delete</button></td>
    </tr>`;
  }).join("");
  $all(".js-del", tbody).forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this?")) return;
    await db.collection(collectionName).doc(b.dataset.id).delete();
    showToast("Deleted.");
    loadTestTable(collectionName);
  }));
}
