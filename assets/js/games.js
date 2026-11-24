/* Space Explorer · M3 gamified quiz engine
   Five offline mini-games rendered as accessible overlays.
   window.SET_GAMES.open(type, { lesson, items, api }) */
(function () {
  "use strict";

  var META = {
    balloon: {
      type: "balloon",
      gameType: "balloon_pop",
      title: "Balloon Pop",
      subtitle: "Chạm đúng quả bóng trước khi nó bay mất",
      sticker: "sticker_balloon",
      icon: "spark"
    },
    boss: {
      type: "boss",
      gameType: "boss_battle",
      title: "Monster Boss Battle",
      subtitle: "Trả lời đúng để tung chiêu hạ Boss",
      sticker: "sticker_boss",
      icon: "flame"
    },
    memory: {
      type: "memory",
      gameType: "memory_match",
      title: "Treasure Memory Match",
      subtitle: "Lật thẻ tìm cặp từ và nghĩa",
      sticker: "sticker_memory",
      icon: "star"
    },
    detective: {
      type: "detective",
      gameType: "detective_cloze",
      title: "Detective Fill-in-the-Blank",
      subtitle: "Tìm mảnh ghép còn thiếu trong câu",
      sticker: "sticker_detective",
      icon: "compass"
    },
    listen: {
      type: "listen",
      gameType: "listen_tap",
      title: "Listen & Tap",
      subtitle: "Nghe thật kỹ rồi chạm đáp án đúng",
      sticker: "sticker_listen",
      icon: "ear"
    },
    typing: {
      type: "typing",
      gameType: "word_typing",
      title: "Spell Rocket",
      subtitle: "Tự nhập từ vựng tiếng Anh để phóng tên lửa",
      sticker: "sticker_typing",
      icon: "target"
    },
    speak: {
      type: "speak",
      gameType: "voice_challenge",
      title: "Voice Commander",
      subtitle: "Đọc to từ và câu tiếng Anh để nạp năng lượng",
      sticker: "sticker_speak",
      icon: "mic"
    }
  };

  var ALIASES = {
    balloon_pop: "balloon",
    boss_battle: "boss",
    memory_match: "memory",
    detective_cloze: "detective",
    listen_tap: "listen",
    word_typing: "typing",
    voice_challenge: "speak"
  };

  var api = {};
  var lesson = null;
  var modal = null;
  var timers = [];
  var game = null;
  var originalOptions = null;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function esc(value) {
    if (api.esc) return api.esc(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function icon(name, cls) {
    if (api.icon) return api.icon(name, cls);
    return '<svg class="icon ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function notify(message) {
    if (api.toast) api.toast(message);
  }

  function celebrate() {
    if (api.confetti) api.confetti();
  }

  function speak(text, options) {
    if (api.speak) return api.speak(text, options || {});
    return null;
  }

  function recordMistake(item) {
    if (item && api.recordMistake) api.recordMistake(item);
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = copy[i];
      copy[i] = copy[j];
      copy[j] = swap;
    }
    return copy;
  }

  function clearTimers() {
    timers.forEach(function (timer) {
      window.clearInterval(timer);
      window.clearTimeout(timer);
    });
    timers = [];
  }

  function later(fn, ms) {
    var id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function interval(fn, ms) {
    var id = window.setInterval(fn, ms);
    timers.push(id);
    return id;
  }

  function starsFor(correct, total) {
    if (!total) return 1;
    var ratio = correct / total;
    if (ratio >= 0.9) return 3;
    if (ratio >= 0.6) return 2;
    return 1;
  }

  function itemOptions(item) {
    var options = Array.isArray(item && item.options) ? item.options.slice(0, 4) : [];
    return options.length >= 2 ? options : ["A", "B"];
  }

  function answerIndex(item) {
    var options = itemOptions(item);
    var index = item && typeof item.answer_index === "number" ? item.answer_index : 0;
    return index >= 0 && index < options.length ? index : 0;
  }

  function pickItems(type, count) {
    var source = Array.isArray(originalOptions) ? originalOptions : [];
    var filtered = source.filter(function (item) {
      return item && item.game_type === type;
    });
    var pool = filtered.slice();
    if (lesson && lesson.subject !== "english" && pool.length < count) {
      var seen = {};
      pool.forEach(function (entry) { if (entry && entry.id) seen[entry.id] = true; });
      shuffle(source).forEach(function (item) {
        if (pool.length < count && item && Array.isArray(item.options) && item.options.length >= 2 && (!item.id || !seen[item.id])) {
          pool.push(item);
          if (item.id) seen[item.id] = true;
        }
      });
    }
    if (!pool.length) {
      pool = source.filter(function (item) {
        return item && Array.isArray(item.options) && item.options.length >= 2;
      });
    }
    if (!pool.length) {
      var quiz = lesson && Array.isArray(lesson.quiz) ? lesson.quiz : [];
      pool = quiz.filter(function (item) {
        return item && Array.isArray(item.options) && item.options.length >= 2;
      });
    }
    return pool.slice(0, Math.max(1, count));
  }

  function vocabFor(item) {
    if (!item || !lesson || !Array.isArray(lesson.vocabulary)) return null;
    return lesson.vocabulary.filter(function (entry) {
      return entry.id === item.vocab_id;
    })[0] || null;
  }

  function openModalShell(meta) {
    var previous = document.activeElement;
    var wrapper = document.createElement("div");
    wrapper.className = "gx-modal";
    wrapper.innerHTML =
      '<section class="gx-stage" role="dialog" aria-modal="true" aria-labelledby="gx-title">' +
      '<header class="gx-head"><div><span class="gx-badge">' + icon("spark") + "M3 · Mini-game</span>" +
      '<h2 class="gx-title" id="gx-title">' + esc(meta.title) + "</h2>" +
      '<p class="gx-subtitle">' + esc(meta.subtitle) + "</p></div>" +
      '<button class="btn btn--ghost btn--icon" type="button" data-gx-close aria-label="Đóng mini-game">' + icon("x") + "</button></header>" +
      '<div class="gx-body"></div></section>';
    document.body.appendChild(wrapper);
    document.body.classList.add("gx-open");
    modal = {
      wrapper: wrapper,
      body: wrapper.querySelector(".gx-body"),
      closeButton: wrapper.querySelector("[data-gx-close]"),
      previous: previous
    };
    modal.closeButton.addEventListener("click", close);
    wrapper.addEventListener("click", function (event) {
      if (event.target === wrapper) close();
    });
    wrapper.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") {
        var nodes = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', wrapper).filter(function (node) {
          return !node.disabled && node.offsetParent !== null;
        });
        if (!nodes.length) return;
        var first = nodes[0];
        var last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    later(function () {
      modal.closeButton.focus({ preventScroll: true });
    }, 40);
  }

  function close() {
    clearTimers();
    if (modal) {
      var previous = modal.previous;
      modal.wrapper.remove();
      modal = null;
      document.body.classList.remove("gx-open");
      if (previous && typeof previous.focus === "function") previous.focus({ preventScroll: true });
    }
    game = null;
    lesson = null;
    originalOptions = null;
  }

  function setFeedback(kind, title, text) {
    var node = $(".gx-feedback", modal.body);
    if (!node) return;
    node.className = "gx-feedback gx-feedback--" + kind;
    node.innerHTML = icon(kind === "ok" ? "check" : kind === "hint" ? "spark" : "info") +
      "<div><strong>" + esc(title) + "</strong><span>" + esc(text) + "</span></div>";
  }

  function renderFinish(result) {
    clearTimers();
    var stars = typeof result.stars === "number" ? result.stars : starsFor(result.correct, result.total);
    var completion = {
      type: game.type,
      gameType: META[game.type].gameType,
      lessonId: lesson.id,
      correct: result.correct,
      total: result.total,
      xp: result.xp,
      stars: stars,
      sticker: META[game.type].sticker
    };
    var outcome = null;
    if (api.completeGame) outcome = api.completeGame(completion);
    var starHtml = "";
    for (var i = 0; i < 3; i += 1) {
      starHtml += '<span class="' + (i < stars ? "gx-star-on" : "gx-star-off") + '" aria-hidden="true">★</span>';
    }
    modal.body.innerHTML =
      '<div class="gx-win">' +
      '<div class="gx-win-icon">' + icon("star", "icon--lg") + "</div>" +
      '<h3 class="gx-win-title">' + (stars >= 2 ? "Tuyệt vời!" : "Hoàn thành!") + "</h3>" +
      '<p class="gx-win-sub">' + esc(result.message || "Con đã chơi xong mini-game này. Mỗi lần chơi là một lần nhớ lâu hơn.") + "</p>" +
      '<div class="gx-stars" aria-label="' + stars + ' trên 3 sao">' + starHtml + "</div>" +
      '<div class="gx-score-grid">' +
      '<div class="gx-score-cell"><span class="gx-score-value">' + result.correct + "/" + result.total + '</span><span class="gx-score-label">Câu đúng</span></div>' +
      '<div class="gx-score-cell"><span class="gx-score-value">' + result.xp + '</span><span class="gx-score-label">XP</span></div>' +
      '<div class="gx-score-cell"><span class="gx-score-value">' + stars + '</span><span class="gx-score-label">Sao</span></div>' +
      "</div>" +
      (outcome && outcome.newSticker ? '<div class="gx-sticker-new">' + icon("star") + "Sticker mới: " + esc(outcome.stickerLabel || "Bộ sưu tập") + "!</div>" : "") +
      '<div class="gx-win-actions"><button class="btn btn--primary" type="button" data-gx-replay>' + icon("refresh") + "Chơi lại</button>" +
      '<button class="btn btn--outline" type="button" data-gx-done>Đóng</button></div></div>';
    var replay = $("[data-gx-replay]", modal.body);
    var done = $("[data-gx-done]", modal.body);
    replay.addEventListener("click", function () {
      var type = game.type;
      var options = { lesson: lesson, items: originalOptions, api: api };
      close();
      window.SET_GAMES.open(type, options);
    });
    done.addEventListener("click", close);
    celebrate();
    replay.focus({ preventScroll: true });
  }

  /* ---------------- shared question header ---------------- */

  function questionHeader(round, total, extra) {
    return '<div class="gx-top"><span class="gx-counter">Câu ' + (round + 1) + " / " + total + "</span>" +
      (extra || "") + "</div>";
  }

  function optionLetters(index) {
    return "ABCD".charAt(index);
  }

  /* ---------------- 1. Balloon Pop ---------------- */

  function gameQuestionCap(defaultCap) {
    var total = lesson && Array.isArray(lesson.quiz) ? lesson.quiz.length : 0;
    return lesson && lesson.subject !== "english" && total >= 8 ? Math.min(10, total) : defaultCap;
  }

  function startBalloon() {
    var pool = pickItems("balloon_pop", gameQuestionCap(6));
    game = { type: "balloon", round: 0, correct: 0, combo: 0, bestCombo: 0, xp: 0, locked: false };
    renderBalloonRound(pool);
  }

  function renderBalloonRound(pool) {
    if (game.round >= pool.length) {
      renderFinish({
        correct: game.correct,
        total: pool.length,
        xp: game.xp + 10,
        message: "Con đã bắt được " + game.correct + " quả bóng. Combo cao nhất: " + game.bestCombo + "!"
      });
      return;
    }
    var item = pool[game.round];
    var options = shuffle(itemOptions(item).map(function (text, index) {
      return { text: text, correct: index === answerIndex(item) };
    }));
    var step = options.length > 1 ? 80 / (options.length - 1) : 0;
    var balloons = options.map(function (option, index) {
      var palette = ["a", "b", "c", "d"][index % 4];
      var x = options.length > 1 ? 10 + index * step : 50;
      return '<button class="gx-balloon gx-balloon--' + palette + '" type="button" data-balloon="' + index + '" style="--x:' + x + "%;--delay:" + (index * 0.18).toFixed(2) + "s;--dur:" + (10 + index % 3) + 's">' +
        '<span class="gx-balloon__body">' + esc(option.text) + "</span>" +
        '<span class="gx-balloon__string" aria-hidden="true"></span></button>';
    }).join("");

    modal.body.innerHTML =
      questionHeader(game.round, pool.length, '<span class="gx-combo">' + icon("bolt") + "Combo " + game.combo + "</span>" + '<span class="gx-combo">' + icon("star") + " " + game.xp + " XP</span>") +
      '<div class="gx-prompt-card"><div class="gx-prompt-label">Chạm quả bóng đúng</div>' +
      '<p class="gx-prompt">' + esc(item.prompt_vi || item.prompt_en || "Chọn đáp án đúng") + "</p>" +
      '<button class="btn btn--outline btn--sm" type="button" data-gx-speak>' + icon("speaker") + "Nghe lại</button></div>" +
      '<div class="gx-timer" role="progressbar" aria-label="Thời gian còn lại"><span class="gx-timer-fill"></span></div>' +
      '<div class="gx-balloon-field">' + balloons + "</div>" +
      '<div class="gx-feedback gx-feedback--info" role="status" aria-live="polite">' + icon("info") + "<div><strong>Chạm bóng bay</strong><span>Đúng rồi thì bóng sẽ nổ và con được cộng điểm.</span></div></div>";

    var remaining = 15;
    var fill = $(".gx-timer-fill", modal.body);
    if (fill) fill.style.width = "100%";
    var tick = interval(function () {
      remaining -= 0.1;
      if (fill) fill.style.width = Math.max(0, (remaining / 15) * 100) + "%";
      if (remaining <= 0) {
        window.clearInterval(tick);
        game.locked = true;
        setFeedback("hint", "Hết giờ", "Không sao! Mình chuyển sang quả bóng tiếp theo nhé.");
        later(function () {
          game.round += 1;
          game.locked = false;
          renderBalloonRound(pool);
        }, 800);
      }
    }, 100);

    $("[data-gx-speak]", modal.body).addEventListener("click", function () {
      speak(item.audio_text || item.prompt_en || "");
    });
    speak(item.audio_text || item.prompt_en || "");

    $$("[data-balloon]", modal.body).forEach(function (button) {
      button.addEventListener("click", function () {
        if (game.locked) return;
        var index = parseInt(button.getAttribute("data-balloon"), 10);
        if (options[index] && options[index].correct) {
          game.locked = true;
          game.correct += 1;
          game.combo += 1;
          game.bestCombo = Math.max(game.bestCombo, game.combo);
          game.xp += 6;
          button.classList.add("is-popped");
          setFeedback("ok", "Bóng nổ!", "Chính xác! +6 XP. Combo " + game.combo + ".");
          window.clearInterval(tick);
          later(function () {
            game.round += 1;
            game.locked = false;
            renderBalloonRound(pool);
          }, 700);
        } else {
          if (!button.classList.contains("is-wrong")) {
            button.classList.add("is-wrong");
            button.disabled = true;
            game.combo = 0;
            recordMistake(item);
            setFeedback("hint", "Gần đúng rồi", item.hint_vi || "Con thử quả bóng khác nhé.");
            speak(item.hint_vi || "");
          }
        }
      });
    });
  }

  /* ---------------- 2. Boss Battle ---------------- */

  function startBoss() {
    var pool = pickItems("boss_battle", gameQuestionCap(6));
    game = { type: "boss", pool: pool, round: 0, correct: 0, combo: 0, hp: 100, shields: 3, xp: 0, damage: Math.ceil(100 / Math.max(1, pool.length)) };
    renderBossRound();
  }

  function bossArt() {
    return '<div class="gx-boss-scene">' +
      '<div class="gx-hero" aria-hidden="true">' + icon("rocket", "icon--lg") + "</div>" +
      '<div class="gx-boss" aria-hidden="true"><svg viewBox="0 0 160 140" role="img" aria-label="Quái vật thân thiện">' +
      '<ellipse cx="80" cy="80" rx="62" ry="52" fill="#7c3aed"/><ellipse cx="80" cy="86" rx="48" ry="38" fill="#a78bfa"/>' +
      '<circle cx="60" cy="70" r="13" fill="#f8fafc"/><circle cx="100" cy="70" r="13" fill="#f8fafc"/>' +
      '<circle cx="62" cy="73" r="6" fill="#0f172a"/><circle cx="102" cy="73" r="6" fill="#0f172a"/>' +
      '<path d="M58 98 Q80 114 102 98" fill="none" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M46 40 L38 22 L56 32 Z M114 40 L122 22 L104 32 Z" fill="#fbbf24"/>' +
      '<path d="M78 28 L84 14 L90 28" fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/>' +
      "</svg></div></div>";
  }

  function renderBossRound() {
    var pool = game.pool;
    if (game.round >= pool.length) {
      renderFinish({
        correct: game.correct,
        total: pool.length,
        xp: game.xp + 8,
        stars: game.correct === pool.length ? 3 : game.correct >= Math.ceil(pool.length * 0.6) ? 2 : 1,
        message: "Boss đã bị đánh bại! Combo cao nhất: " + game.combo + "."
      });
      return;
    }
    var item = pool[game.round];
    var options = itemOptions(item);
    var optionHtml = options.map(function (text, index) {
      return '<button class="gx-option" type="button" data-boss-option="' + index + '">' +
        '<span class="gx-option-key">' + optionLetters(index) + "</span>" +
        '<span class="gx-option-text">' + esc(text) + "</span></button>";
    }).join("");
    var pips = "";
    for (var i = 0; i < 3; i += 1) {
      pips += '<span class="gx-pip' + (i < game.shields ? " is-on" : "") + '" aria-hidden="true">' + icon("check") + "</span>";
    }

    modal.body.innerHTML =
      questionHeader(game.round, pool.length, '<span class="gx-combo">' + icon("flame") + "Combo " + game.combo + "</span>") +
      '<div class="gx-boss-hud"><div class="gx-boss-name">Quái vật Từ Vựng <span class="gx-shields" role="img" aria-label="Khiên còn ' + game.shields + '">' + pips + "</span></div>" +
      '<div class="gx-hp" role="progressbar" aria-label="Máu Boss" aria-valuenow="' + game.hp + '" aria-valuemin="0" aria-valuemax="100"><span class="gx-hp-fill" style="width:' + Math.max(0, game.hp) + '%"></span></div>' +
      '<div class="gx-hp-label">' + Math.max(0, game.hp) + "% HP</div></div>" +
      bossArt() +
      '<div class="gx-prompt-card"><div class="gx-prompt-label">Chọn đáp án đúng để tấn công</div>' +
      '<p class="gx-prompt">' + esc(item.prompt_en || "") + "</p>" +
      (item.prompt_vi ? '<p class="gx-prompt-vi">' + esc(item.prompt_vi) + "</p>" : "") + "</div>" +
      '<div class="gx-options">' + optionHtml + "</div>" +
      '<div class="gx-feedback gx-feedback--info" role="status" aria-live="polite">' + icon("info") + "<div><strong>Lượt của con</strong><span>Chọn đáp án đúng để trừ máu Boss.</span></div></div>";

    $$("[data-boss-option]", modal.body).forEach(function (button) {
      button.addEventListener("click", function () {
        var index = parseInt(button.getAttribute("data-boss-option"), 10);
        if (index === answerIndex(item)) {
          game.correct += 1;
          game.combo += 1;
          game.xp += 7;
          game.hp -= game.damage;
          button.classList.add("is-correct");
          button.querySelector(".gx-option-text").insertAdjacentHTML("beforeend", " " + icon("check"));
          $$("[data-boss-option]", modal.body).forEach(function (node) { node.disabled = true; });
          var boss = $(".gx-boss", modal.body);
          var hero = $(".gx-hero", modal.body);
          if (boss) boss.classList.add("is-hit");
          if (hero) hero.classList.add("is-attacking");
          setFeedback("ok", "Đòn đánh trúng!", "Boss mất " + game.damage + " HP. Combo " + game.combo + ".");
          speak(item.explanation_vi || "Great job!");
          if (game.hp <= 0) {
            later(function () {
              renderFinish({
                correct: game.correct,
                total: pool.length,
                xp: game.xp + 8,
                stars: 3,
                message: "Boss đã bị đánh bại! Con thật dũng cảm."
              });
            }, 700);
          } else {
            later(function () {
              game.round += 1;
              renderBossRound();
            }, 850);
          }
        } else {
          if (button.classList.contains("is-wrong")) return;
          button.classList.add("is-wrong");
          button.disabled = true;
          game.combo = 0;
          game.shields = Math.max(0, game.shields - 1);
          recordMistake(item);
          var bossNode = $(".gx-boss", modal.body);
          if (bossNode) bossNode.classList.add("is-laughing");
          setFeedback("hint", "Boss né được!", item.hint_vi || "Con thử lại đáp án khác nhé.");
          if (game.shields === 0) {
            game.shields = 3;
            setFeedback("hint", "Khiên được hồi!", "Con vẫn an toàn. Thử lại nhé!");
          }
        }
      });
    });
  }

  /* ---------------- 3. Memory Match ---------------- */

  function startMemory() {
    var raw = Array.isArray(lesson.vocabulary) && lesson.vocabulary.length ? lesson.vocabulary : [];
    var isConceptMode = false;
    if (!raw.length && lesson.scienceBlocks && Array.isArray(lesson.scienceBlocks.concept_cards)) {
      isConceptMode = true;
      raw = lesson.scienceBlocks.concept_cards.map(function (c) {
        return {
          id: c.id,
          word: c.term_vi,
          meaning_vi: c.term_en || c.definition_vi,
          icon: c.icon || null,
          speak_text: c.term_en || ""
        };
      });
    }
    var words = (isConceptMode ? shuffle(raw) : raw).slice(0, 6);
    if (!words.length) {
      modal.body.innerHTML = '<div class="gx-empty">' + icon("book", "icon--lg") + '<h3>Chưa có từ vựng</h3><p>Bài học này chưa có thẻ để chơi.</p><button class="btn btn--primary" data-gx-done>Đóng</button></div>';
      $("[data-gx-done]", modal.body).addEventListener("click", close);
      return;
    }
    var cards = [];
    words.forEach(function (word) {
      var speakText = isConceptMode ? (word.speak_text || "") : word.word;
      cards.push({ pair: word.id, label: word.word, kind: "word", icon: word.icon, speak: speakText });
      cards.push({ pair: word.id, label: word.meaning_vi || word.example_en || word.word, kind: "meaning", icon: null, speak: speakText });
    });
    game = { type: "memory", cards: shuffle(cards), flipped: [], matched: {}, moves: 0, lock: false, total: words.length, isConceptMode: isConceptMode };
    renderMemory();
  }

  function renderMemory() {
    var cards = game.cards.map(function (card, index) {
      var matched = !!game.matched[card.pair];
      var flipped = game.flipped.indexOf(index) !== -1 || matched;
      return '<button class="gx-memory-card' + (flipped ? " is-flipped" : "") + (matched ? " is-matched" : "") + '" type="button" data-memory="' + index + '">' +
        '<span class="sr-only">' + (flipped ? esc(card.label) : "Thẻ úp") + "</span>" +
        '<span class="gx-memory-face gx-memory-back" aria-hidden="' + (flipped ? "true" : "false") + '">' + icon("star") + "</span>" +
        '<span class="gx-memory-face gx-memory-front" aria-hidden="' + (flipped ? "false" : "true") + '">' + (card.icon ? '<span class="gx-memory-icon" aria-hidden="true">' + esc(card.icon) + "</span>" : "") +
        "<span>" + esc(card.label) + "</span></span></button>";
    }).join("");
    var pairCount = Object.keys(game.matched).length;
    modal.body.innerHTML =
      questionHeader(pairCount, game.total, '<span class="gx-combo">' + icon("refresh") + "Lượt lật: " + game.moves + "</span>") +
      '<div class="gx-prompt-card"><div class="gx-prompt-label">Lật hai thẻ giống nhau</div>' +
      '<p class="gx-prompt">' + (game.isConceptMode ? "Ghép khái niệm Khoa học (Tiếng Việt ↔ Tiếng Anh)." : "Tìm cặp từ tiếng Anh và nghĩa tiếng Việt.") + "</p></div>" +
      '<div class="gx-memory-grid">' + cards + "</div>" +
      '<div class="gx-feedback gx-feedback--info" role="status" aria-live="polite">' + icon("info") + "<div><strong>Kho báu đang chờ</strong><span>Tìm đủ " + game.total + " cặp để mở rương.</span></div></div>";

    $$("[data-memory]", modal.body).forEach(function (button) {
      button.addEventListener("click", function () {
        if (game.lock) return;
        var index = parseInt(button.getAttribute("data-memory"), 10);
        var card = game.cards[index];
        if (!card || game.matched[card.pair] || game.flipped.indexOf(index) !== -1) return;
        game.flipped.push(index);
        button.classList.add("is-flipped");
        var hiddenLabel = button.querySelector(".sr-only");
        if (hiddenLabel) hiddenLabel.textContent = card.label;
        var front = button.querySelector(".gx-memory-front");
        if (front) front.setAttribute("aria-hidden", "false");
        var back = button.querySelector(".gx-memory-back");
        if (back) back.setAttribute("aria-hidden", "true");
        speak(card.speak, {});
        if (game.flipped.length === 2) {
          game.moves += 1;
          var first = game.cards[game.flipped[0]];
          var second = game.cards[game.flipped[1]];
          if (first.pair === second.pair) {
            game.matched[first.pair] = true;
            game.flipped = [];
            setFeedback("ok", "Ghép đúng!", "Con tìm được một cặp rồi.");
            if (Object.keys(game.matched).length === game.total) {
              var stars = game.moves <= 10 ? 3 : game.moves <= 14 ? 2 : 1;
              later(function () {
                renderFinish({
                  correct: game.total,
                  total: game.total,
                  xp: Math.max(10, 34 - game.moves),
                  stars: stars,
                  message: "Con đã mở rương kho báu sau " + game.moves + " lượt lật."
                });
              }, 700);
            } else {
              later(renderMemory, 450);
            }
          } else {
            game.lock = true;
            setFeedback("hint", "Chưa phải cặp này", "Con nhớ vị trí thẻ rồi thử lại nhé.");
            later(function () {
              game.flipped = [];
              game.lock = false;
              renderMemory();
            }, 900);
          }
        }
      });
    });
  }

  /* ---------------- 4. Detective Cloze ---------------- */

  function startDetective() {
    var pool = pickItems("detective_cloze", gameQuestionCap(5));
    game = { type: "detective", pool: pool, round: 0, correct: 0, xp: 0, wrong: {} };
    renderDetectiveRound();
  }

  function renderDetectiveRound() {
    if (game.round >= game.pool.length) {
      renderFinish({
        correct: game.correct,
        total: game.pool.length,
        xp: game.xp + 6,
        message: "Hồ sơ đã được giải mã! Con là thám tử giỏi."
      });
      return;
    }
    var item = game.pool[game.round];
    var options = itemOptions(item);
    var prompt = esc(item.prompt_en || "").replace(/_{2,}/g, '<span class="gx-blank">____</span>');
    var dots = game.pool.map(function (entry, index) {
      return '<span class="gx-dot' + (index === game.round ? " is-active" : index < game.round ? " is-done" : "") + '"></span>';
    }).join("");
    var optionHtml = options.map(function (text, index) {
      return '<button class="gx-option gx-option--tile" type="button" data-detective-option="' + index + '">' +
        '<span class="gx-option-key">' + optionLetters(index) + "</span>" +
        '<span class="gx-option-text">' + esc(text) + "</span></button>";
    }).join("");

    modal.body.innerHTML =
      '<div class="gx-top"><span class="gx-counter">Hồ sơ ' + (game.round + 1) + " / " + game.pool.length + '</span><span class="gx-combo">' + icon("star") + " " + game.xp + " XP</span></div>" +
      '<div class="gx-progress-dots" aria-hidden="true">' + dots + "</div>" +
      '<div class="gx-clue-card"><div class="gx-clue-tag">' + icon("compass") + "Manh mối</div>" +
      '<p class="gx-prompt">' + prompt + "</p>" +
      (item.prompt_vi ? '<p class="gx-prompt-vi">' + esc(item.prompt_vi) + "</p>" : "") + "</div>" +
      '<div class="gx-options gx-options--tiles">' + optionHtml + "</div>" +
      '<div class="gx-feedback gx-feedback--info" role="status" aria-live="polite">' + icon("info") + "<div><strong>Chọn mảnh ghép</strong><span>Điền từ còn thiếu vào chỗ trống.</span></div></div>";

    $$("[data-detective-option]", modal.body).forEach(function (button) {
      button.addEventListener("click", function () {
        var index = parseInt(button.getAttribute("data-detective-option"), 10);
        if (index === answerIndex(item)) {
          game.correct += 1;
          game.xp += 6;
          button.classList.add("is-correct");
          $$("[data-detective-option]", modal.body).forEach(function (node) { node.disabled = true; });
          setFeedback("ok", "Đúng rồi!", item.explanation_vi || "Con đã tìm ra mảnh ghép chính xác.");
          speak(item.explanation_vi || item.answer_text || options[index]);
          later(function () {
            game.round += 1;
            renderDetectiveRound();
          }, 1000);
        } else {
          if (button.classList.contains("is-wrong")) return;
          button.classList.add("is-wrong");
          button.disabled = true;
          recordMistake(item);
          setFeedback("hint", "Chưa đúng", item.hint_vi || "Con đọc lại manh mối và thử mảnh ghép khác nhé.");
        }
      });
    });
  }

  /* ---------------- 5. Listen & Tap ---------------- */

  function startListen() {
    var pool = pickItems("listen_tap", 5);
    game = { type: "listen", pool: pool, round: 0, correct: 0, xp: 0, wrong: {} };
    renderListenRound();
  }

  function listenTarget(item) {
    if (item.audio_text) return item.audio_text;
    var options = itemOptions(item);
    return options[answerIndex(item)] || item.prompt_en || "";
  }

  function renderListenRound() {
    if (game.round >= game.pool.length) {
      renderFinish({
        correct: game.correct,
        total: game.pool.length,
        xp: game.xp + 6,
        message: "Tai thính lắm! Con nghe và chọn rất tốt."
      });
      return;
    }
    var item = game.pool[game.round];
    var options = itemOptions(item);
    var optionHtml = options.map(function (text, index) {
      var vocab = vocabFor(item);
      var iconHtml = vocab && vocab.icon ? '<span class="gx-listen-icon" aria-hidden="true">' + esc(vocab.icon) + "</span>" : "";
      return '<button class="gx-option gx-option--listen" type="button" data-listen-option="' + index + '">' +
        iconHtml + '<span class="gx-option-text">' + esc(text) + "</span></button>";
    }).join("");

    modal.body.innerHTML =
      questionHeader(game.round, game.pool.length, '<span class="gx-combo">' + icon("ear") + "Nghe & chạm</span>") +
      '<div class="gx-listen-card"><button class="gx-speaker-big" type="button" data-gx-play aria-label="Nghe câu hỏi">' + icon("speaker", "icon--lg") + "</button>" +
      '<p class="gx-prompt">' + esc(item.prompt_vi || "Nghe và chọn từ đúng") + "</p>" +
      '<span class="gx-listen-hint">Bấm loa để nghe lại bất cứ lúc nào</span></div>' +
      '<div class="gx-options gx-options--listen">' + optionHtml + "</div>" +
      '<div class="gx-feedback gx-feedback--info" role="status" aria-live="polite">' + icon("ear") + "<div><strong>Lắng nghe nào</strong><span>Chạm vào từ mà con nghe được.</span></div></div>" +
      '<div class="gx-voice-slot"></div>';

    var target = listenTarget(item);
    $("[data-gx-play]", modal.body).addEventListener("click", function () {
      speak(target, {});
    });
    later(function () {
      speak(target, {});
    }, 250);

    $$("[data-listen-option]", modal.body).forEach(function (button) {
      button.addEventListener("click", function () {
        var index = parseInt(button.getAttribute("data-listen-option"), 10);
        if (index === answerIndex(item)) {
          if (button.classList.contains("is-correct")) return;
          game.correct += 1;
          game.xp += 6;
          button.classList.add("is-correct");
          $$("[data-listen-option]", modal.body).forEach(function (node) { node.disabled = true; });
          setFeedback("ok", "Nghe chuẩn!", "Đáp án đúng là “" + options[index] + "”.");
          speak(options[index], {});
          attachVoiceCoach(options[index], item);
          var nextButton = document.createElement("button");
          nextButton.className = "btn btn--primary gx-next";
          nextButton.type = "button";
          nextButton.innerHTML = "Tiếp tục " + icon("arrow-right");
          nextButton.addEventListener("click", function () {
            game.round += 1;
            renderListenRound();
          });
          modal.body.querySelector(".gx-voice-slot").appendChild(nextButton);
          nextButton.focus({ preventScroll: true });
        } else {
          if (button.classList.contains("is-wrong")) return;
          button.classList.add("is-wrong");
          button.disabled = true;
          recordMistake(item);
          setFeedback("hint", "Chưa đúng", item.hint_vi || "Con nghe lại và thử đáp án khác nhé.");
        }
      });
    });
  }

  function attachVoiceCoach(target, item) {
    var slot = $(".gx-voice-slot", modal.body);
    if (!slot || !window.SETSpeech || !window.SETSpeech.stt.supported) return;
    var button = document.createElement("button");
    button.className = "btn btn--outline mic-btn";
    button.type = "button";
    button.innerHTML = icon("mic") + "Đọc to";
    var result = document.createElement("div");
    result.className = "voice-result";
    result.setAttribute("role", "status");
    result.setAttribute("aria-live", "polite");
    result.hidden = true;
    slot.appendChild(button);
    slot.appendChild(result);
    button.addEventListener("click", function () {
      if (button.getAttribute("aria-busy") === "true") {
        window.SETSpeech.stt.stop();
        return;
      }
      button.setAttribute("aria-busy", "true");
      button.classList.add("is-listening");
      button.innerHTML = icon("stop") + "Dừng & Chấm";
      result.hidden = false;
      result.innerHTML = '<span class="voice-msg">Đang nghe… Con đọc xong rồi bấm “Dừng & Chấm” nhé.</span>';
      var heard = false;
      var timeoutMs = window.SETSpeech.calcListenTimeout
        ? window.SETSpeech.calcListenTimeout(target)
        : 25000;
      window.SETSpeech.stt.listen({
        lang: "en-US",
        timeout: timeoutMs,
        silenceMs: 4500,
        onInterim: function (text) {
          result.hidden = false;
          result.innerHTML = '<span class="voice-msg">Đang nghe… (bấm “Dừng & Chấm” khi xong)</span>' +
            '<span class="voice-heard">Nghe được: “' + esc(text) + "”</span>";
        },
        onResult: function (transcripts) {
          heard = true;
          var score = window.SETSpeech.stt.score(target, transcripts);
          result.hidden = false;
          result.innerHTML = '<span class="voice-stars" aria-label="' + score.stars + ' trên 3 sao">' +
            new Array(score.stars + 1).join("★") + new Array(4 - score.stars).join("☆") + "</span>" +
            '<span class="voice-msg">' + esc(score.message) + "</span>" +
            '<span class="voice-heard">Máy nghe: “' + esc(score.transcript) + "”</span>";
        },
        onError: function (error) {
          result.hidden = false;
          result.innerHTML = '<span class="voice-msg">' + (error === "not-allowed" ? "Con cần bật quyền micro cho trang này nhé." : "Chưa nghe được. Con thử lại gần micro hơn nhé.") + "</span>";
        },
        onEnd: function () {
          button.removeAttribute("aria-busy");
          button.classList.remove("is-listening");
          button.innerHTML = icon("mic") + "Đọc to";
          if (!heard) {
            result.hidden = false;
            result.innerHTML = '<span class="voice-msg">Chưa nghe được. Con thử lại gần micro hơn nhé.</span>';
          }
        }
      });
    });
  }

  /* ---------------- 6. Spell Rocket (Word Typing) ---------------- */

  function normalizeAnswer(text) {
    return String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function startTyping() {
    var vocab = Array.isArray(lesson && lesson.vocabulary) ? lesson.vocabulary : [];
    var pool = shuffle(vocab).slice(0, 6);
    if (!pool.length) {
      modal.body.innerHTML = '<div class="gx-empty">' + icon("book", "icon--lg") + '<h3>Chưa có từ vựng</h3><p>Bài học này chưa có từ vựng để luyện gõ.</p><button class="btn btn--primary" data-gx-done>Đóng</button></div>';
      $("[data-gx-done]", modal.body).addEventListener("click", close);
      return;
    }
    game = { type: "typing", pool: pool, round: 0, correct: 0, combo: 0, bestCombo: 0, xp: 0, hintLevel: 0 };
    renderTypingRound();
  }

  function renderTypingRound() {
    if (game.round >= game.pool.length) {
      renderFinish({
        correct: game.correct,
        total: game.pool.length,
        xp: game.xp + 10,
        message: "Tên lửa chính tả đã cất cánh! Con nhập đúng " + game.correct + "/" + game.pool.length + " từ."
      });
      return;
    }
    var item = game.pool[game.round];
    var masked = window.SET_M2 && window.SET_M2.maskWord ? window.SET_M2.maskWord(item.word) : item.word.charAt(0) + "...";
    var exampleMasked = item.example_en
      ? (window.SET_M2 && window.SET_M2.maskWordInSentence ? window.SET_M2.maskWordInSentence(item.example_en, item.word) : item.example_en)
      : "";
    var solved = false;

    modal.body.innerHTML =
      questionHeader(game.round, game.pool.length, '<span class="gx-combo">' + icon("bolt") + "Combo " + game.combo + "</span>" + '<span class="gx-combo">' + icon("star") + " " + game.xp + " XP</span>") +
      '<div class="gx-prompt-card">' +
      '<div class="gx-prompt-label">Nghe và tự nhập từ tiếng Anh</div>' +
      '<p class="gx-prompt">' + (item.icon ? esc(item.icon) + " " : "") + esc(item.meaning_vi || "") + "</p>" +
      (item.ipa ? '<span class="chip">' + esc(item.ipa) + "</span>" : "") +
      (exampleMasked ? '<p class="gx-prompt-vi">' + esc(exampleMasked) + "</p>" : "") +
      '<div class="gx-type-audio"><button class="btn btn--outline btn--sm" type="button" data-gx-speak>' + icon("speaker") + "Nghe từ</button>" +
      '<button class="btn btn--outline btn--sm" type="button" data-gx-speak-slow>' + icon("gauge") + "Nghe chậm</button></div></div>" +
      '<form class="gx-type-form" data-gx-type-form>' +
      '<input class="gx-type-input" type="text" data-gx-input autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="Gõ từ tiếng Anh vào đây…">' +
      '<button class="btn btn--primary" type="submit" data-gx-submit>Kiểm tra</button></form>' +
      '<div class="gx-type-tools"><button class="btn btn--outline btn--sm" type="button" data-gx-hint>' + icon("info") + "Gợi ý chữ</button>" +
      '<button class="btn btn--ghost btn--sm" type="button" data-gx-skip>Xem đáp án & Qua câu</button></div>' +
      '<div class="gx-type-hint" data-gx-hint-box hidden></div>' +
      '<div class="gx-feedback gx-feedback--info" role="status" aria-live="polite">' + icon("info") + "<div><strong>Tự gõ từ mới</strong><span>Nhập đúng chính tả từ tiếng Anh rồi bấm Kiểm tra.</span></div></div>";

    var input = $("[data-gx-input]", modal.body);
    var hintBox = $("[data-gx-hint-box]", modal.body);
    var form = $("[data-gx-type-form]", modal.body);

    $("[data-gx-speak]", modal.body).addEventListener("click", function () {
      speak(item.word, { rate: 1 });
    });
    $("[data-gx-speak-slow]", modal.body).addEventListener("click", function () {
      speak(item.word, { rate: 0.72 });
    });
    speak(item.word, { rate: 1 });
    later(function () {
      if (input) input.focus({ preventScroll: true });
    }, 60);

    $("[data-gx-hint]", modal.body).addEventListener("click", function () {
      if (solved) return;
      game.hintLevel += 1;
      hintBox.hidden = false;
      if (game.hintLevel === 1) {
        hintBox.innerHTML = "Gợi ý mặt chữ: <strong>" + esc(masked) + "</strong> (" + item.word.length + " ký tự)";
      } else {
        hintBox.innerHTML = "Chữ đầu: <strong>" + esc(item.word.slice(0, Math.min(game.hintLevel, item.word.length))) + "…</strong> · Mặt chữ: <strong>" + esc(masked) + "</strong>";
      }
    });

    $("[data-gx-skip]", modal.body).addEventListener("click", function () {
      if (solved) return;
      solved = true;
      game.combo = 0;
      recordMistake({ id: item.id, skill: "vocabulary", game_type: "word_typing" });
      if (input) input.disabled = true;
      $("[data-gx-submit]", modal.body).disabled = true;
      setFeedback("hint", "Đáp án đúng là “" + item.word + "”", "Không sao! Con nghe lại từ này rồi mình sang từ tiếp theo nhé.");
      speak(item.word, { rate: 0.85 });
      later(function () {
        game.round += 1;
        game.hintLevel = 0;
        renderTypingRound();
      }, 1500);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (solved) return;
      var attempt = normalizeAnswer(input.value);
      var target = normalizeAnswer(item.word);
      if (!attempt) {
        setFeedback("hint", "Con chưa nhập từ", "Hãy gõ chữ cái tiếng Anh vào ô trống hoặc bấm Gợi ý chữ nhé.");
        input.focus();
        return;
      }
      if (attempt === target) {
        solved = true;
        game.correct += 1;
        game.combo += 1;
        game.bestCombo = Math.max(game.bestCombo, game.combo);
        game.xp += 8;
        input.classList.add("is-correct");
        input.disabled = true;
        $("[data-gx-submit]", modal.body).disabled = true;
        setFeedback("ok", "Chính xác! +8 XP", "Từ “" + item.word + "” — " + (item.example_en || "Con nhớ mặt chữ rất tốt!"));
        speak(item.word, { rate: 1 });
        later(function () {
          game.round += 1;
          game.hintLevel = 0;
          renderTypingRound();
        }, 1100);
      } else {
        game.combo = 0;
        input.classList.remove("is-wrong");
        void input.offsetWidth;
        input.classList.add("is-wrong");
        recordMistake({ id: item.id, skill: "vocabulary", game_type: "word_typing" });
        setFeedback("hint", "Gần đúng rồi!", "Từ này có " + item.word.length + " ký tự, bắt đầu bằng “" + item.word.charAt(0).toUpperCase() + "”. Con sửa lại hoặc bấm Gợi ý chữ nhé.");
      }
    });
  }

  /* ---------------- 7. Voice Commander (Speaking Game) ---------------- */

  function buildSpeakPool() {
    var items = [];
    var readings = Array.isArray(lesson && lesson.readings) ? lesson.readings : [];
    readings.forEach(function (dlg, dIdx) {
      (dlg.lines || []).forEach(function (line, lIdx) {
        if (line && line.en && line.en.split(/\s+/).length <= 16) {
          items.push({
            id: "spk_r_" + dIdx + "_" + lIdx,
            target: line.en,
            meaning_vi: line.vi || (dlg.title || "Câu hội thoại"),
            kind: "Câu đọc",
            skill: "reading"
          });
        }
      });
    });
    var vocab = Array.isArray(lesson && lesson.vocabulary) ? lesson.vocabulary : [];
    vocab.forEach(function (entry) {
      if (!entry || !entry.word) return;
      items.push({
        id: entry.id,
        target: entry.example_en && entry.example_en.split(/\s+/).length <= 10 ? entry.example_en : entry.word,
        meaning_vi: entry.example_vi || entry.meaning_vi || "",
        kind: "Từ & Mẫu câu",
        skill: "vocabulary"
      });
    });
    return shuffle(items).slice(0, 5);
  }

  function startSpeak() {
    var pool = buildSpeakPool();
    if (!pool.length) {
      modal.body.innerHTML = '<div class="gx-empty">' + icon("mic", "icon--lg") + '<h3>Chưa có nội dung luyện nói</h3><p>Bài học này chưa có câu hoặc từ vựng.</p><button class="btn btn--primary" data-gx-done>Đóng</button></div>';
      $("[data-gx-done]", modal.body).addEventListener("click", close);
      return;
    }
    game = { type: "speak", pool: pool, round: 0, correct: 0, xp: 0, roundPassed: false };
    renderSpeakRound();
  }

  function renderSpeakRound() {
    if (game.round >= game.pool.length) {
      renderFinish({
        correct: game.correct,
        total: game.pool.length,
        xp: game.xp + 10,
        message: "Chỉ huy phát âm xuất sắc! Con đã hoàn thành " + game.correct + "/" + game.pool.length + " thử thách đọc to."
      });
      return;
    }
    var item = game.pool[game.round];
    var sttSupported = Boolean(window.SETSpeech && window.SETSpeech.stt.supported);
    game.roundPassed = false;

    modal.body.innerHTML =
      questionHeader(game.round, game.pool.length, '<span class="gx-combo">' + icon("star") + " " + game.xp + " XP</span>") +
      '<div class="gx-speak-card">' +
      '<span class="chip chip--cyan">' + esc(item.kind) + "</span>" +
      '<p class="gx-prompt">' + esc(item.target) + "</p>" +
      (item.meaning_vi ? '<p class="gx-prompt-vi">' + esc(item.meaning_vi) + "</p>" : "") +
      '<div class="gx-type-audio">' +
      '<button class="btn btn--outline btn--sm" type="button" data-gx-speak>' + icon("speaker") + "Nghe mẫu</button>" +
      '<button class="btn btn--outline btn--sm" type="button" data-gx-speak-slow>' + icon("gauge") + "Nghe chậm</button></div>" +
      (sttSupported
        ? '<button class="btn btn--primary gx-mic-big" type="button" data-gx-mic>' + icon("mic") + "Bấm để đọc to</button>"
        : '<div class="gx-type-hint">Thiết bị/trình duyệt này chưa hỗ trợ Micro nhận diện giọng nói. Con nghe mẫu, tự đọc to 2 lần rồi bấm nút Qua câu nhé!</div>') +
      '<div class="gx-speak-live" data-gx-live hidden></div></div>' +
      '<div class="gx-feedback gx-feedback--info" role="status" aria-live="polite">' + icon("mic") + "<div><strong>Sẵn sàng ghi âm</strong><span>Bấm nút Micro, đọc rõ cả câu rồi bấm “Dừng & Chấm” khi đọc xong.</span></div></div>" +
      '<div class="gx-type-tools"><button class="btn btn--primary" type="button" data-gx-next-speak' + (sttSupported ? " hidden" : "") + ">Câu tiếp theo " + icon("arrow-right") + "</button>" +
      (sttSupported ? '<button class="btn btn--ghost btn--sm" type="button" data-gx-skip-speak>Bỏ qua câu này</button>' : "") + "</div>";

    $("[data-gx-speak]", modal.body).addEventListener("click", function () {
      speak(item.target, { rate: 1 });
    });
    $("[data-gx-speak-slow]", modal.body).addEventListener("click", function () {
      speak(item.target, { rate: 0.7 });
    });

    var nextBtn = $("[data-gx-next-speak]", modal.body);
    nextBtn.addEventListener("click", function () {
      if (!sttSupported && !game.roundPassed) {
        game.roundPassed = true;
        game.correct += 1;
        game.xp += 6;
      }
      game.round += 1;
      renderSpeakRound();
    });

    var skipBtn = $("[data-gx-skip-speak]", modal.body);
    if (skipBtn) {
      skipBtn.addEventListener("click", function () {
        if (window.SETSpeech && window.SETSpeech.stt) window.SETSpeech.stt.stop();
        game.round += 1;
        renderSpeakRound();
      });
    }

    var micBtn = $("[data-gx-mic]", modal.body);
    var liveBox = $("[data-gx-live]", modal.body);
    if (micBtn && sttSupported) {
      micBtn.addEventListener("click", function () {
        if (micBtn.getAttribute("aria-busy") === "true") {
          window.SETSpeech.stt.stop();
          return;
        }
        micBtn.setAttribute("aria-busy", "true");
        micBtn.classList.add("is-listening");
        micBtn.innerHTML = icon("stop") + "Dừng & Chấm";
        liveBox.hidden = false;
        liveBox.innerHTML = '<span class="voice-msg">Đang nghe… Con đọc hết câu rồi bấm “Dừng & Chấm” nhé.</span>';
        var heard = false;
        var timeoutMs = window.SETSpeech.calcListenTimeout
          ? window.SETSpeech.calcListenTimeout(item.target)
          : 25000;
        window.SETSpeech.stt.listen({
          lang: "en-US",
          timeout: timeoutMs,
          silenceMs: 4500,
          onInterim: function (text) {
            liveBox.hidden = false;
            liveBox.innerHTML = '<span class="voice-msg">Đang nghe… (bấm “Dừng & Chấm” khi đọc xong)</span>' +
              '<span class="voice-heard">Nghe được: “' + esc(text) + "”</span>";
          },
          onResult: function (transcripts) {
            heard = true;
            var res = window.SETSpeech.stt.score(item.target, transcripts);
            liveBox.hidden = false;
            liveBox.innerHTML = '<span class="voice-stars">' +
              new Array(res.stars + 1).join("★") + new Array(4 - res.stars).join("☆") + "</span>" +
              '<span class="voice-msg">' + esc(res.message) + "</span>" +
              '<span class="voice-heard">Máy nghe: “' + esc(res.transcript) + "”</span>";
            if (res.stars >= 1) {
              if (!game.roundPassed) {
                game.roundPassed = true;
                game.correct += 1;
                game.xp += Math.max(4, res.stars * 4);
              }
              setFeedback("ok", "Đạt " + res.stars + " sao!", res.stars >= 2 ? "Con phát âm rất rõ! Bấm Câu tiếp theo hoặc đọc lại để đạt 3 sao." : "Tốt lắm! Con có thể đọc lại rõ hơn hoặc sang câu tiếp theo.");
            } else {
              recordMistake({ id: item.id, skill: item.skill, game_type: "voice_challenge" });
              setFeedback("hint", "Thử lại lần nữa nhé", "Con bấm Nghe chậm rồi đọc lại rõ từng chữ nhé.");
            }
            nextBtn.hidden = false;
          },
          onError: function (error) {
            liveBox.hidden = false;
            liveBox.innerHTML = '<span class="voice-msg">' + (error === "not-allowed" ? "Con cần cấp quyền Micro cho trình duyệt nhé." : "Chưa nghe rõ. Con thử lại gần micro hơn nhé.") + "</span>";
            nextBtn.hidden = false;
          },
          onEnd: function () {
            micBtn.removeAttribute("aria-busy");
            micBtn.classList.remove("is-listening");
            micBtn.innerHTML = icon("mic") + "Đọc lại";
            if (!heard) {
              liveBox.hidden = false;
              liveBox.innerHTML = '<span class="voice-msg">Chưa nghe được. Con bấm lại nút Micro và đọc to hơn nhé.</span>';
              nextBtn.hidden = false;
            }
          }
        });
      });
    }
  }

  /* ---------------- public API ---------------- */

  function open(type, options) {
    var key = ALIASES[type] || type;
    var meta = META[key];
    if (!meta) {
      notify("Mini-game này chưa có.");
      return;
    }
    close();
    options = options || {};
    api = options.api || {};
    lesson = options.lesson || { id: "lesson", quiz: [], vocabulary: [] };
    originalOptions = Array.isArray(options.items) ? options.items : (lesson.quiz || []);
    openModalShell(meta);
    if (key === "balloon") startBalloon();
    else if (key === "boss") startBoss();
    else if (key === "memory") startMemory();
    else if (key === "detective") startDetective();
    else if (key === "listen") startListen();
    else if (key === "typing") startTyping();
    else if (key === "speak") startSpeak();
  }

  window.SET_GAMES = {
    open: open,
    close: close,
    meta: META
  };
})();