/* ============================================================
   data.js — Static app data (badges, emoji pool, avatar colours)
   Hadiths are fetched live from the free fawazahmed0 CDN API.
   ============================================================ */

"use strict";

/* ---------- Badge definitions ---------- */
window.BADGES = [
  { id: "beginner", name: "Beginner",      emoji: "🌱", days: 3,  color: "#4CAF50", desc: "3-day streak"  },
  { id: "explorer", name: "Explorer",      emoji: "🔭", days: 7,  color: "#2196F3", desc: "7-day streak"  },
  { id: "scholar",  name: "Scholar",       emoji: "📚", days: 14, color: "#9C27B0", desc: "14-day streak" },
  { id: "master",   name: "Hadith Master", emoji: "⭐", days: 30, color: "#FF9800", desc: "30-day streak" },
];

/* ---------- Emoji pool for hadiths ----------
   Rotated based on hadith number so each day feels different. */
window.HADITH_EMOJIS = ["💛","🤝","❤️","🧼","📖","😊","🙏","🌙","✨","🌿","🕌","🌸","💫","🌟","🌈","🦋","🌺","🕊️","🌻","💎"];

/* ---------- Avatar colours ---------- */
window.AVATAR_COLORS = [
  "#FF6B6B","#4ECDC4","#45B7D1","#96CEB4",
  "#FFEAA7","#DDA0DD","#98D8C8","#F7DC6F",
  "#82E0AA","#85C1E9",
];

/* ---------- Hadith API config ----------
   Source: github.com/fawazahmed0/hadith-api (MIT, no key needed)
   Multiple collections used so the user sees variety across days.
   Total pool: ~5000+ hadiths; day-of-year index picks one daily.
   ------------------------------------------------------------ */
window.HADITH_COLLECTIONS = [
  { id: "eng-bukhari",    name: "Sahih al-Bukhari",  count: 7563 },
  { id: "eng-muslim",     name: "Sahih Muslim",       count: 7453 },
  { id: "eng-abudawud",   name: "Sunan Abu Dawud",    count: 5274 },
  { id: "eng-tirmidhi",   name: "Jami at-Tirmidhi",   count: 3956 },
  { id: "eng-nawawi40",   name: "Forty Hadith Nawawi", count: 42   },
  { id: "eng-ibnmajah",   name: "Sunan Ibn Majah",    count: 4341 },
];

/* Pick a collection + hadith number deterministically from today's date.
   Changes every day; same date always shows same hadith. */
window.getDailyHadithRef = function () {
  const now   = new Date();
  const year  = now.getFullYear();
  const start = new Date(year, 0, 0);
  const diff  = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay); // 1-365

  // Rotate collection each week
  const colIndex = Math.floor(dayOfYear / 7) % HADITH_COLLECTIONS.length;
  const col      = HADITH_COLLECTIONS[colIndex];

  // Hadith number within collection
  const hadithNo = (dayOfYear % Math.min(col.count, 300)) + 1;

  return { collection: col, hadithNo };
};

/* ---------- Recent history list (last 5 loaded) ---------- */
window.recentHadiths = [];

/* ---------- Colour helper for avatar ---------- */
window.avatarColor = function (name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
};

/* ---------- Day-of-year helper (re-export) ---------- */
window.dayOfYear = function () {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
};