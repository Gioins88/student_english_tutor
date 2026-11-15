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
      voice: {},
      lego: {},
      mistakes: {},
      games: {},
      stickers: {},
      pet: { fed: 0, level: 1 },
      shields: 0,
      shieldGrantedFor: 0,
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
      ["remembered", "review", "answered", "voice", "lego", "mistakes", "games", "stickers"].forEach(function (key) {
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

  var TTS = window.SETSpeech.tts;
  var STT = window.SETSpeech.stt;

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
      mergeCustomLessons();
      return Promise.resolve();
    }
    return fetch("assets/data/lessons.json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (payload) {
        setData(payload, "json");
        mergeCustomLessons();
      })
      .catch(function () {
        var fallback = window.SET_FALLBACK_DATA;
        if (fallback) {
          setData(fallback, "embedded");
          mergeCustomLessons();
        }
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

  /* ---------------- practice module API ---------------- */

  function setupPracticeApi() {
    if (!window.SET_M2) return;
    window.SET_M2.setApi({
      esc: esc,
      icon: icon,
      toast: toast,
      confetti: burstConfetti,
      speak: TTS.speak,
      onWordComplete: function (lesson, item) {
        var key = lesson.id + ":" + item.id;
        var first = !progress.remembered[key];
        progress.remembered[key] = true;
        delete progress.review[key];
        award(first ? 8 : 2, first ? 1 : 0);
        maybeAwardLessonSticker(lesson);
        saveProgress();
        toast(first ? "Ghép đúng! +8 XP và +1 Sao." : "Ghép lại đúng rồi! +2 XP.");
      },
      onLegoComplete: function (lesson, pattern) {
        var key = lesson.id + ":" + pattern.id;
        var first = !progress.lego[key];
        progress.lego[key] = true;
        award(first ? 8 : 2, first ? 1 : 0);
        saveProgress();
        toast(first ? "Lắp câu đúng! +8 XP và +1 Sao." : "Lắp lại đúng rồi! +2 XP.");
      },
      onVoiceScore: function (payload) {
        var today = todayKey();
        var key = "voice:" + payload.key;
        var record = progress.voice[key];
        var best = record && record.day === today ? record.stars : 0;
        var improved = payload.stars > best;
        if (!record || record.day !== today || improved) {
          progress.voice[key] = {
            day: today,
            stars: Math.max(best, payload.stars),
            score: Math.round(payload.score * 100) / 100
          };
        }
        if (improved) {
          if (payload.stars >= 2) award(4, 1);
          else if (payload.stars === 1) award(1, 0);
        }
        saveProgress();
      }
    });
  }

  /* ---------------- M3 retention + games API ---------------- */

  var STICKER_LABELS = {
    sticker_balloon: "Bóng bay tinh nghịch",
    sticker_boss: "Hiệp sĩ diệt Boss",
    sticker_memory: "Nhà thám hiểm kho báu",
    sticker_detective: "Thám tử từ vựng",
    sticker_listen: "Tai thính vàng",
    sticker_lesson: "Ngôi sao bài học"
  };

  function maybeAwardLessonSticker(lesson) {
    if (!lesson || !progress || !progress.remembered) return;
    var all = lesson.vocabulary.length > 0 && lesson.vocabulary.every(function (item) {
      return !!progress.remembered[lesson.id + ":" + item.id];
    });
    if (all && !progress.stickers.sticker_lesson) {
      progress.stickers.sticker_lesson = {
        id: "sticker_lesson",
        label: STICKER_LABELS.sticker_lesson,
        lessonId: lesson.id,
        date: todayKey()
      };
      award(10, 2);
      toast("Con đã nhớ hết từ vựng! Mở Sticker Ngôi sao bài học.");
    }
  }

  function mistakeKey(lesson, item) {
    return lesson.id + ":" + item.id;
  }

  function recordMistake(lesson, item) {
    if (!window.SET_SRS || !lesson || !item) return;
    var key = mistakeKey(lesson, item);
    var record = progress.mistakes[key];
    var now = Date.now();
    if (!record) {
      record = window.SET_SRS.createRecord({
        lessonId: lesson.id,
        itemId: item.id,
        quizId: item.id,
        skill: item.skill,
        section: "quiz_bank",
        now: now
      });
    }
    progress.mistakes[key] = window.SET_SRS.recordWrong(record, now);
    saveProgress();
  }

  function reviewItem(lesson, item, correct) {
    if (!window.SET_SRS || !lesson || !item) return;
    var key = mistakeKey(lesson, item);
    var record = progress.mistakes[key];
    if (!record) return;
    progress.mistakes[key] = window.SET_SRS.recordReview(record, correct, Date.now());
    saveProgress();
  }

  function dueMistakes(lessonId) {
    if (!window.SET_SRS) return [];
    var now = Date.now();
    var records = Object.keys(progress.mistakes).map(function (key) {
      return progress.mistakes[key];
    }).filter(function (record) {
      return record && (!lessonId || record.lessonId === lessonId);
    });
    return window.SET_SRS.prioritise(window.SET_SRS.dueRecords(records, now), now);
  }

  function makeGamesApi(lesson) {
    return {
      esc: esc,
      icon: icon,
      toast: toast,
      confetti: burstConfetti,
      speak: TTS.speak,
      recordMistake: function (item) {
        recordMistake(lesson, item);
      },
      completeGame: function (payload) {
        return completeGame(lesson, payload);
      }
    };
  }

  function completeGame(lesson, payload) {
    var key = "game:" + lesson.id + ":" + payload.type;
    var previous = progress.games[key];
    var first = !previous;
    var best = previous ? previous.bestStars || 0 : 0;
    progress.games[key] = {
      plays: previous ? (previous.plays || 0) + 1 : 1,
      bestStars: Math.max(best, payload.stars || 0),
      lastPlayed: Date.now()
    };
    var stickerId = payload.sticker;
    var newSticker = false;
    if (stickerId && !progress.stickers[stickerId]) {
      progress.stickers[stickerId] = {
        id: stickerId,
        label: STICKER_LABELS[stickerId] || "Sticker mới",
        lessonId: lesson.id,
        date: todayKey()
      };
      newSticker = true;
    }
    if (first) {
      award((payload.xp || 0) + 12, Math.max(1, payload.stars || 1));
    } else if ((payload.stars || 0) > best) {
      award(4, 1);
    } else {
      award(2, 0);
    }
    saveProgress();
    return {
      newSticker: newSticker,
      stickerLabel: stickerId ? STICKER_LABELS[stickerId] : ""
    };
  }

  /* ---------------- custom lessons / parent backup API ---------------- */

  var CUSTOM_LESSONS_KEY = "set.prj09.customLessons.v1";

  function readCustomLessons() {
    try {
      var raw = window.localStorage.getItem(CUSTOM_LESSONS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function writeCustomLessons(list) {
    try {
      window.localStorage.setItem(CUSTOM_LESSONS_KEY, JSON.stringify(list));
    } catch (err) {
      toast("Không lưu được bài học mới trên thiết bị này.");
    }
  }

  function mergeCustomLessons() {
    var custom = readCustomLessons();
    if (!custom.length) return;
    var byId = {};
    MODEL.lessons.forEach(function (lesson) {
      byId[lesson.id] = lesson;
    });
    custom.forEach(function (raw) {
      var normalized = normalizeLesson(raw);
      if (normalized) byId[normalized.id] = normalized;
    });
    MODEL.lessons = Object.keys(byId).map(function (key) {
      return byId[key];
    });
  }

  function addLessonFromParent(raw) {
    if (!raw || typeof raw !== "object") throw new Error("Dữ liệu bài học không hợp lệ.");
    if (!raw.lesson_id || !raw.title) throw new Error("Bài học thiếu lesson_id hoặc title.");
    if (!Array.isArray(raw.vocabulary) || !raw.vocabulary.length) throw new Error("Bài học chưa có vocabulary.");
    if (!Array.isArray(raw.grammar_patterns) || !raw.grammar_patterns.length) throw new Error("Bài học chưa có grammar_patterns.");
    if (!Array.isArray(raw.quiz_bank) || raw.quiz_bank.length < 5) throw new Error("Bài học cần ít nhất 5 quiz item.");
    var normalized = normalizeLesson(raw);
    var custom = readCustomLessons().filter(function (entry) {
      return entry && entry.lesson_id !== raw.lesson_id;
    });
    custom.push(raw);
    writeCustomLessons(custom);
    MODEL.lessons = MODEL.lessons.filter(function (entry) {
      return entry.id !== normalized.id;
    }).concat([normalized]);
    return normalized;
  }

  function exportBackup() {
    return {
      app: "student_english_tutor",
      project: "PRJ-09",
      exported_at: new Date().toISOString(),
      progress: progress,
      custom_lessons: readCustomLessons()
    };
  }

  function restoreBackup(payload) {
    if (!payload || typeof payload !== "object" || !payload.progress || typeof payload.progress !== "object") {
      throw new Error("Tệp sao lưu không đúng định dạng.");
    }
    var base = defaultProgress();
    Object.keys(base).forEach(function (key) {
      if (payload.progress[key] !== undefined) base[key] = payload.progress[key];
    });
    ["remembered", "review", "answered", "voice", "lego", "mistakes", "games", "stickers"].forEach(function (key) {
      if (!base[key] || typeof base[key] !== "object" || Array.isArray(base[key])) base[key] = {};
    });
    progress = base;
    saveProgress();
    if (Array.isArray(payload.custom_lessons)) {
      writeCustomLessons(payload.custom_lessons);
    }
  }

  function makeParentApi() {
    var parentApi = {
      esc: esc,
      icon: icon,
      toast: toast,
      confetti: burstConfetti,
      addLesson: addLessonFromParent,
      exportBackup: exportBackup,
      restoreBackup: restoreBackup,
      saveProgress: saveProgress,
      readCustomLessons: readCustomLessons
    };
    Object.defineProperty(parentApi, "lessons", { get: function () { return MODEL.lessons; } });
    Object.defineProperty(parentApi, "progress", { get: function () { return progress; } });
    return parentApi;
  }

  /* ---------------- shared lesson import ---------------- */

  function handleSharedImport() {
    var raw = window.location.hash || "";
    var query = raw.indexOf("?") !== -1 ? raw.slice(raw.indexOf("?") + 1) : "";
    var encoded = "";
    try {
      encoded = new URLSearchParams(query).get("data") || "";
    } catch (err) {
      encoded = "";
    }
    if (!encoded || !window.LZString) {
      setView('<div class="card empty-state">' + icon("globe", "icon--lg") + '<h2 class="empty-state__title">Link chia sẻ không hợp lệ</h2><p>Link thiếu dữ liệu bài học hoặc trình duyệt chưa tải thư viện giải nén.</p><a class="btn btn--primary" href="#/home">Về trang chủ</a></div>');
      return;
    }
    try {
      var json = window.LZString.decompressFromEncodedURIComponent(encoded);
      var lesson = addLessonFromParent(JSON.parse(json));
      toast("Đã thêm bài “" + lesson.title + "” từ link chia sẻ.");
      window.location.replace("#/lesson/" + encodeURIComponent(lesson.id));
    } catch (err) {
      setView('<div class="card empty-state">' + icon("globe", "icon--lg") + '<h2 class="empty-state__title">Không nhập được bài chia sẻ</h2><p>' + esc(err.message || "Dữ liệu bài học bị lỗi.") + '</p><a class="btn btn--primary" href="#/home">Về trang chủ</a></div>');
    }
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
      (function () {
        var due = dueMistakes(null).length;
        return '<a class="hint-card" href="#/rewards" style="text-decoration:none">' + icon("star") +
          "<div><strong>Kho báu cần chinh phục:</strong> " + (due ? due + " mục đang chờ con ôn lại. " : "hôm nay chưa có mục nào đến hạn. ") +
          "Mở Kho báu để xem Sao, Sticker và thú cưng.</div></a>";
      })() +
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
      { key: "games", label: "Games", icon: "spark", href: "#/lesson/" + encodeURIComponent(lesson.id) + "/games" },
      { key: "review", label: "Ôn tập", icon: "refresh", href: "#/lesson/" + encodeURIComponent(lesson.id) + "/review" }
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
    var dueCount = dueMistakes(lesson.id).length;
    var modules = [
      { key: "vocab", icon: "book", title: "Flashcard 3D + Word Builder", desc: "Lật thẻ, nghe phát âm, ghép chữ và luyện đọc to.", meta: lesson.vocabulary.length + " thẻ" },
      { key: "grammar", icon: "target", title: "Sentence Lego", desc: "Xếp khối từ theo màu để lắp mẫu câu đúng.", meta: lesson.grammar.length + " mẫu câu" },
      { key: "read", icon: "ear", title: "Đọc & Nghe", desc: "Chạm từng từ để nghe, đọc đuổi và luyện micro.", meta: lesson.readings.length + " đoạn hội thoại" },
      { key: "games", icon: "spark", title: "5 Mini-games", desc: "Bóng bay, Boss, Kho báu, Thám tử và Nghe & chạm.", meta: "5 trò chơi" },
      { key: "quiz", icon: "bolt", title: "Luyện nhanh", desc: "Thử nhanh một lượt câu hỏi trắc nghiệm.", meta: lesson.quiz.length + " câu hỏi" },
      { key: "review", icon: "refresh", title: "Kho báu cần chinh phục", desc: "Ôn lại đúng lúc con sắp quên theo Spaced Repetition.", meta: dueCount + " mục cần ôn" }
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
      '<div class="cta-row" style="margin-top:12px;justify-content:center">' +
      '<button class="btn btn--primary" id="open-word-builder" type="button">' + icon("target") + "Ghép chữ</button>" +
      '<button class="btn btn--outline mic-btn" id="mic-word" type="button">' + icon("mic") + "Đọc to</button>" +
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
    $("#open-word-builder").addEventListener("click", function () {
      if (window.SET_M2) {
        window.SET_M2.openWordBuilder({ lesson: lesson, item: item });
      }
    });
    if (window.SET_M2) {
      window.SET_M2.attachMic($("#mic-word"), {
        target: item.word,
        key: lesson.id + ":" + item.id + ":vocab"
      });
    }
    $("#mark-known").addEventListener("click", function (event) {
      var was = !!progress.remembered[key];
      progress.remembered[key] = true;
      delete progress.review[key];
      if (!was) award(5, 1);
      maybeAwardLessonSticker(lesson);
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
        '<button class="btn btn--outline btn--sm" type="button" data-build-pattern="' + esc(pattern.id) + '">' + icon("target") + "Lắp câu</button>" +
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
    $$("[data-build-pattern]", view).forEach(function (button) {
      button.addEventListener("click", function () {
        var patternId = button.getAttribute("data-build-pattern");
        var pattern = patterns.filter(function (entry) { return entry.id === patternId; })[0];
        if (pattern && window.SET_M2) {
          window.SET_M2.openLego({ lesson: lesson, pattern: pattern });
        }
      });
    });
    announce(patterns.length + " mẫu ngữ pháp.");
  }

  /* ---------------- games hub ---------------- */

  function renderGamesHub(lesson) {
    setTitle("Mini-games · " + lesson.title);
    var meta = window.SET_GAMES ? window.SET_GAMES.meta : null;
    if (!meta) {
      setView(lessonTabs(lesson, "games") + '<div class="card empty-state">' + icon("spark", "icon--lg") + '<h2 class="empty-state__title">Mini-games chưa tải</h2><p>Hãy kiểm tra kết nối hoặc tải lại trang.</p></div>');
      return;
    }
    var order = ["balloon", "boss", "memory", "detective", "listen"];
    var cards = order.map(function (key) {
      var info = meta[key];
      if (!info) return "";
      var plays = progress.games["game:" + lesson.id + ":" + key];
      var countText = key === "memory" ? Math.min(6, lesson.vocabulary.length) + " cặp thẻ" : key === "listen" ? "5 câu nghe" : "6 câu";
      return '<button class="module-card" type="button" data-game="' + key + '">' +
        '<span class="module-card__icon">' + icon(info.icon, "icon--lg") + "</span>" +
        '<span class="module-card__title">' + esc(info.title) + "</span>" +
        '<span class="module-card__desc">' + esc(info.subtitle) + "</span>" +
        '<span class="module-card__meta">' + esc(countText) + (plays ? " · đã chơi " + plays.plays + " lần" : "") + "</span>" +
        "</button>";
    }).join("");

    setView(
      lessonTabs(lesson, "games") +
      moduleHeader("Phân hệ 5", "Mini-games", "Năm trò chơi kiểm tra từ vựng, ngữ pháp, đọc hiểu và nghe. Mọi thao tác đều bằng chạm.") +
      '<div class="module-grid">' + cards + "</div>" +
      '<div class="hint-card">' + icon("info") + "<div><strong>Mẹo nhỏ:</strong> mỗi mini-game thắng lần đầu sẽ mở một Sticker mới trong Kho báu. Trả lời sai sẽ được đưa vào Kho báu cần chinh phục để ôn lại đúng lúc.</div></div>" +
      '<div class="cta-row" style="margin-top:18px"><a class="btn btn--outline" href="#/lesson/' + encodeURIComponent(lesson.id) + '/review">' + icon("refresh") + "Ôn tập kho báu</a></div>"
    );

    $$("[data-game]", view).forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.getAttribute("data-game");
        window.SET_GAMES.open(key, {
          lesson: lesson,
          items: lesson.quiz,
          api: makeGamesApi(lesson)
        });
      });
    });
    announce("Năm mini-game của bài " + lesson.title + ".");
  }

  /* ---------------- spaced repetition review ---------------- */

  function renderReview(lesson) {
    setTitle("Ôn tập · " + lesson.title);
    var records = dueMistakes(lesson.id);
    var items = records.map(function (record) {
      return lesson.quiz.filter(function (item) {
        return item.id === record.quizId || item.id === record.itemId;
      })[0];
    }).filter(Boolean);
    var bankSize = Object.keys(progress.mistakes).filter(function (key) {
      var record = progress.mistakes[key];
      return record && record.lessonId === lesson.id;
    }).length;

    if (!items.length) {
      setView(
        lessonTabs(lesson, "review") +
        moduleHeader("Spaced Repetition", "Kho báu cần chinh phục", "Khi con trả lời sai, từ hoặc câu đó được cất vào kho báu và nhắc ôn lại đúng lúc con sắp quên.") +
        '<div class="card empty-state">' + icon("star", "icon--lg") + '<h2 class="empty-state__title">' + (bankSize ? "Hôm nay chưa có mục nào cần ôn" : "Kho báu đang trống") + "</h2>" +
        "<p>" + (bankSize ? "Con đã ôn đúng lịch. Quay lại sau nhé — hệ thống sẽ nhắc khi trí nhớ bắt đầu phai." : "Hãy chơi mini-game hoặc luyện nhanh; những câu sai sẽ tự động được đưa vào đây.") + "</p>" +
        '<a class="btn btn--primary" href="#/lesson/' + encodeURIComponent(lesson.id) + '/games">' + icon("spark") + "Chơi mini-game</a></div>"
      );
      announce("Kho báu chưa có mục cần ôn.");
      return;
    }

    setView(
      lessonTabs(lesson, "review") +
      moduleHeader("Spaced Repetition", "Kho báu cần chinh phục", "Ôn lại đúng thời điểm giúp con nhớ lâu hơn mà không phải học lại từ đầu.") +
      '<div class="quiz-wrap"><section class="card quiz-card" id="review-card"></section></div>'
    );

    var index = 0;
    var correct = 0;
    var card = $("#review-card");

    function renderQuestion() {
      if (index >= items.length) {
        card.classList.add("quiz-done");
        card.innerHTML = icon("star", "icon--lg") +
          '<h2 class="quiz-done__title">Đã ôn xong kho báu!</h2>' +
          "<p>Con đã ôn " + items.length + " mục và trả lời đúng " + correct + " câu. Hệ thống đã hẹn lịch nhắc lại.</p>" +
          '<div class="btn-row" style="width:100%;max-width:520px;margin-top:8px">' +
          '<a class="btn btn--primary" href="#/lesson/' + encodeURIComponent(lesson.id) + '/games">' + icon("spark") + "Chơi mini-game</a>" +
          '<a class="btn btn--outline" href="#/lesson/' + encodeURIComponent(lesson.id) + '">Về bài học</a></div>';
        burstConfetti();
        announce("Đã ôn xong " + items.length + " mục.");
        return;
      }
      var item = items[index];
      var options = (item.options || []).map(function (option, optionIndex) {
        return '<button class="answer" type="button" data-review-option="' + optionIndex + '">' +
          '<span class="answer__key">' + "ABCD".charAt(optionIndex) + "</span>" +
          '<span class="answer__text">' + esc(option) + "</span>" +
          '<span class="answer__mark" aria-hidden="true"></span></button>';
      }).join("");
      card.classList.remove("quiz-done");
      card.innerHTML =
        '<div class="quiz-top"><span class="quiz-count">Mục ' + (index + 1) + " / " + items.length + "</span>" +
        '<span class="quiz-xp">' + icon("refresh") + " +5 XP</span></div>" +
        '<div class="meta-row"><span class="chip chip--cyan">' + esc(SKILL_LABEL[item.skill] || item.skill || "") + "</span>" +
        '<span class="chip">' + esc(item.difficulty || "easy") + "</span></div>" +
        '<h2 class="quiz-prompt">' + esc(item.prompt_en || "").replace(/_{2,}/g, '<span class="cloze-blank">____</span>') + "</h2>" +
        (item.prompt_vi ? '<p class="muted" style="color:var(--muted-on-card);font-size:16px">' + esc(item.prompt_vi) + "</p>" : "") +
        '<div class="answers" role="group" aria-label="Các đáp án">' + options + "</div>" +
        '<div class="feedback" id="review-feedback" role="status" aria-live="polite">' + icon("info") + '<div><span class="feedback__title">Ôn lại nào</span><span class="feedback__text">Chọn đáp án con nhớ được.</span></div></div>' +
        '<div class="quiz-footer"><button class="btn btn--primary" id="review-next" type="button" hidden>Tiếp tục ' + icon("arrow-right") + "</button></div>";

      var feedback = $("#review-feedback");
      var next = $("#review-next");
      $$("[data-review-option]", card).forEach(function (button) {
        button.addEventListener("click", function () {
          if (button.disabled) return;
          var choice = parseInt(button.getAttribute("data-review-option"), 10);
          if (choice === item.answer_index) {
            button.classList.add("is-correct");
            button.querySelector(".answer__mark").innerHTML = icon("check");
            $$("[data-review-option]", card).forEach(function (node) { node.disabled = true; });
            reviewItem(lesson, item, true);
            correct += 1;
            award(5, 0);
            feedback.className = "feedback feedback--ok";
            feedback.innerHTML = icon("check") + '<div><span class="feedback__title">Nhớ lại chính xác! +5 XP</span><span class="feedback__text">' + esc(item.explanation_vi || "Con nhớ rất tốt.") + "</span></div>";
            next.hidden = false;
            next.focus({ preventScroll: true });
            burstConfetti();
          } else {
            button.classList.add("is-wrong");
            button.disabled = true;
            button.querySelector(".answer__mark").innerHTML = icon("x");
            reviewItem(lesson, item, false);
            feedback.className = "feedback feedback--hint";
            feedback.innerHTML = icon("spark") + '<div><span class="feedback__title">Chưa đúng, thử lại nhé</span><span class="feedback__text">' + esc(item.hint_vi || "Con đọc lại câu hỏi và chọn đáp án khác.") + "</span></div>";
          }
        });
      });
      next.addEventListener("click", function () {
        index += 1;
        renderQuestion();
      });
    }

    renderQuestion();
    onCleanup(function () {
      TTS.stop();
    });
    announce("Ôn tập " + items.length + " mục đến hạn.");
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
        '<div class="read-turn__voice"><button class="btn btn--outline btn--sm mic-btn" type="button" data-mic-turn="' + index + '" aria-label="Đọc to câu của ' + esc(line.speaker || "") + '">' + icon("mic") + "Đọc to</button></div>" +
        "</div></div>"
      );
    }).join("");

    setView(
      lessonTabs(lesson, "read") +
      moduleHeader("Phân hệ 4", dialogue.title || "Read-Along", "Chạm vào từng từ để nghe và xem nghĩa. Bật “Nghe cả đoạn” để đọc đuổi, hoặc bấm “Đọc to” để luyện micro.") +
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

    function wordButtonsFor(index) {
      return $$('.word-btn[data-turn="' + index + '"]', view);
    }

    function highlightWord(index, charIndex) {
      var buttons = wordButtonsFor(index);
      var active = null;
      buttons.forEach(function (button) {
        var start = parseInt(button.getAttribute("data-start"), 10);
        if (start <= charIndex) active = button;
      });
      buttons.forEach(function (button) {
        button.classList.toggle("is-speaking", button === active);
      });
    }

    function speakTurn(index) {
      var line = dialogue.lines[index];
      if (!line) return;
      clearHighlight();
      var turn = $('.read-turn[data-turn="' + index + '"]', view);
      if (turn) turn.classList.add("is-speaking");
      TTS.speak(line.en, {
        onBoundary: function (event) {
          highlightWord(index, event.charIndex || 0);
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
          onBoundary: function (event) {
            if (myToken !== ui.readToken) return;
            highlightWord(index, event.charIndex || 0);
          },
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
    $$("[data-mic-turn]", view).forEach(function (button) {
      var index = parseInt(button.getAttribute("data-mic-turn"), 10) || 0;
      var line = dialogue.lines[index];
      if (line && window.SET_M2) {
        window.SET_M2.attachMic(button, {
          target: line.en,
          key: lesson.id + ":" + dialogue.id + ":" + index
        });
      }
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
          if (button.disabled) return;
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
            reviewItem(lesson, item, true);
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
            recordMistake(lesson, item);
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

  /* ---------------- rewards ---------------- */

  function refreshShields() {
    var streak = progress.streak || 0;
    var allowed = Math.min(3, Math.floor(streak / 3));
    if (allowed > (progress.shields || 0) && streak > (progress.shieldGrantedFor || 0)) {
      progress.shields = allowed;
      progress.shieldGrantedFor = streak;
      saveProgress();
    }
    return progress.shields || 0;
  }

  function renderRewards() {
    setTitle("Kho báu");
    var pet = progress.pet || { fed: 0, level: 1 };
    var fed = pet.fed || 0;
    var level = 1 + Math.floor(fed / 3);
    var shields = refreshShields();
    var stickerKeys = Object.keys(STICKER_LABELS);
    var unlocked = stickerKeys.filter(function (key) { return !!progress.stickers[key]; });
    var stickerHtml = stickerKeys.map(function (key) {
      var sticker = progress.stickers[key];
      var label = STICKER_LABELS[key];
      return '<div class="sticker' + (sticker ? " is-unlocked" : " is-locked") + '">' +
        '<span class="sticker__icon">' + icon(sticker ? "star" : "lock", "icon--lg") + "</span>" +
        '<span class="sticker__name">' + esc(label) + "</span>" +
        '<span class="sticker__meta">' + (sticker ? "Đã mở " + esc(sticker.date || "") : "Chưa mở khóa") + "</span></div>";
    }).join("");
    var gameRows = Object.keys(progress.games).map(function (key) {
      var entry = progress.games[key];
      var parts = key.split(":");
      var lessonId = parts[1] || "";
      var type = parts[2] || "";
      var meta = window.SET_GAMES && window.SET_GAMES.meta ? window.SET_GAMES.meta[type] : null;
      return '<li class="game-stat"><span>' + esc((meta && meta.title) || type) + '<small> · ' + esc(lessonId) + "</small></span>" +
        '<span class="game-stat__score">' + icon("star") + " " + (entry.bestStars || 0) + " · " + (entry.plays || 0) + " lượt</span></li>";
    }).join("");
    var dueCount = dueMistakes(null).length;
    var mistakeTotal = Object.keys(progress.mistakes).length;

    setView(
      '<section class="design-hero"><div class="eyebrow">Kho báu</div>' +
      '<h1 class="design-hero__title">Phần thưởng của con</h1>' +
      '<p class="design-hero__sub">Sao, Sticker, thú cưng và khiên chuỗi ngày là những phần thưởng nhỏ giúp con học đều mỗi ngày.</p></section>' +
      '<div class="reward-grid">' +
      '<section class="card pet-card"><div class="pet-card__art">' + icon("rocket", "icon--lg") + "</div>" +
      '<div><div class="eyebrow">Thú cưng đồng hành</div><h2 class="pet-card__name">Cún Phi Hành Gia</h2>' +
      '<p class="pet-card__level">Cấp ' + level + " · Đã cho ăn " + fed + " lần</p>" +
      '<p class="pet-card__hint">Dùng 3 Sao để cho bạn ấy ăn và mở khóa cấp mới.</p></div>' +
      '<button class="btn btn--primary" id="feed-pet" type="button"' + (progress.stars < 3 ? " disabled" : "") + ">" + icon("star") + "Cho ăn · 3 Sao</button>" +
      '<span class="pet-card__stars">' + icon("star") + " " + progress.stars + " Sao</span></section>" +
      '<section class="card shield-card"><div class="shield-card__art">' + icon("check", "icon--lg") + "</div>" +
      '<div><div class="eyebrow">Khiên chuỗi ngày</div><h2 class="pet-card__name">' + shields + " / 3 khiên</h2>" +
      '<p class="pet-card__level">Chuỗi hiện tại: ' + (progress.streak || 0) + ' ngày</p>' +
      '<p class="pet-card__hint">Học đủ 3 ngày liên tiếp sẽ nhận 1 khiên. Khiên giúp con nghỉ một ngày mà không mất chuỗi.</p></div></section>' +
      "</div>" +
      '<section class="section"><div class="section__head"><div><div class="eyebrow">Bộ sưu tập</div><h2 class="section__title">Sticker Book</h2></div>' +
      '<span class="section__hint">' + unlocked.length + "/" + stickerKeys.length + " sticker đã mở</span></div>" +
      '<div class="sticker-grid">' + stickerHtml + "</div></section>" +
      '<section class="section"><div class="section__head"><div><div class="eyebrow">Hành trình</div><h2 class="section__title">Kho báu cần chinh phục</h2></div></div>' +
      '<div class="panel--light"><div class="progress-summary">' +
      '<span class="summary-chip">' + icon("refresh") + "Cần ôn hôm nay <b>" + dueCount + "</b></span>" +
      '<span class="summary-chip">' + icon("book") + "Tổng mục trong kho <b>" + mistakeTotal + "</b></span>" +
      '<span class="summary-chip">' + icon("star") + "Sao <b>" + progress.stars + "</b></span>" +
      '<span class="summary-chip">' + icon("bolt") + "XP <b>" + progress.xp + "</b></span></div>" +
      (dueCount ? '<a class="btn btn--primary" href="#/lesson/' + encodeURIComponent((dueMistakes(null)[0] || {}).lessonId || "") + '/review">' + icon("refresh") + "Ôn ngay</a>" : '<p class="dev-note">Hôm nay chưa có mục nào đến hạn. Con cứ học và chơi, hệ thống sẽ nhắc đúng lúc.</p>') +
      "</div></section>" +
      '<section class="section"><div class="section__head"><div><div class="eyebrow">Thành tích</div><h2 class="section__title">Mini-games đã chơi</h2></div></div>' +
      '<div class="panel--light">' + (gameRows ? '<ul class="game-stat-list">' + gameRows + "</ul>" : '<p class="dev-note">Chưa có lượt chơi nào. Hãy mở một bài học và chọn Mini-games nhé.</p>') + "</div></section>"
    );

    var feed = $("#feed-pet");
    if (feed) {
      feed.addEventListener("click", function () {
        if (progress.stars < 3) {
          toast("Con cần thêm Sao để cho thú cưng ăn nhé.");
          return;
        }
        progress.stars -= 3;
        progress.pet = progress.pet || { fed: 0, level: 1 };
        progress.pet.fed = (progress.pet.fed || 0) + 1;
        progress.pet.level = 1 + Math.floor(progress.pet.fed / 3);
        saveProgress();
        toast("Thú cưng đã ăn ngon! Cấp " + progress.pet.level + ".");
        renderRewards();
      });
    }
    announce("Kho báu: " + unlocked.length + " sticker, " + dueCount + " mục cần ôn.");
  }

  /* ---------------- parent dashboard ---------------- */

  function renderParent() {
    setTitle("Góc Phụ huynh");
    setView('<div id="parent-root"></div>');
    if (!window.SET_PARENT) {
      setView('<div class="card empty-state">' + icon("lock", "icon--lg") + '<h2 class="empty-state__title">Góc Phụ Huynh chưa tải</h2><p>Hãy tải lại trang để nạp module phụ huynh.</p><a class="btn btn--primary" href="#/home">Về trang chủ</a></div>');
      return;
    }
    window.SET_PARENT.mount($("#parent-root"), makeParentApi());
    announce("Góc phụ huynh, khu vực được bảo vệ bằng câu hỏi toán.");
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
    if (path === "rewards") {
      updateNav("rewards");
      renderRewards();
      return;
    }
    if (path === "parent") {
      updateNav("parent");
      renderParent();
      return;
    }
    if (path === "import") {
      handleSharedImport();
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
      else if (moduleName === "games") renderGamesHub(lesson);
      else if (moduleName === "review") renderReview(lesson);
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
    setupPracticeApi();
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
