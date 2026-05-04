/* ============================================================
   hadith.js — Live Hadith fetching, quiz, TTS, mark learned
   API: cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1 (free, no key)
   Also fetches Arabic text from the ara- counterpart edition.
   ============================================================ */

"use strict";

/* Current state */
window._hadith = null;   // { arabic, text, source, explanation, emoji, quiz }
window._quizState = { selected: null, submitted: false };

/* ---------- Fetch today's hadith from CDN API ---------- */
window.loadTodayHadith = async function () {
  const { collection, hadithNo } = getDailyHadithRef();

  // fawazahmed0 API — try both URL formats (the API has inconsistent versioning)
  const bases = [
    "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions",
    "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@latest/editions",
  ];

  const araId = collection.id.replace("eng-", "ara-");
  let engText = "", araText = "";

  // Try each base URL until we get text
  for (const base of bases) {
    if (engText) break;
    for (const fname of [`${hadithNo}.min.json`, `${hadithNo}.json`]) {
      if (engText) break;
      try {
        const [engRes, araRes] = await Promise.allSettled([
          fetch(`${base}/${collection.id}/${fname}`).then(r => r.ok ? r.json() : Promise.reject()),
          fetch(`${base}/${araId}/${fname}`).then(r => r.ok ? r.json() : Promise.reject()),
        ]);

        if (engRes.status === "fulfilled") {
          engText = extractHadithText(engRes.value);
        }
        if (araRes.status === "fulfilled") {
          araText = extractHadithText(araRes.value);
        }
      } catch (e) {
        console.warn("Hadith API fetch error:", e);
      }
    }
  }

  // Fallback if API unreachable or returned empty
  if (!engText) engText = FALLBACK_HADITHS[hadithNo % FALLBACK_HADITHS.length].text;
  if (!araText) araText = FALLBACK_HADITHS[hadithNo % FALLBACK_HADITHS.length].arabic;

  const emoji       = HADITH_EMOJIS[hadithNo % HADITH_EMOJIS.length];
  const explanation = generateKidsExplanation(engText);
  const quiz        = generateQuiz(engText, collection.name);

  window._hadith = {
    arabic: araText,
    text:   engText,
    source: `${collection.name} — #${hadithNo}`,
    explanation,
    emoji,
    quiz,
  };

  renderHadith(window._hadith);
  loadRecentHadiths(collection, hadithNo, bases[0]);
};

/* ---------- Robustly extract text from any fawazahmed0 response shape ----------
   Shapes seen in the wild:
   1. { hadith: [{ hadithnumber, text, ... }] }
   2. { hadiths: [{ hadithnumber, body, ... }] }
   3. { [hadithNo]: { body: "..." } }  (keyed by number)
   ---------------------------------------------------------------- */
function extractHadithText(d) {
  if (!d) return "";
  // Shape 1 & 2 — array under "hadith" or "hadiths"
  const arr = d.hadiths || d.hadith || [];
  if (Array.isArray(arr) && arr.length > 0) {
    const h = arr[0];
    const raw = h.body || h.text || h.content || "";
    return raw.trim().replace(/\s+/g, " ");
  }
  // Shape 3 — object keyed by hadith number
  const vals = Object.values(d);
  for (const v of vals) {
    if (typeof v === "object" && v !== null) {
      const raw = v.body || v.text || v.content || "";
      if (raw) return raw.trim().replace(/\s+/g, " ");
    }
    if (typeof v === "string" && v.length > 10) {
      return v.trim().replace(/\s+/g, " ");
    }
  }
  return "";
}

