/* ============================================================
   app.js — Main controller: boot, view switching, dashboard
   ============================================================ */

"use strict";

window._currentUser = null;

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  generateStars();
  setHeaderDate();

  // Try auto-login from previous session
  if (!tryAutoLogin()) {
    showScreen("auth-screen");
  }
});

/* ============================================================
   AUTH CALLBACKS (called from auth.js)
   ============================================================ */
window.onAuthSuccess = function (user, silent = false) {
  window._currentUser = user;
  showScreen("main-screen");
  renderHeader(user);
  if (!silent && user.streak >= 3) showStreakBanner(user.streak);
  switchView("hadith");
  loadTodayHadith();

  // Restore "learned today" button state
  if (user.learnedToday) {
    const btn = document.getElementById("btn-learned");
    if (btn) { btn.textContent = "✅ Learned!"; btn.classList.add("done"); }
  }
};

window.onLogout = function () {
  window._currentUser = null;
  speechSynthesis && speechSynthesis.cancel();
  showScreen("auth-screen");
};

/* ============================================================
   SCREEN SWITCHING
   ============================================================ */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
    s.classList.add("hidden");
  });
  const el = document.getElementById(id);
  el.classList.remove("hidden");
  el.classList.add("active");
}

/* ============================================================
   VIEW SWITCHING (hadith / dashboard)
   ============================================================ */
window.switchView = function (viewId) {
  document.querySelectorAll(".view").forEach(v => {
    v.classList.remove("active");
    v.classList.add("hidden");
  });
  const target = document.getElementById("view-" + viewId);
  target.classList.remove("hidden");
  target.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.view === viewId);
  });

  if (viewId === "dashboard") renderDashboard();
};

/* ============================================================
   HEADER
   ============================================================ */
function renderHeader(user) {
  // Avatar
  const av = document.getElementById("header-avatar");
  if (user.picture) {
    av.style.backgroundImage = `url(${user.picture})`;
    av.style.backgroundSize  = "cover";
    av.textContent = "";
  } else {
    av.style.background = avatarColor(user.name);
    av.textContent = (user.name || "?")[0].toUpperCase();
  }

  // Streak pill
  if (user.streak > 0) {
    document.getElementById("streak-count").textContent = user.streak;
    document.getElementById("streak-pill").classList.remove("hidden");
  }
}

function setHeaderDate() {
  const el = document.getElementById("header-date");
  if (!el) return;
  el.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

/* ============================================================
   STREAK BANNER
   ============================================================ */
function showStreakBanner(n) {
  const b = document.getElementById("streak-banner");
  b.innerHTML = `🔥 ${n}-Day Streak! 🔥<br><span style="font-size:.8rem;font-weight:400;font-family:var(--font-body);color:rgba(255,255,255,.8)">${streakMsg(n)}</span>`;
  b.classList.remove("hidden");
  setTimeout(() => b.classList.add("hidden"), 5000);
}

function streakMsg(n) {
  if (n >= 30) return "You're a Hadith Master! 🌟";
  if (n >= 14) return "You're a Scholar! Incredible! 📚";
  if (n >= 7)  return "You're an Explorer! Keep going! 🔭";
  return "Great start! Keep the streak alive! 🌱";
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  const u = window._currentUser;
  if (!u) return;

  // Avatar
  const av = document.getElementById("dash-avatar");
  if (u.picture) {
    av.style.backgroundImage = `url(${u.picture})`;
    av.style.backgroundSize  = "cover";
    av.textContent = "";
  } else {
    av.style.background = avatarColor(u.name);
    av.textContent = (u.name || "?")[0].toUpperCase();
  }

  document.getElementById("dash-greeting").textContent = `Assalamu Alaikum, ${u.name || "Friend"}! 👋`;

  // Re-read fresh from storage so totalLearned is accurate
  const email = localStorage.getItem("hk_session");
  const users = JSON.parse(localStorage.getItem("hk_users_v3") || "{}");
  const fresh = (email && users[email]) ? users[email] : u;

  const streak      = fresh.streak       || 0;
  const totalLearned= fresh.totalLearned || 0;
  const earned      = BADGES.filter(b => streak >= b.days);

  document.getElementById("stat-streak").textContent  = streak + " 🔥";
  document.getElementById("stat-learned").textContent = totalLearned + " 📖";
  document.getElementById("stat-badges").textContent  = earned.length + " 🏅";

  // Next badge progress
  const next = BADGES.find(b => streak < b.days);
  const nbArea = document.getElementById("next-badge-area");
  if (next) {
    const pct = Math.min(100, Math.round((streak / next.days) * 100));
    nbArea.innerHTML = `
      <div class="next-badge-label">Next: ${next.emoji} ${next.name} (${streak}/${next.days} days)</div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${pct}%;background:${next.color};color:${next.color}">
          <div class="progress-knob"></div>
        </div>
      </div>
    `;
  } else {
    nbArea.innerHTML = `<div class="next-badge-label" style="color:#FFD700;font-weight:700">🌟 All badges earned! You're a Hadith Master!</div>`;
  }

  // Badges grid
  const grid = document.getElementById("badges-grid");
  grid.innerHTML = BADGES.map(b => {
    const isEarned = streak >= b.days;
    const pct = Math.min(100, Math.round((streak / b.days) * 100));
    return `
      <div class="badge-card ${isEarned ? "earned" : "locked"}" style="${isEarned ? `border-color:${b.color};background:${b.color}18` : ""}">
        <div class="badge-emoji">${b.emoji}</div>
        <div class="badge-name" style="color:${isEarned ? b.color : "rgba(255,255,255,.6)"}">${b.name}</div>
        <div class="badge-desc">${b.desc}</div>
        ${isEarned
          ? `<div class="badge-earned-label" style="color:${b.color}">✓ Earned!</div>`
          : `<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%;background:${b.color}"></div></div>`
        }
      </div>
    `;
  }).join("");
}

/* ============================================================
   STAR BACKGROUND
   ============================================================ */
function generateStars() {
  const container = document.getElementById("stars-bg");
  const count = 28;
  for (let i = 0; i < count; i++) {
    const star = document.createElement("div");
    star.className = "star";
    const size  = Math.random() * 2.5 + 1;
    star.style.cssText = `
      left:${Math.random()*100}%;
      top:${Math.random()*100}%;
      width:${size}px; height:${size}px;
      --dur:${(Math.random()*3+2).toFixed(1)}s;
      --delay:${(Math.random()*4).toFixed(1)}s;
    `;
    container.appendChild(star);
  }
}