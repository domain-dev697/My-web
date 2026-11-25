const authStage = document.getElementById("authStage");
const authShell = document.getElementById("authShell");
const slideToRegister = document.getElementById("slideToRegister");
const slideToLogin = document.getElementById("slideToLogin");
const mobileLoginTab = document.getElementById("mobileLoginTab");
const mobileRegisterTab = document.getElementById("mobileRegisterTab");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const registerSubmitBtn = document.getElementById("registerSubmitBtn");
const feedbackBanner = document.getElementById("feedbackBanner");

const sessionBadge = document.getElementById("sessionBadge");
const sessionStatus = document.getElementById("sessionStatus");
const logoutBtn = document.getElementById("logoutBtn");

const dashboardStage = document.getElementById("dashboardStage");
const dashWelcome = document.getElementById("dashWelcome");
const dashUserMeta = document.getElementById("dashUserMeta");
const noteCount = document.getElementById("noteCount");
const linkCount = document.getElementById("linkCount");

const studyForm = document.getElementById("studyForm");
const studyList = document.getElementById("studyList");
const linkForm = document.getElementById("linkForm");
const linkList = document.getElementById("linkList");
const filterChips = document.querySelectorAll(".filter-chip");

let currentUser = null;
let activeFilter = "ALL";

/* ---------- Auth Sliding Mode ---------- */
function setAuthMode(mode) {
  const isRegister = mode === "register";
  authShell.classList.toggle("is-register", isRegister);
  mobileLoginTab.classList.toggle("active", !isRegister);
  mobileRegisterTab.classList.toggle("active", isRegister);
  clearFeedback();
}

slideToRegister.addEventListener("click", () => setAuthMode("register"));
slideToLogin.addEventListener("click", () => setAuthMode("login"));
mobileRegisterTab.addEventListener("click", () => setAuthMode("register"));
mobileLoginTab.addEventListener("click", () => setAuthMode("login"));

/* ---------- Feedback & Safe API Helper ---------- */
function showFeedback(message, type = "success") {
  feedbackBanner.textContent = message;
  feedbackBanner.className = `feedback-banner ${type}`;
}

