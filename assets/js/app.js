/* Space Explorer · PRJ-09 M1 prototype
   Offline-first, touch-first lesson player. No external dependencies. */
(function () {
  "use strict";

  var view = document.getElementById("view");
  var routeStatus = document.getElementById("route-status");
  var toastEl = document.getElementById("toast");
  var confettiLayer = document.getElementById("confetti-layer");
  var ttsBanner = document.getElementById("tts-banner");
  var wordTip = document.getElementById("word-tip");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var GAME_LABEL = {
    balloon_pop: "Bóng bay",
    boss_battle: "Đấu Boss",
    memory_match: "Ghép cặp",
    detective_cloze: "Thám tử",
    listen_tap: "Nghe & chạm"
  };
  var SKILL_LABEL = {
    vocabulary: "Từ vựng",
    grammar: "Ngữ pháp",
    reading: "Đọc hiểu",
    listening: "Nghe"
  };
  var POS_LABEL = {
    noun: "danh từ",
    verb: "động từ",
    adjective: "tính từ",
    adverb: "trạng từ",
    preposition: "giới từ",
    pronoun: "đại từ",
    conjunction: "liên từ",
    determiner: "từ hạn định",
    interjection: "thán từ",
    phrase: "cụm từ"
  };
  var STORE_KEY = "set.prj09.progress.v1";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function icon(name, cls) {
    return '<svg class="icon ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  function normWord(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z\u00c0-\u024f' -]/g, "")
      .trim();
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function yesterdayKey() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function pct(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  /* ---------------- progress store ---------------- */

  function defaultProgress() {
    return {
      xp: 0,
      stars: 0,
      streak: 0,
      lastActiveDay: null,
      remembered: {},
      review: {},
      answered: {},
      lastLesson: null
    };
  }

  function loadProgress() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return defaultProgress();
      var parsed = JSON.parse(raw);
      var base = defaultProgress();
      Object.keys(base).forEach(function (key) {
        if (typeof parsed[key] === typeof base[key] || (base[key] === null && parsed[key] !== undefined)) {
          base[key] = parsed[key] == null && base[key] !== null ? base[key] : parsed[key];
        }
      });
      ["remembered", "review", "answered"].forEach(function (key) {
        if (!base[key] || typeof base[key] !== "object") base[key] = {};
      });
      return base;
    } catch (err) {
      return defaultProgress();
    }
  }

  var progress = loadProgress();

  function saveProgress() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(progress));
    } catch (err) {
      toast("Không lưu được tiến độ trên thiết bị này.");
    }
  }

  function touchStreak() {
    var today = todayKey();
    if (progress.lastActiveDay === today) return;
    progress.streak = progress.lastActiveDay === yesterdayKey() ? (progress.streak || 0) + 1 : 1;
    progress.lastActiveDay = today;
  }

  function award(xp, stars) {
    touchStreak();
    progress.xp += xp || 0;
    progress.stars += stars || 0;
    saveProgress();
  }

  /* ---------------- toast / confetti ---------------- */

  var toastTimer = null;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 2400);
  }

  function burstConfetti() {
    if (!confettiLayer || reduceMotion) return;
    var colors = ["#06b6d4", "#fbbf24", "#f97316", "#22c55e", "#fb7185", "#a5f3fc"];
    for (var i = 0; i < 26; i += 1) {
      var piece = document.createElement("span");
      piece.className = "confetti";
      piece.style.setProperty("--x", 42 + Math.random() * 16 + "%");
      piece.style.setProperty("--c", colors[i % colors.length]);
      piece.style.setProperty("--delay", (Math.random() * 0.14).toFixed(2) + "s");
      piece.style.setProperty("--rot", Math.round(Math.random() * 180) + "deg");
      piece.style.setProperty("--drift", Math.round((Math.random() - 0.5) * 220) + "px");
      confettiLayer.appendChild(piece);
      window.setTimeout(function (node) {
        return function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        };
      }(piece), 1500);
    }
  }

  /* ---------------- speech ---------------- */

  var TTS = (function () {
    var supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    var voices = [];
    var preferred = null;
    var rate = 1;

    function pickVoice() {
      if (!supported) return;
      voices = window.speechSynthesis.getVoices() || [];
      var english = voices.filter(function (v) {
        return /^en(-|_)/i.test(v.lang || "");
      });
      var preferredNames = ["Samantha", "Daniel", "Google UK English Female", "Google US English", "Microsoft Aria", "Microsoft Jenny"];
      preferred = null;
      for (var i = 0; i < preferredNames.length && !preferred; i += 1) {
        preferred = english.filter(function (v) {
          return (v.name || "").indexOf(preferredNames[i]) !== -1;
        })[0] || null;
      }
      if (!preferred) {
        preferred = english.filter(function (v) {
          return /en-GB/i.test(v.lang || "");
        })[0] || english[0] || null;
      }
    }

    if (supported) {
      pickVoice();
      if (typeof window.speechSynthesis.addEventListener === "function") {
        window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
      } else {
        window.speechSynthesis.onvoiceschanged = pickVoice;
      }
    }

    function speak(text, options) {
      if (!supported || !text) return null;
      options = options || {};
      try {
        window.speechSynthesis.cancel();
        var utter = new window.SpeechSynthesisUtterance(String(text));
        utter.lang = (preferred && preferred.lang) || "en-US";
        if (preferred) utter.voice = preferred;
        utter.rate = options.rate || rate;
        utter.pitch = 1.05;
        if (typeof options.onStart === "function") utter.onstart = options.onStart;
        if (typeof options.onEnd === "function") utter.onend = options.onEnd;
        if (typeof options.onError === "function") utter.onerror = options.onError;
        if (typeof options.onBoundary === "function") utter.onboundary = options.onBoundary;
        window.speechSynthesis.speak(utter);
        return utter;
      } catch (err) {
        showBanner();
        return null;
      }
    }

    function stop() {
      if (supported) {
        try {
          window.speechSynthesis.cancel();
        } catch (err) {
          /* noop */
        }
      }
    }

    function setRate(next) {
      rate = next === 0.75 ? 0.75 : 1;
      return rate;
    }

    return {
      supported: supported,
      speak: speak,
      stop: stop,
      setRate: setRate,
      getRate: function () {
        return rate;
      }
    };
  })();

  function showBanner() {
    if (ttsBanner) ttsBanner.hidden = false;
  }
  if (!TTS.supported && ttsBanner) ttsBanner.hidden = false;

  /* ---------------- data ---------------- */

  var MODEL = { lessons: [], source: "loading" };

  function normalizeLesson(raw) {
    if (!raw || typeof raw !== "object") return null;
    var vocab = Array.isArray(raw.vocabulary) ? raw.vocabulary : [];
    var grammar = Array.isArray(raw.grammar_patterns) ? raw.grammar_patterns : [];
    var readings = Array.isArray(raw.reading_dialogues) ? raw.reading_dialogues : [];
    var quiz = Array.isArray(raw.quiz_bank) ? raw.quiz_bank : [];
    var objectives = (raw.learning_objectives || []).map(function (item) {
      if (typeof item === "string") return item;
      return item.text_vi || item.text_en || "";
    }).filter(Boolean);

    return {
      id: raw.lesson_id || raw.id || "lesson",
      grade: raw.grade_level || 4,
      cefr: raw.cefr || "A1",
      unit: raw.unit || "",
      title: raw.title || "Lesson",
      titleVi: raw.title_vi || raw.subtitle_vi || "",
      subtitleVi: raw.subtitle_vi || raw.title_vi || "",
      minutes: raw.estimated_minutes || 15,
      sourcePdf: raw.source_pdf || null,
      objectives: objectives,
      vocabulary: vocab,
      grammar: grammar,
      readings: readings,
      quiz: quiz,
      metadata: raw.metadata || {}
    };
  }

  function setData(payload, source) {
    var list = [];
    if (Array.isArray(payload)) list = payload;
    else if (payload && Array.isArray(payload.lessons)) list = payload.lessons;
    else if (payload && (payload.lesson_id || payload.id)) list = [payload];
    MODEL.lessons = list.map(normalizeLesson).filter(Boolean);
    MODEL.source = source;
  }

  function loadData() {
    if (!/^https?:$/.test(window.location.protocol) && window.SET_FALLBACK_DATA) {
      setData(window.SET_FALLBACK_DATA, "embedded");
      return Promise.resolve();
    }
    return fetch("assets/data/lessons.json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (payload) {
        setData(payload, "json");
      })
      .catch(function () {
        var fallback = window.SET_FALLBACK_DATA;
        if (fallback) setData(fallback, "embedded");
      });
  }

  function lessonById(id) {
    return MODEL.lessons.filter(function (lesson) {
      return lesson.id === id;
    })[0] || null;
  }

  function countRemembered(lesson) {
    return lesson.vocabulary.filter(function (item) {
      return !!progress.remembered[lesson.id + ":" + item.id];
    }).length;
  }

  function findMeaning(lesson, word) {
    var key = normWord(word);
    if (!key) return null;
    for (var i = 0; i < lesson.vocabulary.length; i += 1) {
      var item = lesson.vocabulary[i];
      if (normWord(item.word) === key) return item;
    }
    for (var j = 0; j < lesson.vocabulary.length; j += 1) {
      var candidate = lesson.vocabulary[j];
      if (key.length > 3 && normWord(candidate.word).indexOf(key) !== -1) return candidate;
    }
    return null;
  }

  /* ---------------- view lifecycle ---------------- */

  var cleanupTasks = [];
  var currentRoute = null;
  var ui = { vocabIndex: 0, quizIndex: 0, quizCorrect: 0, quizXp: 0, quizAnswered: false, readToken: 0 };

  function onCleanup(fn) {
    cleanupTasks.push(fn);
  }

  function cleanup() {
    TTS.stop();
    hideWordTip();
    cleanupTasks.forEach(function (fn) {
      try {
        fn();
      } catch (err) {
        /* noop */
      }
    });
    cleanupTasks = [];
  }

  function setView(html) {
    view.innerHTML = html;
  }

  function setTitle(title) {
    document.title = title ? title + " · Vũ trụ Khám phá" : "Vũ trụ Khám phá · Space Explorer";
  }

  function announce(text) {
    if (routeStatus) routeStatus.textContent = text;
  }

  /* ---------------- word tooltip ---------------- */

  function showWordTip(target, payload) {
    if (!wordTip) return;
    $(".word-tip__word", wordTip).textContent = payload.word;
    $(".word-tip__meaning", wordTip).textContent = payload.meaning;
    $(".word-tip__sub", wordTip).textContent = payload.sub || "";
    var rect = target.getBoundingClientRect();
    var below = rect.top < 110;
    wordTip.classList.toggle("word-tip--below", below);
    wordTip.style.left = clamp(rect.left + rect.width / 2, 150, window.innerWidth - 150) + "px";
    wordTip.style.top = (below ? rect.bottom + 12 : rect.top - 12) + "px";
    wordTip.hidden = false;
  }

  function hideWordTip() {
    if (wordTip) wordTip.hidden = true;
  }

  /* ---------------- starfield ---------------- */

  (function starfield() {
    var canvas = document.getElementById("starfield");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var stars = [];
    var raf = null;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = window.innerWidth < 700 ? 44 : 68;
      stars = [];
      for (var i = 0; i < count; i += 1) {
        stars.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          r: Math.random() * 1.6 + 0.4,
          a: Math.random() * 0.6 + 0.2,
          speed: Math.random() * 0.006 + 0.002,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (var i = 0; i < stars.length; i += 1) {
        var s = stars[i];
        var alpha = reduceMotion ? s.a : s.a + Math.sin(t * s.speed + s.phase) * 0.18;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(226, 232, 240, " + clamp(alpha, 0.08, 0.9).toFixed(3) + ")";
        ctx.fill();
      }
      if (!reduceMotion) raf = window.requestAnimationFrame(draw);
    }

    resize();
    draw(0);
    window.addEventListener("resize", function () {
      resize();
      draw(0);
    });
  })();

  /* ---------------- home ---------------- */

  function renderHome() {
    setTitle("Bài học");
    var totalVocab = MODEL.lessons.reduce(function (sum, lesson) {
      return sum + lesson.vocabulary.length;
    }, 0);
    var learned = MODEL.lessons.reduce(function (sum, lesson) {
      return sum + countRemembered(lesson);
    }, 0);

    var cards = MODEL.lessons.map(function (lesson) {
      var remembered = countRemembered(lesson);
      var percent = pct(remembered, lesson.vocabulary.length);
      return (
        '<a class="card lesson-card" href="#/lesson/' + encodeURIComponent(lesson.id) + '">' +
        '<div class="lesson-card__head">' +
        '<span class="lesson-emblem">' + icon("book") + "</span>" +
        "<div>" +
        '<div class="lesson-card__unit">' + esc(lesson.unit || "Bài học") + "</div>" +
        '<h3 class="lesson-card__title">' + esc(lesson.title) + "</h3>" +
        '<p class="lesson-card__sub">' + esc(lesson.subtitleVi || "Cùng phi hành gia nhí khám phá tiếng Anh.") + "</p>" +
        "</div>" +
        "</div>" +
        '<div class="meta-row">' +
        '<span class="chip chip--cyan">' + icon("target") + "Lớp " + esc(lesson.grade) + "</span>" +
        '<span class="chip">' + esc(lesson.cefr) + "</span>" +
        '<span class="chip">' + icon("bolt") + esc(lesson.minutes) + " phút</span>" +
        '<span class="chip chip--star">' + icon("star") + esc(lesson.vocabulary.length) + " từ</span>" +
        "</div>" +
        '<div class="progress-line">' +
        '<div class="progress-line__top"><span>Đã nhớ</span><strong>' + remembered + "/" + lesson.vocabulary.length + "</strong></div>" +
        '<div class="progress-track"><span class="progress-track__fill" style="width:' + percent + '%"></span></div>' +
        "</div>" +
        '<div class="cta-row"><span class="btn btn--primary btn--wide">Vào học ' + icon("arrow-right") + "</span></div>" +
        "</a>"
      );
    }).join("");

    if (!cards) {
      cards =
        '<div class="card empty-state">' + icon("compass", "icon--lg") +
        '<h2 class="empty-state__title">Chưa có bài học</h2>' +
        "<p>Kho bài học đang trống. Ở M4, bố mẹ sẽ nạp PDF trong Góc Phụ Huynh để tạo bài mới.</p>" +
        "</div>";
    }

    setView(
      '<section class="hero">' +
      '<div class="hero__copy">' +
      '<div class="hero__badges"><span class="proto-badge">' + icon("rocket") + "M1 PROTOTYPE · PRJ-09</span>" +
      '<span class="chip chip--cyan">Offline-first</span><span class="chip chip--star">Touch-first</span></div>' +
      '<h1 class="hero__title">Học tiếng Anh cùng Vũ trụ Khám phá</h1>' +
      '<p class="hero__sub">Chạm để lật thẻ, nghe phát âm và chơi thử thám tử từ vựng. Mọi thao tác đều bằng chạm, không cần gõ bàn phím.</p>' +
      '<div class="btn-row"><a class="btn btn--primary" href="#/design">Xem Design System ' + icon("palette") + "</a>" +
      '<a class="btn btn--outline" href="#/home" id="hero-start">Chọn bài học ' + icon("book") + "</a></div>" +
      "</div>" +
      '<div class="hero__art" aria-hidden="true"><div class="planet"><span class="planet__icon">' + icon("rocket", "icon--lg") + "</span></div></div>" +
      "</section>" +
      '<div class="stats">' +
      '<div class="stat"><span class="stat__icon stat__icon--star">' + icon("star") + '</span><span><span class="stat__value">' + progress.stars + '</span><span class="stat__label">Sao đã kiếm</span></span></div>' +
      '<div class="stat"><span class="stat__icon stat__icon--flame">' + icon("flame") + '</span><span><span class="stat__value">' + progress.streak + ' ngày</span><span class="stat__label">Chuỗi học tập</span></span></div>' +
      '<div class="stat"><span class="stat__icon">' + icon("bolt") + '</span><span><span class="stat__value">' + progress.xp + '</span><span class="stat__label">XP tích lũy</span></span></div>' +
      "</div>" +
      '<section class="section"><div class="section__head"><div><div class="eyebrow">Kho bài học</div><h2 class="section__title">Chọn chuyến phiêu lưu</h2></div>' +
      '<span class="section__hint">' + learned + "/" + totalVocab + " từ đã nhớ toàn kho</span></div>" +
      '<div class="lesson-grid">' + cards + "</div></section>" +
      '<div class="hint-card">' + icon("info") +
      "<div><strong>M1 đang ở đây.</strong> Bản prototype này kiểm chứng Lesson JSON Contract, Design System Space Explorer và luồng học chạm. Góc Phụ Huynh, 5 mini-game đầy đủ và Spaced Repetition sẽ vào M3–M4.</div></div>"
    );
    announce("Trang bài học, " + MODEL.lessons.length + " bài có sẵn.");
  }

  /* ---------------- lesson hub ---------------- */

  function lessonTabs(lesson, active) {
    var tabs = [
      { key: "hub", label: "Tổng quan", icon: "compass", href: "#/lesson/" + encodeURIComponent(lesson.id) },
      { key: "vocab", label: "Từ vựng", icon: "book", href: "#/lesson/" + encodeURIComponent(lesson.id) + "/vocab" },
      { key: "grammar", label: "Ngữ pháp", icon: "target", href: "#/lesson/" + encodeURIComponent(lesson.id) + "/grammar" },
      { key: "read", label: "Đọc & Nghe", icon: "ear", href: "#/lesson/" + encodeURIComponent(lesson.id) + "/read" },
      { key: "quiz", label: "Thử thách", icon: "spark", href: "#/lesson/" + encodeURIComponent(lesson.id) + "/quiz" }
    ];
    return (
      '<div class="lesson-bar"><a class="backlink" href="#/home">' + icon("arrow-left") + "Bài học</a>" +
      '<nav class="lesson-tabs" aria-label="Các phần của bài học">' +
      tabs.map(function (tab) {
        return '<a class="tab-link" href="' + tab.href + '"' + (tab.key === active ? ' aria-current="page"' : "") + ">" + icon(tab.icon) + tab.label + "</a>";
      }).join("") +
      "</nav></div>"
    );
  }

  function moduleHeader(kicker, title, sub) {
    return '<header class="module-header"><div class="module-kicker">' + esc(kicker) + "</div>" +
      '<h1 class="module-title">' + esc(title) + "</h1>" +
      '<p class="module-sub">' + esc(sub) + "</p></header>";
  }

  function renderLessonHub(lesson) {
    setTitle(lesson.title);
    var remembered = countRemembered(lesson);
    var percent = pct(remembered, lesson.vocabulary.length);
    var modules = [
      { key: "vocab", icon: "book", title: "Flashcard 3D", desc: "Lật thẻ, nghe phát âm và đánh dấu từ đã nhớ.", meta: lesson.vocabulary.length + " thẻ · chạm để lật" },
      { key: "grammar", icon: "target", title: "Sentence Lego", desc: "Xếp khối từ theo màu để lắp mẫu câu đúng.", meta: lesson.grammar.length + " mẫu câu" },
      { key: "read", icon: "ear", title: "Đọc & Nghe", desc: "Chạm từng từ để nghe, đọc đuổi theo từng câu.", meta: lesson.readings.length + " đoạn hội thoại" },
      { key: "quiz", icon: "spark", title: "Thử thách", desc: "Chơi thử thám tử điền khuyết và nhận Sao.", meta: lesson.quiz.length + " câu hỏi" }
    ];
    var objectiveHtml = lesson.objectives.map(function (text) {
      return '<li class="objective">' + icon("check") + "<span>" + esc(text) + "</span></li>";
    }).join("");

    setView(
      lessonTabs(lesson, "hub") +
      '<section class="surface lesson-head">' +
      '<a class="backlink" href="#/home">' + icon("arrow-left") + "Về kho bài học</a>" +
      '<div><div class="eyebrow">' + esc(lesson.unit || "Bài học") + "</div>" +
      '<h1 class="lesson-head__title">' + esc(lesson.title) + "</h1>" +
      '<p class="lesson-head__vi">' + esc(lesson.subtitleVi || "") + "</p>" +
      '<p class="lesson-head__sub">Lớp ' + esc(lesson.grade) + " · " + esc(lesson.cefr) + " · " + esc(lesson.minutes) + " phút" +
      (lesson.sourcePdf ? " · Nguồn: " + esc(lesson.sourcePdf) : "") + "</p></div>" +
      '<div class="progress-line"><div class="progress-line__top"><span>Tiến độ từ vựng</span><strong>' + remembered + "/" + lesson.vocabulary.length + "</strong></div>" +
      '<div class="progress-track"><span class="progress-track__fill" style="width:' + percent + '%"></span></div></div>' +
      "</section>" +
      '<section class="section"><div class="section__head"><div><div class="eyebrow">Mục tiêu</div><h2 class="section__title">Hôm nay con sẽ làm được gì?</h2></div></div>' +
      '<ul class="objectives">' + (objectiveHtml || '<li class="objective">Cùng học và chơi với bài học này nhé!</li>') + "</ul></section>" +
      '<section class="section"><div class="section__head"><div><div class="eyebrow">4 phân hệ</div><h2 class="section__title">Chọn hoạt động</h2></div>' +
      '<span class="section__hint">Tất cả đều thao tác bằng chạm</span></div><div class="module-grid">' +
      modules.map(function (mod) {
        return '<a class="module-card" href="#/lesson/' + encodeURIComponent(lesson.id) + "/" + mod.key + '">' +
          '<span class="module-card__icon">' + icon(mod.icon, "icon--lg") + "</span>" +
          '<span class="module-card__title">' + esc(mod.title) + "</span>" +
          '<span class="module-card__desc">' + esc(mod.desc) + "</span>" +
          '<span class="module-card__meta">' + esc(mod.meta) + "</span>" +
          "</a>";
      }).join("") + "</div></section>" +
      '<div class="cta-row" style="margin-top:24px"><a class="btn btn--primary" href="#/lesson/' + encodeURIComponent(lesson.id) + '/vocab">Bắt đầu học ' + icon("arrow-right") + "</a></div>"
    );
    announce("Tổng quan bài " + lesson.title + ".");
  }

  /* ---------------- vocabulary ---------------- */

  function renderVocab(lesson) {
    setTitle("Từ vựng · " + lesson.title);
    var items = lesson.vocabulary;
    if (!items.length) {
      setView(lessonTabs(lesson, "vocab") + '<div class="card empty-state">' + icon("book", "icon--lg") + '<h2 class="empty-state__title">Chưa có từ vựng</h2><p>Bài học này chưa có thẻ từ.</p></div>');
      return;
    }
    ui.vocabIndex = clamp(ui.vocabIndex, 0, items.length - 1);
    var item = items[ui.vocabIndex];
    var key = lesson.id + ":" + item.id;
    var remembered = !!progress.remembered[key];
    var needsReview = !!progress.review[key];
    var dots = items.map(function (entry, index) {
      var k = lesson.id + ":" + entry.id;
      var cls = index === ui.vocabIndex ? "dot is-active" : progress.remembered[k] ? "dot is-done" : "dot";
      return '<span class="' + cls + '"></span>';
    }).join("");

    setView(
      lessonTabs(lesson, "vocab") +
      moduleHeader("Phân hệ 1", "Flashcard 3D", "Chạm vào thẻ để lật mặt sau. Nghe phát âm rồi chọn Đã nhớ hoặc Cần ôn.") +
      '<div class="vocab-top"><div class="pager">' +
      '<button class="btn btn--ghost btn--sm" id="vocab-prev" type="button"' + (ui.vocabIndex === 0 ? " disabled" : "") + ">" + icon("arrow-left") + "Trước</button>" +
      '<span class="pager__label">' + (ui.vocabIndex + 1) + " / " + items.length + "</span>" +
      '<button class="btn btn--ghost btn--sm" id="vocab-next" type="button"' + (ui.vocabIndex === items.length - 1 ? " disabled" : "") + ">Sau " + icon("arrow-right") + "</button>" +
      '</div><button class="btn btn--outline btn--sm slow-toggle" id="slow-toggle" type="button" aria-pressed="false">' + icon("gauge") + "Đọc chậm</button></div>" +
      '<div class="vocab-progress"><div class="progress-dots" aria-hidden="true">' + dots + "</div></div>" +
      '<div class="flashcard-scene"><div class="flashcard" id="flashcard" data-flipped="false">' +
      '<div class="flashcard__face flashcard__front">' +
      '<span class="flashcard__tag">' + esc(POS_LABEL[item.pos] || item.pos || "từ mới") + "</span>" +
      (item.icon ? '<div style="font-size:56px;line-height:1" aria-hidden="true">' + esc(item.icon) + "</div>" : "") +
      '<div class="flashcard__word">' + esc(item.word) + "</div>" +
      (item.ipa ? '<div class="flashcard__ipa">' + esc(item.ipa) + "</div>" : "") +
      '<button class="btn btn--primary btn--icon flashcard__speaker" id="say-word" type="button" aria-label="Nghe phát âm ' + esc(item.word) + '">' + icon("speaker") + "</button>" +
      '<button class="flashcard__hint" id="flip-card" type="button">' + icon("refresh") + "Chạm thẻ hoặc bấm để xem nghĩa</button>" +
      "</div>" +
      '<div class="flashcard__face flashcard__back">' +
      '<span class="flashcard__tag">' + icon("check") + "Nghĩa tiếng Việt" + "</span>" +
      '<div class="flashcard__meaning">' + esc(item.meaning_vi) + "</div>" +
      '<p class="flashcard__example">' + esc(item.example_en) + (item.example_vi ? "<span>" + esc(item.example_vi) + "</span>" : "") + "</p>" +
      (item.mnemonic_vi ? '<div class="flashcard__mnemonic">' + icon("spark") + "<span>" + esc(item.mnemonic_vi) + "</span></div>" : "") +
      '<div class="meta-row" style="margin-top:10px"><span class="chip">Trang ' + esc(item.source_page || "?") + "</span>" +
      '<span class="chip">' + (item.source_type === "generated" ? "Bổ sung" : "Từ PDF") + "</span></div>" +
      "</div></div></div>" +
      '<div class="flash-actions">' +
      '<button class="btn btn--outline" id="mark-review" type="button" aria-pressed="' + needsReview + '">' + icon("refresh") + (needsReview ? "Đang cần ôn" : "Cần ôn thêm") + "</button>" +
      '<button class="btn btn--success" id="mark-known" type="button" aria-pressed="' + remembered + '">' + icon("check") + (remembered ? "Đã nhớ" : "Đã nhớ rồi") + "</button>" +
      "</div>" +
      '<p class="vocab-note">Tiến độ được lưu trên thiết bị này. Chạm loa để nghe lại bất cứ lúc nào.</p>' +
      '<div class="cta-row" style="margin-top:18px"><a class="btn btn--outline" href="#/lesson/' + encodeURIComponent(lesson.id) + '/grammar">Học ngữ pháp ' + icon("arrow-right") + "</a></div>"
    );

    var card = $("#flashcard");
    var flipButton = $("#flip-card");
    function flip() {
      var flipped = card.classList.toggle("is-flipped");
      card.setAttribute("data-flipped", String(flipped));
      if (flipButton) {
        flipButton.innerHTML = icon("refresh") + (flipped ? "Bấm để lật lại mặt trước" : "Chạm thẻ hoặc bấm để xem nghĩa");
      }
    }
    card.addEventListener("click", flip);
    flipButton.addEventListener("click", function (event) {
      event.stopPropagation();
      flip();
    });
    $("#say-word").addEventListener("click", function (event) {
      event.stopPropagation();
      TTS.speak(item.word + ". " + (item.example_en || ""), {});
    });
    $("#vocab-prev").addEventListener("click", function () {
      if (ui.vocabIndex > 0) {
        ui.vocabIndex -= 1;
        renderVocab(lesson);
      }
    });
    $("#vocab-next").addEventListener("click", function () {
      if (ui.vocabIndex < items.length - 1) {
        ui.vocabIndex += 1;
        renderVocab(lesson);
      }
    });
    $("#slow-toggle").addEventListener("click", function (event) {
      var button = event.currentTarget;
      var slow = TTS.getRate() !== 0.75;
      TTS.setRate(slow ? 0.75 : 1);
      button.setAttribute("aria-pressed", String(slow));
      button.innerHTML = icon("gauge") + (slow ? "Đọc chậm" : "Đọc thường");
      TTS.speak(item.word, {});
    });
    $("#mark-known").addEventListener("click", function (event) {
      var was = !!progress.remembered[key];
      progress.remembered[key] = true;
      delete progress.review[key];
      if (!was) award(5, 1);
      saveProgress();
      event.currentTarget.setAttribute("aria-pressed", "true");
      event.currentTarget.innerHTML = icon("check") + "Đã nhớ";
      $("#mark-review").setAttribute("aria-pressed", "false");
      $("#mark-review").innerHTML = icon("refresh") + "Cần ôn thêm";
      toast(was ? "Từ này đã nằm trong bộ nhớ của con." : "Tuyệt vời! +5 XP và +1 Sao.");
      if (ui.vocabIndex < items.length - 1) {
        window.setTimeout(function () {
          ui.vocabIndex += 1;
          renderVocab(lesson);
        }, 520);
      }
    });
    $("#mark-review").addEventListener("click", function (event) {
      progress.review[key] = true;
      delete progress.remembered[key];
      saveProgress();
      event.currentTarget.setAttribute("aria-pressed", "true");
      event.currentTarget.innerHTML = icon("refresh") + "Đang cần ôn";
      $("#mark-known").setAttribute("aria-pressed", "false");
      $("#mark-known").innerHTML = icon("check") + "Đã nhớ rồi";
      toast("Đã thêm vào danh sách cần ôn. Mình sẽ gặp lại từ này nhé!");
    });
    announce("Thẻ từ " + (ui.vocabIndex + 1) + " trên " + items.length + ": " + item.word);
  }

  /* ---------------- grammar ---------------- */

  function textColorFor(hex) {
    var onWhite = contrastRatio("#ffffff", hex);
    var onInk = contrastRatio("#0f172a", hex);
    if (!isFinite(onWhite) || !isFinite(onInk)) return "#0f172a";
    return onWhite >= onInk ? "#ffffff" : "#0f172a";
  }

  function renderGrammar(lesson) {
    setTitle("Ngữ pháp · " + lesson.title);
    var patterns = lesson.grammar;
    if (!patterns.length) {
      setView(lessonTabs(lesson, "grammar") + '<div class="card empty-state">' + icon("target", "icon--lg") + '<h2 class="empty-state__title">Chưa có mẫu câu</h2><p>Bài học này chưa có mẫu ngữ pháp.</p></div>');
      return;
    }
    var cards = patterns.map(function (pattern, index) {
      var sentence = (pattern.lego_blocks || []).map(function (block) {
        return block.text;
      }).join(" ");
      var blocks = (pattern.lego_blocks || []).map(function (block) {
        return '<button class="lego-block" type="button" data-speak="' + esc(block.text) + '" style="background:' + esc(block.color) + ";color:" + textColorFor(block.color) + '" aria-label="Nghe từ ' + esc(block.text) + '">' + esc(block.text) + "</button>";
      }).join("");
      return (
        '<article class="card pattern-card">' +
        '<div class="pattern-card__head"><span class="pattern-card__num">' + (index + 1) + "</span>" +
        '<div><h2 class="pattern-title pattern-en">' + esc(pattern.pattern) + "</h2>" +
        '<p class="pattern-trans">' + esc(pattern.explanation_vi) + "</p></div></div>" +
        '<div class="lego-zone"><div class="lego-label">Chạm từng khối để nghe, hoặc nghe cả câu:</div>' +
        '<div class="lego-row">' + blocks + "</div>" +
        '<div class="lego-sentence">' + esc(sentence) + "</div></div>" +
        '<div class="cta-row"><button class="btn btn--primary btn--sm" type="button" data-speak="' + esc(sentence) + '">' + icon("speaker") + "Nghe cả câu</button>" +
        '<span class="chip">Trang ' + esc(pattern.source_page || "?") + "</span>" +
        '<span class="chip">' + (pattern.source_type === "generated" ? "Bổ sung" : "Từ PDF") + "</span></div>" +
        "</article>"
      );
    }).join("");

    setView(
      lessonTabs(lesson, "grammar") +
      moduleHeader("Phân hệ 2", "Sentence Lego", "Mỗi khối màu là một phần của câu. Chạm để nghe, rồi đọc theo cả câu.") +
      '<div class="pattern-list">' + cards + "</div>" +
      '<div class="cta-row" style="margin-top:22px"><a class="btn btn--outline" href="#/lesson/' + encodeURIComponent(lesson.id) + '/read">Luyện đọc ' + icon("arrow-right") + "</a></div>"
    );

    $$("[data-speak]", view).forEach(function (button) {
      button.addEventListener("click", function () {
        TTS.speak(button.getAttribute("data-speak") || "", {});
      });
    });
    announce(patterns.length + " mẫu ngữ pháp.");
  }

  /* ---------------- read-along ---------------- */

  function renderRead(lesson) {
    setTitle("Đọc & Nghe · " + lesson.title);
    var dialogue = lesson.readings[0];
    if (!dialogue) {
      setView(lessonTabs(lesson, "read") + '<div class="card empty-state">' + icon("ear", "icon--lg") + '<h2 class="empty-state__title">Chưa có bài đọc</h2><p>Bài học này chưa có đoạn hội thoại.</p></div>');
      return;
    }
    var token = ++ui.readToken;
    var turns = dialogue.lines.map(function (line, index) {
      var words = String(line.en || "").split(/(\s+)/);
      var offset = 0;
      var wordButtons = words.map(function (chunk, chunkIndex) {
        if (/^\s+$/.test(chunk)) {
          offset += chunk.length;
          return chunk.replace(/ /g, "&nbsp;");
        }
        var start = offset;
        offset += chunk.length;
        return '<button class="word-btn" type="button" data-word="' + esc(chunk) + '" data-start="' + start + '" data-turn="' + index + '" aria-label="Nghe từ ' + esc(chunk) + '">' + esc(chunk) + "</button>";
      }).join("");
      var initial = (line.speaker || "?").slice(0, 1).toUpperCase();
      return (
        '<div class="read-turn" data-turn="' + index + '">' +
        '<span class="read-turn__avatar" aria-hidden="true">' + esc(initial) + "</span>" +
        '<div class="read-turn__body">' +
        '<div class="read-turn__top"><span class="read-turn__speaker">' + esc(line.speaker || "Narrator") + "</span>" +
        '<button class="btn btn--ghost btn--icon btn--sm read-turn__play" type="button" data-play-turn="' + index + '" aria-label="Nghe ' + esc(line.speaker || "") + '">' + icon("play") + "</button></div>" +
        '<div class="read-line">' + wordButtons + "</div>" +
        (line.vi ? '<p class="read-trans">' + esc(line.vi) + "</p>" : "") +
        "</div></div>"
      );
    }).join("");

    setView(
      lessonTabs(lesson, "read") +
      moduleHeader("Phân hệ 4", dialogue.title || "Read-Along", "Chạm vào từng từ để nghe và xem nghĩa. Bật “Nghe cả đoạn” để đọc đuổi theo từng câu.") +
      '<div class="read-tools"><button class="btn btn--primary" id="play-all" type="button">' + icon("play") + "Nghe cả đoạn</button>" +
      '<button class="btn btn--outline" id="stop-read" type="button" disabled>' + icon("stop") + "Dừng</button>" +
      '<button class="btn btn--outline btn--sm slow-toggle" id="slow-toggle" type="button" aria-pressed="false">' + icon("gauge") + "Đọc chậm</button>" +
      '<span class="read-status" id="read-status" role="status">Sẵn sàng nghe.</span></div>' +
      '<section class="card read-card">' + turns + "</section>" +
      '<div class="cta-row" style="margin-top:22px"><a class="btn btn--primary" href="#/lesson/' + encodeURIComponent(lesson.id) + '/quiz">Chơi thử thách ' + icon("spark") + "</a></div>"
    );

    var status = $("#read-status");
    var playAllBtn = $("#play-all");
    var stopBtn = $("#stop-read");

    function clearHighlight() {
      $$(".word-btn.is-speaking", view).forEach(function (node) {
        node.classList.remove("is-speaking");
      });
      $$(".read-turn.is-speaking", view).forEach(function (node) {
        node.classList.remove("is-speaking");
      });
    }

    function speakTurn(index) {
      var line = dialogue.lines[index];
      if (!line) return;
      clearHighlight();
      var turn = $('.read-turn[data-turn="' + index + '"]', view);
      if (turn) turn.classList.add("is-speaking");
      var buttons = $$('.word-btn[data-turn="' + index + '"]', view);
      TTS.speak(line.en, {
        onBoundary: function (event) {
          var charIndex = event.charIndex || 0;
          var active = null;
          buttons.forEach(function (button) {
            var start = parseInt(button.getAttribute("data-start"), 10);
            if (start <= charIndex) active = button;
          });
          buttons.forEach(function (button) {
            button.classList.toggle("is-speaking", button === active);
          });
        },
        onEnd: clearHighlight,
        onError: clearHighlight
      });
    }

    function stopRead() {
      ui.readToken += 1;
      TTS.stop();
      clearHighlight();
      stopBtn.disabled = true;
      playAllBtn.disabled = false;
      status.textContent = "Đã dừng.";
    }

    function playAll() {
      if (!TTS.supported) {
        toast("Thiết bị này chưa hỗ trợ đọc tiếng Anh.");
        return;
      }
      var myToken = ++ui.readToken;
      var index = 0;
      playAllBtn.disabled = true;
      stopBtn.disabled = false;
      status.textContent = "Đang đọc đoạn hội thoại…";

      function next() {
        if (myToken !== ui.readToken) return;
        if (index >= dialogue.lines.length) {
          clearHighlight();
          status.textContent = "Đã đọc xong. Con đọc lại nhé!";
          playAllBtn.disabled = false;
          stopBtn.disabled = true;
          return;
        }
        var line = dialogue.lines[index];
        var turn = $('.read-turn[data-turn="' + index + '"]', view);
        if (turn) {
          turn.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
          turn.classList.add("is-speaking");
        }
        TTS.speak(line.en, {
          onEnd: function () {
            if (myToken !== ui.readToken) return;
            if (turn) turn.classList.remove("is-speaking");
            index += 1;
            window.setTimeout(next, 220);
          },
          onError: function () {
            if (myToken !== ui.readToken) return;
            if (turn) turn.classList.remove("is-speaking");
            index += 1;
            window.setTimeout(next, 220);
          }
        });
        status.textContent = "Đang đọc câu " + (index + 1) + " / " + dialogue.lines.length + "…";
      }
      next();
    }

    playAllBtn.addEventListener("click", playAll);
    stopBtn.addEventListener("click", stopRead);
    $("#slow-toggle").addEventListener("click", function (event) {
      var slow = TTS.getRate() !== 0.75;
      TTS.setRate(slow ? 0.75 : 1);
      event.currentTarget.setAttribute("aria-pressed", String(slow));
      event.currentTarget.innerHTML = icon("gauge") + (slow ? "Đọc chậm" : "Đọc thường");
    });
    $$("[data-play-turn]", view).forEach(function (button) {
      button.addEventListener("click", function () {
        speakTurn(parseInt(button.getAttribute("data-play-turn"), 10) || 0);
      });
    });
    $$(".word-btn", view).forEach(function (button) {
      button.addEventListener("click", function () {
        var word = button.getAttribute("data-word") || "";
        var turnIndex = parseInt(button.getAttribute("data-turn"), 10) || 0;
        var line = dialogue.lines[turnIndex] || {};
        TTS.speak(word, {});
        var match = findMeaning(lesson, word);
        showWordTip(button, {
          word: word,
          meaning: match ? match.meaning_vi : "Chạm để nghe phát âm",
          sub: line.vi || ""
        });
        window.clearTimeout(button.__tipTimer);
        button.__tipTimer = window.setTimeout(function () {
          hideWordTip();
        }, 2600);
      });
    });
    onCleanup(function () {
      ui.readToken += 1;
      TTS.stop();
      clearHighlight();
    });
    announce("Đoạn hội thoại " + dialogue.lines.length + " câu. Chạm từng từ để nghe.");
  }

  /* ---------------- quiz ---------------- */

  function pickQuiz(lesson) {
    var byType = {};
    lesson.quiz.forEach(function (item) {
      if (!item || !item.game_type) return;
      byType[item.game_type] = byType[item.game_type] || [];
      byType[item.game_type].push(item);
    });
    var picked = [];
    Object.keys(byType).forEach(function (type) {
      picked = picked.concat(byType[type].slice(0, 2));
    });
    if (picked.length < 6) {
      picked = lesson.quiz.slice(0, 8);
    }
    return picked.slice(0, 10);
  }

  function renderQuiz(lesson) {
    setTitle("Thử thách · " + lesson.title);
    ui.quizIndex = 0;
    ui.quizCorrect = 0;
    ui.quizXp = 0;
    ui.quizAnswered = false;
    var pool = pickQuiz(lesson);
    if (!pool.length) {
      setView(lessonTabs(lesson, "quiz") + '<div class="card empty-state">' + icon("spark", "icon--lg") + '<h2 class="empty-state__title">Chưa có câu hỏi</h2><p>Bài học này chưa có câu hỏi luyện tập.</p></div>');
      return;
    }

    setView(
      lessonTabs(lesson, "quiz") +
      moduleHeader("Phân hệ 5", "Thử thách Thám tử", "Chọn đáp án đúng. Sai không sao — con sẽ nhận gợi ý nhẹ nhàng và thử lại.") +
      '<div class="quiz-wrap"><section class="card quiz-card" id="quiz-card"></section></div>'
    );

    function renderQuestion() {
      var card = $("#quiz-card");
      if (!card) return;
      if (ui.quizIndex >= pool.length) {
        renderDone(card);
        return;
      }
      var item = pool[ui.quizIndex];
      var promptHtml = esc(item.prompt_en || "").replace(/_{2,}/g, '<span class="cloze-blank" aria-hidden="true">____</span>');
      var options = (item.options || []).map(function (option, index) {
        return '<button class="answer" type="button" data-index="' + index + '">' +
          '<span class="answer__key">' + "ABCD".charAt(index) + "</span>" +
          '<span class="answer__text">' + esc(option) + "</span>" +
          '<span class="answer__mark" aria-hidden="true"></span></button>';
      }).join("");

      card.innerHTML =
        '<div class="quiz-top"><span class="quiz-count">Câu ' + (ui.quizIndex + 1) + " / " + pool.length + "</span>" +
        '<span class="quiz-xp">' + icon("star") + " " + ui.quizXp + " XP</span></div>" +
        '<div class="meta-row"><span class="chip chip--cyan">' + esc(GAME_LABEL[item.game_type] || item.game_type) + "</span>" +
        '<span class="chip">' + esc(SKILL_LABEL[item.skill] || item.skill || "") + "</span>" +
        '<span class="chip">' + esc(item.difficulty || "easy") + "</span></div>" +
        '<h2 class="quiz-prompt">' + promptHtml + "</h2>" +
        (item.audio_text ? '<div class="quiz-audio"><button class="btn btn--outline btn--sm" type="button" id="say-prompt">' + icon("speaker") + "Nghe câu hỏi</button></div>" : "") +
        '<p class="muted" style="color:var(--muted-on-card);font-size:16px">' + esc(item.prompt_vi || "") + "</p>" +
        '<div class="answers" role="group" aria-label="Các đáp án">' + options + "</div>" +
        '<div class="feedback" id="quiz-feedback" role="status" aria-live="polite">' +
        icon("info") + "<div><span class=\"feedback__title\">Chọn một đáp án</span><span class=\"feedback__text\">Con có thể chạm thử, sai rồi thử lại nhé.</span></div></div>" +
        '<div class="quiz-footer"><button class="btn btn--primary" id="quiz-next" type="button" hidden>Tiếp tục ' + icon("arrow-right") + "</button></div>";

      ui.quizAnswered = false;
      var feedback = $("#quiz-feedback");
      var next = $("#quiz-next");
      var answeredThisItem = !!progress.answered[lesson.id + ":" + item.id];

      if (item.audio_text) {
        $("#say-prompt").addEventListener("click", function () {
          TTS.speak(item.audio_text, {});
        });
      }

      $$(".answer", card).forEach(function (button) {
        button.addEventListener("click", function () {
          var choice = parseInt(button.getAttribute("data-index"), 10);
          if (choice === item.answer_index) {
            button.classList.add("is-correct");
            button.querySelector(".answer__mark").innerHTML = icon("check");
            if (!ui.quizAnswered) {
              ui.quizAnswered = true;
              ui.quizCorrect += 1;
              if (!answeredThisItem) {
                ui.quizXp += 12;
                progress.answered[lesson.id + ":" + item.id] = true;
                award(12, 1);
                answeredThisItem = true;
              }
              var xpBadge = $(".quiz-xp", card);
              if (xpBadge) xpBadge.innerHTML = icon("star") + " " + ui.quizXp + " XP";
            }
            $$(".answer", card).forEach(function (node) {
              node.disabled = true;
            });
            feedback.className = "feedback feedback--ok";
            feedback.innerHTML = icon("check") +
              '<div><span class="feedback__title">Chính xác! +12 XP</span><span class="feedback__text">' +
              esc(item.explanation_vi || item.prompt_vi || "Con giỏi lắm!") + "</span></div>";
            next.hidden = false;
            next.focus({ preventScroll: true });
            burstConfetti();
            TTS.speak(item.answer_text || (item.options || [])[item.answer_index] || "", {});
          } else {
            button.classList.add("is-wrong");
            button.disabled = true;
            button.querySelector(".answer__mark").innerHTML = icon("x");
            feedback.className = "feedback feedback--hint";
            feedback.innerHTML = icon("spark") +
              '<div><span class="feedback__title">Gần đúng rồi!</span><span class="feedback__text">' +
              esc(item.hint_vi || "Con thử lại một đáp án khác nhé.") + "</span></div>";
            toast("Thử lại nhé — sai một lần là thêm một lần nhớ!");
          }
        });
      });

      next.addEventListener("click", function () {
        ui.quizIndex += 1;
        renderQuestion();
      });
    }

    function renderDone(card) {
      var total = pool.length;
      var percent = pct(ui.quizCorrect, total);
      card.classList.add("quiz-done");
      card.innerHTML = icon("star", "icon--lg") +
        '<h2 class="quiz-done__title">Hoàn thành thử thách!</h2>' +
        "<p>Con đã trả lời đúng " + ui.quizCorrect + " trên " + total + " câu. Mỗi lần thử là một lần tiến bộ.</p>" +
        '<div class="quiz-score">' +
        '<div class="quiz-score__cell"><span class="quiz-score__value">' + ui.quizCorrect + "/" + total + '</span><span class="quiz-score__label">Câu đúng</span></div>' +
        '<div class="quiz-score__cell"><span class="quiz-score__value">' + ui.quizXp + '</span><span class="quiz-score__label">XP nhận được</span></div>' +
        '<div class="quiz-score__cell"><span class="quiz-score__value">' + percent + '%</span><span class="quiz-score__label">Tỷ lệ đúng</span></div>' +
        "</div>" +
        '<div class="btn-row" style="width:100%;max-width:520px;margin-top:8px">' +
        '<button class="btn btn--primary" id="quiz-again" type="button">' + icon("refresh") + "Chơi lại</button>" +
        '<a class="btn btn--outline" href="#/lesson/' + encodeURIComponent(lesson.id) + '">Về bài học</a></div>' +
        '<p class="xp-note">XP chỉ được cộng lần đầu khi trả lời đúng mỗi câu, để khuyến khích học đều.</p>';
      $("#quiz-again").addEventListener("click", function () {
        renderQuiz(lesson);
      });
      burstConfetti();
    }

    renderQuestion();
    onCleanup(function () {
      TTS.stop();
    });
    announce("Thử thách " + pool.length + " câu hỏi.");
  }

  /* ---------------- design system ---------------- */

  function contrastRatio(hexA, hexB) {
    function lum(hex) {
      var value = String(hex).replace("#", "");
      var rgb = [0, 2, 4].map(function (index) {
        var channel = parseInt(value.slice(index, index + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    }
    var a = lum(hexA);
    var b = lum(hexB);
    var light = Math.max(a, b);
    var dark = Math.min(a, b);
    return (light + 0.05) / (dark + 0.05);
  }

  function renderDesign() {
    setTitle("Design System");
    var swatches = [
      { name: "Deep space", hex: "#0B1220", role: "Nền chính, màn đấu Boss", on: "#E2E8F0" },
      { name: "Surface", hex: "#111C33", role: "Panel tối, thanh điều hướng", on: "#E2E8F0" },
      { name: "Surface raised", hex: "#16233F", role: "Thẻ nổi, tooltip", on: "#E2E8F0" },
      { name: "Lesson card", hex: "#F0F7FF", role: "Mặt thẻ học, nền chữ tối", on: "#0F172A" },
      { name: "Ink", hex: "#0F172A", role: "Chữ trên nền sáng", on: "#F0F7FF" },
      { name: "Primary cyan", hex: "#06B6D4", role: "Hành động chính, liên kết", on: "#0B1220" },
      { name: "Star yellow", hex: "#FBBF24", role: "Sao, XP, phần thưởng", on: "#0B1220" },
      { name: "Rocket orange", hex: "#F97316", role: "Động từ, nhấn phụ", on: "#0B1220" },
      { name: "Success", hex: "#22C55E", role: "Đúng, đã nhớ", on: "#0B1220" },
      { name: "Gentle rose", hex: "#FB7185", role: "Sai nhẹ nhàng, không gắt", on: "#0B1220" },
      { name: "Muted", hex: "#94A3B8", role: "Chữ phụ trên nền tối", on: "#0B1220" }
    ];
    var swatchHtml = swatches.map(function (swatch) {
      var ratio = contrastRatio(swatch.hex, swatch.on);
      var low = ratio < 3;
      return '<div class="swatch"><div class="swatch__color" style="background:' + swatch.hex + '"></div>' +
        '<div class="swatch__name">' + esc(swatch.name) + "</div>" +
        '<div class="swatch__role">' + esc(swatch.role) + "</div>" +
        '<div class="swatch__hex">' + esc(swatch.hex) + "</div>" +
        '<div class="swatch__contrast' + (low ? " is-low" : "") + '">Tương phản với ' + esc(swatch.on) + ": <b>" + ratio.toFixed(1) + ":1</b></div></div>";
    }).join("");

    setView(
      '<section class="design-hero"><div class="eyebrow">M1 · Design System</div>' +
      '<h1 class="design-hero__title">Space Explorer</h1>' +
      '<p class="design-hero__sub">Ngôn ngữ thiết kế cho học sinh lớp 3–5: nền vũ trụ dịu mắt, thẻ học sáng rõ, vùng chạm lớn và phản hồi tích cực. Mọi token dưới đây đang được dùng thật trong prototype.</p>' +
      '<div class="hero__badges"><span class="chip chip--cyan">WCAG AA cho chữ</span><span class="chip chip--star">Touch ≥ 48px</span><span class="chip chip--green">Không emoji chrome</span><span class="chip">Không CDN</span></div></section>' +

      '<section class="design-section"><h2 class="design-section__title">Bảng màu</h2>' +
      '<p class="design-section__sub">Tỷ lệ tương phản tính tự động bằng công thức WCAG. Nền tối dùng chữ sáng, thẻ học dùng chữ mực.</p>' +
      '<div class="swatches">' + swatchHtml + "</div></section>" +

      '<section class="design-section"><h2 class="design-section__title">Kiểu chữ</h2>' +
      '<p class="design-section__sub">Font hệ thống bo tròn, không tải từ mạng. Cỡ chữ thân bài ≥ 18px, từ vựng ≥ 28px.</p>' +
      '<div class="panel--light"><div class="type-scale">' +
      '<div class="type-row"><span class="type-meta">Hero · 48–64px</span><span class="type-sample" style="font-size:clamp(34px,5vw,48px);font-weight:900">Vũ trụ Khám phá</span></div>' +
      '<div class="type-row"><span class="type-meta">H1 · 32–42px</span><span class="type-sample" style="font-size:clamp(28px,4vw,34px);font-weight:900">Unit 4: Food</span></div>' +
      '<div class="type-row"><span class="type-meta">H2 · 24–30px</span><span class="type-sample" style="font-size:26px;font-weight:850">Chọn hoạt động</span></div>' +
      '<div class="type-row"><span class="type-meta">Thân bài · 18–20px</span><span class="type-sample" style="font-size:19px">Chạm vào thẻ để nghe phát âm và xem nghĩa tiếng Việt.</span></div>' +
      '<div class="type-row"><span class="type-meta">Từ vựng · 34–46px</span><span class="type-sample" style="font-size:38px;font-weight:900">cocoa butter</span></div>' +
      '<div class="type-row"><span class="type-meta">Nhãn · 14–16px</span><span class="type-sample" style="font-size:15px;font-weight:800">TRANG 1 · TỪ PDF</span></div>' +
      "</div></div></section>" +

      '<section class="design-section"><h2 class="design-section__title">Nút & trạng thái</h2>' +
      '<p class="design-section__sub">Nút chính cao 52px; nút phụ và icon tối thiểu 48px. Sai được phản hồi bằng rung nhẹ và gợi ý, không chớp đỏ.</p>' +
      '<div class="panel--light"><div class="demo-grid"><div><div class="btn-row">' +
      '<button class="btn btn--primary" type="button">' + icon("play") + "Bắt đầu</button>" +
      '<button class="btn btn--success" type="button">' + icon("check") + "Đã nhớ</button>" +
      '<button class="btn btn--outline" type="button">' + icon("refresh") + "Cần ôn</button>" +
      '</div><div class="surface" style="padding:16px;border-radius:16px;margin-top:12px"><div class="btn-row">' +
      '<button class="btn btn--ghost" type="button">' + icon("arrow-left") + "Quay lại (trên nền tối)</button>" +
      '</div></div></div><div class="state-row">' +
      '<span class="state-pill state-pill--default">Mặc định</span>' +
      '<span class="state-pill state-pill--active">Đang chọn</span>' +
      '<span class="state-pill state-pill--ok">' + icon("check") + "Đúng</span>" +
      '<span class="state-pill state-pill--wrong">' + icon("refresh") + "Thử lại</span>" +
      '<span class="state-pill state-pill--focus">Focus</span>' +
      '<span class="state-pill state-pill--disabled">Tạm khóa</span>' +
      "</div></div></div></section>" +

      '<section class="design-section"><h2 class="design-section__title">Token kỹ thuật</h2>' +
      '<p class="design-section__sub">Tất cả token nằm trong :root của app.css, không phụ thuộc thư viện ngoài.</p>' +
      '<div class="panel--light"><table class="token-table"><caption>Design tokens · Space Explorer</caption>' +
      "<thead><tr><th>Token</th><th>Giá trị</th><th>Vai trò</th></tr></thead><tbody>" +
      "<tr><td>--tap</td><td><code>48px</code></td><td>Vùng chạm tối thiểu cho mọi nút</td></tr>" +
      "<tr><td>--radius-xl</td><td><code>30px</code></td><td>Thẻ học, flashcard</td></tr>" +
      "<tr><td>--gap</td><td><code>12px</code></td><td>Khoảng cách giữa các vùng chạm</td></tr>" +
      "<tr><td>--font-rounded</td><td><code>ui-rounded, SF Pro Rounded…</code></td><td>Font hệ thống, không tải mạng</td></tr>" +
      "<tr><td>--ease-spring</td><td><code>cubic-bezier(.34,1.56,.64,1)</code></td><td>Phản hồi nảy khi đúng</td></tr>" +
      "<tr><td>--shadow-card</td><td><code>0 22px 50px -24px …</code></td><td>Độ nổi thẻ trên nền vũ trụ</td></tr>" +
      "</tbody></table></div></section>" +

      '<section class="design-section"><h2 class="design-section__title">Quy tắc thiết kế</h2>' +
      '<div class="panel--light"><ul class="rule-list">' +
      "<li>" + icon("check") + "<span><strong>Touch-first:</strong> mọi tác vụ học và quiz đều chạm/kéo-thả; không bắt gõ bàn phím.</span></li>" +
      "<li>" + icon("check") + "<span><strong>Vùng chạm ≥ 48px, cách nhau ≥ 12px</strong> để tránh chạm nhầm trên iPad.</span></li>" +
      "<li>" + icon("check") + "<span><strong>Phản hồi tích cực:</strong> đúng thì nảy + confetti nhẹ; sai thì rung nhẹ + gợi ý, không âm thanh chói.</span></li>" +
      "<li>" + icon("check") + "<span><strong>Chuyển động có kiểm soát:</strong> chỉ transform/opacity, tôn trọng prefers-reduced-motion, mục tiêu 60fps.</span></li>" +
      "<li>" + icon("check") + "<span><strong>Tương phản:</strong> chữ trên nền đạt tối thiểu 4.5:1; màu không phải tín hiệu duy nhất (luôn kèm icon/chữ).</span></li>" +
      "<li>" + icon("check") + "<span><strong>Riêng tư:</strong> không tracker, không gọi mạng ngoài; tiến độ chỉ nằm trong localStorage của thiết bị.</span></li>" +
      "</ul></div></section>" +

      '<section class="design-section"><h2 class="design-section__title">Tiến độ trên thiết bị</h2>' +
      '<p class="design-section__sub">Prototype lưu XP, Sao, chuỗi ngày và trạng thái từ vựng trong localStorage. Xóa dữ liệu chỉ ảnh hưởng thiết bị này.</p>' +
      '<div class="panel--light"><div class="progress-summary">' +
      '<span class="summary-chip">' + icon("star") + "Sao <b>" + progress.stars + "</b></span>" +
      '<span class="summary-chip">' + icon("bolt") + "XP <b>" + progress.xp + "</b></span>" +
      '<span class="summary-chip">' + icon("flame") + "Chuỗi <b>" + progress.streak + " ngày</b></span>" +
      '<span class="summary-chip">' + icon("book") + "Bài <b>" + MODEL.lessons.length + "</b></span></div>" +
      '<div class="reset-zone"><button class="btn btn--danger" id="reset-progress" type="button">' + icon("refresh") + "Đặt lại tiến độ</button>" +
      '<span class="dev-note">Chỉ dùng khi muốn thử lại từ đầu. Hành động này không thể hoàn tác.</span></div></div></section>' +

      '<div class="hint-card">' + icon("info") +
      "<div><strong>Phạm vi M1:</strong> prototype này kiểm chứng token, component, luồng chạm và Lesson JSON Contract. Bản đầy đủ 5 mini-game, Mistake Bank, Spaced Repetition và Góc Phụ Huynh thuộc M3–M4.</div></div>"
    );

    $("#reset-progress").addEventListener("click", function () {
      var sure = window.confirm("Đặt lại toàn bộ XP, Sao và tiến độ từ vựng trên thiết bị này?");
      if (!sure) return;
      progress = defaultProgress();
      saveProgress();
      renderDesign();
      toast("Đã đặt lại tiến độ.");
    });
    announce("Trang Design System.");
  }

  /* ---------------- routing ---------------- */

  function parseHash() {
    var raw = window.location.hash.replace(/^#\/?/, "");
    var parts = raw.split("?")[0].split("/").filter(Boolean);
    return parts;
  }

  function notFound(message) {
    setView('<div class="card empty-state">' + icon("compass", "icon--lg") +
      '<h2 class="empty-state__title">Không tìm thấy trang</h2>' +
      "<p>" + esc(message || "Đường dẫn này chưa có trong prototype M1.") + "</p>" +
      '<a class="btn btn--primary" href="#/home">Về trang chủ</a></div>');
    announce("Không tìm thấy trang.");
  }

  function updateNav(route) {
    $$(".topnav__link").forEach(function (link) {
      if (link.getAttribute("data-nav") === route) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function route() {
    cleanup();
    var parts = parseHash();
    var path = parts[0] || "home";

    if (path === "design") {
      updateNav("design");
      renderDesign();
      return;
    }
    if (path === "lesson") {
      var lesson = lessonById(parts[1]);
      if (!lesson) return notFound("Bài học này không có trong kho.");
      progress.lastLesson = lesson.id;
      saveProgress();
      var moduleName = parts[2] || "hub";
      if (moduleName === "vocab") {
        ui.vocabIndex = 0;
        renderVocab(lesson);
      } else if (moduleName === "grammar") renderGrammar(lesson);
      else if (moduleName === "read") renderRead(lesson);
      else if (moduleName === "quiz") renderQuiz(lesson);
      else if (moduleName === "hub") renderLessonHub(lesson);
      else return notFound("Phần học này chưa có.");
      return;
    }
    if (path === "home" || parts.length === 0) {
      updateNav("home");
      renderHome();
      return;
    }
    notFound();
  }

  function onRouteChange() {
    var hash = window.location.hash || "#/home";
    if (hash === currentRoute) return;
    currentRoute = hash;
    if (!MODEL.lessons.length) {
      if (MODEL.source === "loading") {
        setView('<div class="loading"><span class="loading__dot"></span>Đang tải kho bài học…</div>');
        return;
      }
    }
    route();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    if (view) view.focus({ preventScroll: true });
  }

  /* ---------------- init ---------------- */

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!/^https?:$/.test(window.location.protocol)) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {
        /* offline caching is an enhancement, not a requirement */
      });
    });
  }

  function init() {
    if (!view) return;
    window.addEventListener("hashchange", onRouteChange);
    window.addEventListener("resize", hideWordTip);
    window.addEventListener("scroll", hideWordTip, { passive: true });

    if (!window.location.hash) window.location.hash = "#/home";

    loadData().then(function () {
      if (!MODEL.lessons.length) {
        setView('<div class="card empty-state">' + icon("compass", "icon--lg") +
          '<h2 class="empty-state__title">Chưa tải được bài học</h2>' +
          "<p>Hãy mở ứng dụng qua HTTP(S) hoặc kiểm tra tệp assets/data/lessons.json.</p>" +
          '<button class="btn btn--primary" id="retry-data" type="button">Thử lại</button></div>');
        var retry = document.getElementById("retry-data");
        if (retry) retry.addEventListener("click", function () { window.location.reload(); });
        return;
      }
      currentRoute = null;
      onRouteChange();
    });

    registerServiceWorker();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