/* ---------- Render hadith card ---------- */
function decodeHtml(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

function renderHadith(h) {
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("hadith-content").classList.remove("hidden");

  document.getElementById("hadith-emoji").textContent        = h.emoji;
  document.getElementById("hadith-arabic").textContent       = h.arabic || "";
  document.getElementById("hadith-text").textContent         = decodeHtml(h.text);
  document.getElementById("hadith-explanation").textContent  = h.explanation;
  document.getElementById("hadith-source-label").textContent = h.source;
}

/* ---------- Load 3 recent hadiths for the strip ---------- */
async function loadRecentHadiths(col, todayNo, base) {
  const nos = [
    Math.max(1, todayNo - 1),
    Math.max(1, todayNo - 2),
    Math.max(1, todayNo - 3),
  ];
  const results = [];
  for (const no of nos) {
    try {
      const r = await fetch(`${base}/${col.id}/${no}.min.json`);
      if (!r.ok) continue;
      const d = await r.json();
      const txt = extractHadithText(d);
      if (txt) results.push({ no, text: decodeHtml(txt), source: col.name });
    } catch { /* skip */ }
  }

  // Fallback
  while (results.length < 3) {
    const fb = FALLBACK_HADITHS[results.length];
    results.push({ no: results.length + 1, text: fb.text, source: fb.source });
  }

  renderRecent(results);
}

function renderRecent(list) {
  const el = document.getElementById("recent-hadiths");
  el.innerHTML = list.map((h, i) => `
    <div class="recent-item">
      <span class="recent-emoji">${HADITH_EMOJIS[(h.no || i + 5) % HADITH_EMOJIS.length]}</span>
      <div>
        <div class="recent-text">${truncate(h.text, 70)}</div>
        <div class="recent-src">${h.source}</div>
      </div>
    </div>
  `).join("");
}

/* ---------- Kids-friendly explanation generator ----------
   Takes the raw hadith text and wraps it with a simple comment.
   In production you'd call an LLM endpoint here.              */
function generateKidsExplanation(text) {
  const t = text.toLowerCase();
  if (t.includes("intention") || t.includes("niyyah"))
    return "Whatever you do, what matters most is WHY you do it. If you help a friend because you truly care, that's beautiful! Allah looks at your heart, not just your actions. 💛";
  if (t.includes("tongue") || t.includes("hand"))
    return "Being a good Muslim means people feel safe around you — never hurt them with words or actions. Kind words are like sunshine! ☀️";
  if (t.includes("clean") || t.includes("purif") || t.includes("wash"))
    return "Keeping yourself clean — washing hands, brushing teeth, staying tidy — is a BIG part of being a good Muslim. Cleanliness is next to godliness! 🧼";
  if (t.includes("quran") || t.includes("qur"))
    return "Learning your Quran is amazing — but teaching it to others makes you even better! Share what you learn with friends and family. 📖";
  if (t.includes("character") || t.includes("manners") || t.includes("righteous"))
    return "Being truly good isn't just about praying — it's about HOW you treat people. Smile, be patient, be honest, and always be kind! 😊";
  if (t.includes("thank") || t.includes("grateful") || t.includes("gratit"))
    return "Saying 'Thank you!' is not just polite — it's part of your faith! When you're grateful to people who help you, you're also grateful to Allah. 🙏";
  if (t.includes("paradise") || t.includes("jannah"))
    return "Paradise is the most beautiful place — better than anything we can imagine! Allah rewards those who do good with a place in Jannah. 🌸";
  if (t.includes("mercy") || t.includes("merciful"))
    return "Allah is the Most Merciful. He forgives us when we make mistakes and loves us more than anyone. Always ask for His mercy! ❤️";
  if (t.includes("smile") || t.includes("smil"))
    return "Even a smile is a charity! Small acts of kindness — like smiling at someone — can make a huge difference to their day. 😊";
  if (t.includes("neighbour") || t.includes("neighbor"))
    return "Being a great neighbour — helping them, being kind, sharing — is an important part of Islam. Treat those near you with love! 🏠";
  if (t.includes("prayer") || t.includes("salah") || t.includes("pray"))
    return "Prayer is the first thing Allah will ask us about. It keeps us close to Him — like a daily conversation with your best Friend! 🌙";
  if (t.includes("honest") || t.includes("truth") || t.includes("lie"))
    return "Always tell the truth! Honesty is one of the most beautiful qualities. The Prophet ﷺ was known as Al-Amin — The Trustworthy. ✅";
  return `This beautiful Hadith from our Prophet Muhammad ﷺ teaches us how to be better Muslims. Read it, understand it, and try to live by it every day! ✨`;
}

/* ---------- Simple auto-quiz generator ---------- */
function generateQuiz(text, source) {
  const t = text.toLowerCase();
  if (t.includes("intention"))
    return { question:"What matters most when doing a good deed?", options:["Looking nice","Your intention","Being fast","Being strong"], answer:1 };
  if (t.includes("tongue") || t.includes("hand"))
    return { question:"A good Muslim makes others safe from their…", options:["Cooking","Tongue and hands","Games","Money"], answer:1 };
  if (t.includes("clean") || t.includes("purif"))
    return { question:"Cleanliness is how much of our faith?", options:["A quarter","Half","All of it","None"], answer:1 };
  if (t.includes("smile"))
    return { question:"Smiling at someone is a type of…", options:["Punishment","Charity","Joke","Nothing"], answer:1 };
  if (t.includes("paradise") || t.includes("jannah"))
    return { question:"What do good deeds lead to?", options:["More money","Paradise (Jannah)","Fame","Sleep"], answer:1 };
  if (t.includes("prayer") || t.includes("salah"))
    return { question:"What does this Hadith emphasise?", options:["Sports","Prayer (Salah)","Food","Homework"], answer:1 };
  if (t.includes("honest") || t.includes("truth"))
    return { question:"The Prophet ﷺ was known as Al-Amin, meaning…", options:["The Fast","The Trustworthy","The Strong","The Rich"], answer:1 };
  // Generic fallback
  return { question:"This Hadith is from which great source?", options:["A made-up story","Authentic Sunnah","A poem","A newspaper"], answer:1 };
}

/* ---------- Quiz rendering ---------- */
window.showQuiz = function () {
  if (!window._hadith) return;
  window._quizState = { selected: null, submitted: false };
  const q = window._hadith.quiz;
  const area = document.getElementById("quiz-area");
  area.classList.remove("hidden");
  document.getElementById("btn-quiz").classList.add("hidden");
  // Reset any previous result banner
  const banner = document.getElementById("quiz-result-banner");
  banner.classList.add("hidden");
  banner.classList.remove("correct", "wrong");
  renderQuizUI(q);
};

function renderQuizUI(q) {
  const area = document.getElementById("quiz-area");
  area.innerHTML = `
    <div class="quiz-question">🧠 ${q.question}</div>
    <div class="quiz-options">
      ${q.options.map((opt, i) => `
        <button class="quiz-option" data-index="${i}" onclick="selectOption(${i})">
          ${["A","B","C","D"][i]}. ${opt}
        </button>
      `).join("")}
    </div>
    <button class="quiz-submit" id="quiz-submit-btn" disabled onclick="submitQuiz()">
      Submit Answer! 🚀
    </button>
  `;
}

window.selectOption = function (i) {
  if (window._quizState.submitted) return;
  window._quizState.selected = i;
  document.querySelectorAll(".quiz-option").forEach((el, idx) => {
    el.classList.toggle("selected", idx === i);
  });
  document.getElementById("quiz-submit-btn").disabled = false;
};

window.submitQuiz = function () {
  const { selected } = window._quizState;
  if (selected === null) return;
  window._quizState.submitted = true;
  const correct = window._hadith.quiz.answer;
  document.querySelectorAll(".quiz-option").forEach((el, i) => {
    el.classList.remove("selected");
    if (i === correct)  el.classList.add("correct");
    if (i === selected && i !== correct) el.classList.add("wrong");
  });
  document.getElementById("quiz-submit-btn").disabled = true;
  setTimeout(() => {
    const banner = document.getElementById("quiz-result-banner");
    banner.classList.remove("hidden", "correct", "wrong");
    if (selected === correct) {
      banner.textContent = "🎉 Correct! Amazing work!";
      banner.classList.add("correct");
    } else {
      banner.textContent = "😊 Good try! Keep learning!";
      banner.classList.add("wrong");
    }
    document.getElementById("quiz-area").classList.add("hidden");
    document.getElementById("btn-quiz").classList.remove("hidden");
  }, 1200);
};

/* ---------- Full Hadith Modal ---------- */
window.openHadithModal = function () {
  const h = window._hadith;
  if (!h) return;

  document.getElementById("modal-source").textContent      = h.source;
  document.getElementById("modal-emoji").textContent       = h.emoji;
  document.getElementById("modal-arabic").textContent      = h.arabic || "";
  document.getElementById("modal-text").textContent        = decodeHtml(h.text);
  document.getElementById("modal-explanation").textContent = h.explanation;

  const overlay = document.getElementById("hadith-modal-overlay");
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // prevent background scroll
};

window.closeHadithModal = function (e) {
  // Close only if clicking the overlay backdrop or the close button (not the box itself)
  if (e && e.target !== document.getElementById("hadith-modal-overlay") && !e.target.classList.contains("modal-close-btn")) return;
  document.getElementById("hadith-modal-overlay").classList.add("hidden");
  document.body.style.overflow = "";
};

// Also close on Escape key
document.addEventListener("keydown", e => {
  if (e.key === "Escape") window.closeHadithModal({ target: document.getElementById("hadith-modal-overlay") });
});


window.markLearned = function () {
  const btn = document.getElementById("btn-learned");
  if (btn.classList.contains("done")) return;
  btn.textContent = "✅ Learned!";
  btn.classList.add("done");

  // Update user
  const users = JSON.parse(localStorage.getItem("hk_users_v3") || "{}");
  const email  = localStorage.getItem("hk_session");
  if (email && users[email] && !users[email].learnedToday) {
    users[email].totalLearned  = (users[email].totalLearned || 0) + 1;
    users[email].learnedToday  = true;
    localStorage.setItem("hk_users_v3", JSON.stringify(users));
    // Update in-memory user
    if (window._currentUser) {
      window._currentUser.totalLearned = users[email].totalLearned;
      window._currentUser.learnedToday = true;
    }
  }
};

/* ---------- Text-to-speech ---------- */
window.speakHadith = function () {
  if (!window.speechSynthesis || !window._hadith) return;
  const btn = document.getElementById("btn-listen");
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    btn.textContent = "🔊 Listen";
    btn.classList.remove("speaking");
    return;
  }
  const text = `${window._hadith.text}. ${window._hadith.explanation}`;
  const utt  = new SpeechSynthesisUtterance(text);
  utt.rate = 0.88; utt.pitch = 1.08;
  utt.onstart = () => { btn.textContent = "🔇 Stop"; btn.classList.add("speaking"); };
  utt.onend   = () => { btn.textContent = "🔊 Listen"; btn.classList.remove("speaking"); };
  speechSynthesis.speak(utt);
};

