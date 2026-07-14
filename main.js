// ============================================================
// SHARED AUTH — Google sign-in, first-time profile capture,
// and broadcasting auth state to whichever page is loaded.
// ============================================================

let currentUser = null;
let currentProfile = null;
let isAdmin = false;

function broadcastAuth() {
  window.dispatchEvent(new CustomEvent("authReady", {
    detail: { user: currentUser, profile: currentProfile, isAdmin }
  }));
}

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

// ---- Google Sign-in ----
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    if (err.code !== "auth/popup-closed-by-user") {
      alert("Sign-in failed: " + err.message);
    }
  });
}

function signOutUser() {
  auth.signOut();
}

// ---- Profile completion modal ----
function buildProfileModal() {
  if ($("#profileModal")) return;
  const districtOptions = KERALA_DISTRICTS.map(d => `<option value="${d}">${d}</option>`).join("");
  const modal = document.createElement("div");
  modal.id = "profileModal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-eyebrow">One last step</div>
      <h2>Complete your profile</h2>
      <p class="modal-sub">We use this to personalise your dashboard and district-wise rank cards.</p>
      <form id="profileForm">
        <label>Full name
          <input type="text" id="pf-name" required placeholder="e.g. Aiswarya Menon" />
        </label>
        <label>Phone number
          <input type="tel" id="pf-phone" required pattern="[0-9]{10}" maxlength="10" placeholder="10-digit mobile number" />
        </label>
        <label>District
          <select id="pf-district" required>
            <option value="" disabled selected>Select your district</option>
            ${districtOptions}
          </select>
        </label>
        <button type="submit" class="btn btn-primary btn-block">Save & continue</button>
      </form>
    </div>`;
  document.body.appendChild(modal);

  $("#profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#pf-name").value.trim();
    const phone = $("#pf-phone").value.trim();
    const district = $("#pf-district").value;
    const btn = $("#profileForm button");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      await db.collection("users").doc(currentUser.uid).set({
        name, phone, district,
        email: currentUser.email,
        photoURL: currentUser.photoURL || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      currentProfile = { name, phone, district, email: currentUser.email };
      modal.classList.remove("show");
      broadcastAuth();
    } catch (err) {
      alert("Could not save profile: " + err.message);
      btn.disabled = false; btn.textContent = "Save & continue";
    }
  });
}

function showProfileModal() {
  buildProfileModal();
  $("#profileModal").classList.add("show");
}

// ---- Auth state ----
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  currentProfile = null;
  isAdmin = false;

  if (!user) {
    broadcastAuth();
    return;
  }

  isAdmin = (user.email === ADMIN_EMAIL);

  try {
    const doc = await db.collection("users").doc(user.uid).get();
    if (doc.exists && doc.data().name && doc.data().phone && doc.data().district) {
      currentProfile = doc.data();
      broadcastAuth();
    } else {
      broadcastAuth();
      showProfileModal();
    }
  } catch (err) {
    console.error("Failed to load profile:", err);
    broadcastAuth();
  }
});

// ---- Nav wiring shared by every page ----
document.addEventListener("DOMContentLoaded", () => {
  $all(".js-google-signin").forEach(btn => btn.addEventListener("click", signInWithGoogle));
  $all(".js-signout").forEach(btn => btn.addEventListener("click", signOutUser));

  const mobileToggle = $(".js-nav-toggle");
  if (mobileToggle) {
    mobileToggle.addEventListener("click", () => $(".site-nav").classList.toggle("open"));
  }
});
