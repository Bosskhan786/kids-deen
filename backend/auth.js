/* ============================================================
   auth.js — Authentication (email/password + Google Sign-In)
   Storage: localStorage (replace with your backend calls)
   ============================================================ */

"use strict";

const USERS_KEY   = "hk_users_v3";
const SESSION_KEY = "hk_session";

/* ---------- Storage helpers ---------- */
function getUsers()  { try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); } catch { return {}; } }
function saveUsers(u){ localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function getSession(){ return localStorage.getItem(SESSION_KEY); }
function setSession(email){ localStorage.setItem(SESSION_KEY, email); }
function clearSession()   { localStorage.removeItem(SESSION_KEY); }

/* ---------- Streak logic ---------- */
function refreshStreak(user) {
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const last      = user.lastLogin ? new Date(user.lastLogin).toDateString() : null;

  if (last === today) return user; // already logged in today
  if (last === yesterday) user.streak = (user.streak || 0) + 1;
  else                    user.streak = 1;

  user.lastLogin   = new Date().toISOString();
  user.learnedToday = false; // reset each new day
  return user;
}

/* ---------- Create / update user ---------- */
function upsertUser(email, fields) {
  const users = getUsers();
  users[email] = { ...users[email], ...fields };
  saveUsers(users);
  return users[email];
}

/* ---------- Public API ---------- */

/** Sign up with email + password */
window.handleSignup = function () {
  const name  = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim().toLowerCase();
  const pwd   = document.getElementById("signup-password").value;
  const errEl = document.getElementById("signup-error");

  const show = (msg) => { errEl.textContent = "⚠️ " + msg; errEl.classList.remove("hidden"); };
  errEl.classList.add("hidden");

  if (!name || !email || !pwd) return show("Please fill in all fields!");
  if (pwd.length < 4)          return show("Password must be at least 4 characters!");

  const users = getUsers();
  if (users[email])            return show("That email is already registered!");

  const user = {
    name, email, password: pwd,
    streak: 1, totalLearned: 0,
    lastLogin: new Date().toISOString(),
    learnedToday: false,
    joinDate: new Date().toISOString(),
    provider: "email",
  };
  upsertUser(email, user);
  setSession(email);
  window.onAuthSuccess({ ...user, password: undefined });
};

/** Login with email + password */
window.handleLogin = function () {
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const pwd   = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");

  const show = (msg) => { errEl.textContent = "⚠️ " + msg; errEl.classList.remove("hidden"); };
  errEl.classList.add("hidden");

  if (!email || !pwd) return show("Please enter your email and password!");

  // Demo shortcut
  if (email === "test@test.com" && pwd === "1234") {
    const demo = upsertUser(email, {
      name: "Demo Kid", email, password: "1234",
      streak: 0, totalLearned: 0,
      lastLogin: null, learnedToday: false,
      joinDate: new Date().toISOString(), provider: "email",
    });
    const updated = refreshStreak(demo);
    upsertUser(email, updated);
    setSession(email);
    return window.onAuthSuccess({ ...updated, password: undefined });
  }

  const users = getUsers();
  if (!users[email] || users[email].password !== pwd) return show("Wrong email or password!");

  const updated = refreshStreak(users[email]);
  upsertUser(email, updated);
  setSession(email);
  window.onAuthSuccess({ ...updated, password: undefined });
};

/* ---------- Google Sign-In callback (called by GSI SDK) ----------
   When using real Google Client ID, credential is a JWT.
   We decode the payload to get name + email (no lib needed for display fields).
   NOTE: In production you MUST verify the JWT on your backend.
   ----------------------------------------------------------------- */
window.handleGoogleCredential = function (response) {
  try {
    // JWT payload is base64url-encoded second segment
    const payload = JSON.parse(atob(response.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const email   = payload.email.toLowerCase();
    const name    = payload.given_name || payload.name || email.split("@")[0];
    const picture = payload.picture || null;

    const users   = getUsers();
    const existing = users[email];
    const base     = existing || {
      name, email,
      streak: 0, totalLearned: 0,
      lastLogin: null, learnedToday: false,
      joinDate: new Date().toISOString(),
    };
    base.provider = "google";
    base.picture  = picture;
    if (!base.password) base.password = "__google__";

    const updated = refreshStreak(base);
    upsertUser(email, updated);
    setSession(email);
    window.onAuthSuccess({ ...updated, password: undefined });
  } catch (e) {
    console.error("Google credential decode error:", e);
    alert("Google sign-in failed. Please try email login.");
  }
};

/* ---------- Fallback button (no Client ID configured) ---------- */
window.handleGoogleFallback = function () {
  // Simulate a Google login for demo purposes
  const email = "google-demo@gmail.com";
  const users  = getUsers();
  const base   = users[email] || {
    name: "Google Demo", email,
    streak: 0, totalLearned: 0,
    lastLogin: null, learnedToday: false,
    joinDate: new Date().toISOString(),
    provider: "google", picture: null,
    password: "__google__",
  };
  const updated = refreshStreak(base);
  upsertUser(email, updated);
  setSession(email);
  window.onAuthSuccess({ ...updated, password: undefined });
};

/** Logout */
window.handleLogout = function () {
  clearSession();
  window.onLogout();
};

/** Auto-login on page load */
window.tryAutoLogin = function () {
  const email = getSession();
  if (!email) return false;
  const users = getUsers();
  if (!users[email]) return false;
  const updated = refreshStreak(users[email]);
  upsertUser(email, updated);
  window.onAuthSuccess({ ...updated, password: undefined }, true /* silent */);
  return true;
};

/** Update a user field (e.g. totalLearned, learnedToday) */
window.updateCurrentUser = function (fields) {
  const email = getSession();
  if (!email) return;
  upsertUser(email, fields);
};

/** Switch between login / signup tabs */
window.switchTab = function (tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.getElementById("tab-login").classList.toggle("hidden",  tab !== "login");
  document.getElementById("tab-signup").classList.toggle("hidden", tab !== "signup");
  document.getElementById("tab-login").classList.toggle("active",  tab === "login");
  document.getElementById("tab-signup").classList.toggle("active", tab === "signup");
};