/* ---------- Helpers ---------- */
function truncate(str, max) { return str.length <= max ? str : str.slice(0, max).trimEnd() + "…\""; }

/* ---------- Offline fallbacks ---------- */
window.FALLBACK_HADITHS = [
  { arabic:"إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ", text:"Actions are judged by their intentions.", source:"Bukhari & Muslim" },
  { arabic:"الطَّهُورُ شَطْرُ الْإِيمَانِ", text:"Cleanliness is half of faith.", source:"Sahih Muslim" },
  { arabic:"الْبِرُّ حُسْنُ الْخُلُقِ", text:"Righteousness is good character.", source:"Sahih Muslim" },
  { arabic:"مَنْ لَا يَشْكُرُ النَّاسَ لَا يَشْكُرُ اللَّهَ", text:"Whoever does not thank people has not thanked Allah.", source:"Abu Dawud" },
  { arabic:"خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ", text:"The best of you is the one who learns and teaches the Quran.", source:"Sahih Bukhari" },
  { arabic:"التَّبَسُّمُ فِي وَجْهِ أَخِيكَ صَدَقَةٌ", text:"Smiling at your brother is a form of charity.", source:"Tirmidhi" },
  { arabic:"الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ", text:"A Muslim is one from whose tongue and hands other Muslims are safe.", source:"Sahih Bukhari" },
];