function clearFeedback() {
  feedbackBanner.textContent = "";
  feedbackBanner.className = "feedback-banner hidden";
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Server returned HTTP ${res.status} (non-JSON). Make sure you are running on Vercel, not a static preview.`
    );
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

/* ---------- Per-User Local Storage ---------- */
function storageKey(bucket) {
  const id = currentUser?.email || "guest";
  return `netlab_${bucket}_${id}`;
}

function readBucket(bucket) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(bucket)) || "[]");
  } catch {
    return [];
  }
}

function writeBucket(bucket, items) {
  localStorage.setItem(storageKey(bucket), JSON.stringify(items));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sanitizeUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  return /^https?:\/\//i.test(trimmed) ? escapeHtml(trimmed) : "#";
}

/* ---------- Dashboard Rendering ---------- */
function renderApp() {
  if (!currentUser) {
    authStage.classList.remove("hidden");
    dashboardStage.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    sessionBadge.classList.remove("online");
    sessionStatus.textContent = "Guest Session";
    return;
  }

  authStage.classList.add("hidden");
  dashboardStage.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  sessionBadge.classList.add("online");
  sessionStatus.textContent = currentUser.username;

  dashWelcome.textContent = `Welcome, ${currentUser.username}`;
  dashUserMeta.textContent = `Signed in as ${currentUser.email} • Workspace synced locally in browser`;

  const notes = readBucket("notes");
  const links = readBucket("links");

  noteCount.textContent = String(notes.length);
  linkCount.textContent = String(links.length);

  renderNotes(notes);
  renderLinks(links);
}

function renderNotes(notes) {
  if (!notes.length) {
    studyList.innerHTML = `<li class="empty-state">No study notes yet. Add a subject and summary above.</li>`;
    return;
  }

  studyList.innerHTML = notes
    .map(
      (item, index) => `
      <li class="resource-item">
        <div class="resource-top">
          <div class="tag-group">
            <span class="pill lesson">${escapeHtml(item.subject)}</span>
            ${item.tag ? `<span class="pill-sub">${escapeHtml(item.tag)}</span>` : ""}
          </div>
          <button type="button" class="remove-btn" data-bucket="notes" data-index="${index}">Delete</button>
        </div>
        <p class="resource-body">${escapeHtml(item.notes)}</p>
      </li>`
    )
    .join("");
}

function renderLinks(links) {
  const filtered = links
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .filter((item) => activeFilter === "ALL" || item.category === activeFilter);

  if (!filtered.length) {
    linkList.innerHTML = `<li class="empty-state">No links in this category yet.</li>`;
    return;
  }

  linkList.innerHTML = filtered
    .map((item) => {
      const pillClass = item.category === "Firmware" ? "firmware" : "lesson";
      return `
      <li class="resource-item">
        <div class="resource-top">
          <div class="tag-group">
            <span class="pill ${pillClass}">${escapeHtml(item.category)}</span>
            ${item.version ? `<span class="pill-sub">${escapeHtml(item.version)}</span>` : ""}
          </div>
          <button type="button" class="remove-btn" data-bucket="links" data-index="${item.originalIndex}">Delete</button>
        </div>
        <h4 class="resource-title">${escapeHtml(item.title)}</h4>
        <a class="resource-link" href="${sanitizeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a>
      </li>`;
    })
    .join("");
}

/* ---------- Auth Form Handlers ---------- */
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFeedback();
  const payload = Object.fromEntries(new FormData(registerForm));

  registerSubmitBtn.disabled = true;
  registerSubmitBtn.textContent = "Creating Account...";

  try {
    const data = await postJson("/api/register", payload);
    registerForm.reset();
    setAuthMode("login");
    showFeedback(`Account created for ${data.user.username}. You can now sign in.`, "success");
  } catch (err) {
    showFeedback(err.message, "error");
  } finally {
    registerSubmitBtn.disabled = false;
    registerSubmitBtn.textContent = "Create Account";
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFeedback();
  const payload = Object.fromEntries(new FormData(loginForm));

  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = "Signing In...";

  try {
    const data = await postJson("/api/login", payload);
    localStorage.setItem("token", data.token);
    localStorage.setItem("netlab_user", JSON.stringify(data.user));
    currentUser = data.user;
    loginForm.reset();
    renderApp();
  } catch (err) {
    showFeedback(err.message, "error");
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = "Sign In";
  }
});

/* ---------- Dashboard Actions ---------- */
studyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const form = Object.fromEntries(new FormData(studyForm));
  const notes = readBucket("notes");
  notes.unshift({
    subject: form.subject.trim(),
    tag: form.tag.trim(),
    notes: form.notes.trim(),
  });
  writeBucket("notes", notes);
  studyForm.reset();
  renderApp();
});

linkForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const form = Object.fromEntries(new FormData(linkForm));
  const links = readBucket("links");
  links.unshift({
    category: form.category,
    version: form.version.trim(),
    title: form.title.trim(),
    url: form.url.trim(),
  });
  writeBucket("links", links);
  linkForm.reset();
  renderApp();
});

dashboardStage.addEventListener("click", (e) => {
  const removeBtn = e.target.closest(".remove-btn");
  if (!removeBtn || !currentUser) return;

  const bucket = removeBtn.dataset.bucket;
  const index = Number(removeBtn.dataset.index);
  const items = readBucket(bucket);
  items.splice(index, 1);
  writeBucket(bucket, items);
  renderApp();
});

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.filter;
    renderApp();
  });
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("netlab_user");
  currentUser = null;
  renderApp();
  showFeedback("You have been signed out.", "success");
});

/* ---------- Restore Active Session on Load ---------- */
(function initSession() {
  const savedUser = localStorage.getItem("netlab_user");
  const savedToken = localStorage.getItem("token");
  if (savedUser && savedToken) {
    try {
      currentUser = JSON.parse(savedUser);
    } catch {
      currentUser = null;
    }
  }
  renderApp();
})();
                                               
