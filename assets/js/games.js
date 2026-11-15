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
    }
  };

  var ALIASES = {
    balloon_pop: "balloon",
    boss_battle: "boss",
    memory_match: "memory",
    detective_cloze: "detective",
    listen_tap: "listen"
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
    var pool = filtered.length ? filtered : source.filter(function (item) {
      return item && Array.isArray(item.options) && item.options.length >= 2;
    });
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

  function startBalloon() {
    var pool = pickItems("balloon_pop", 6);
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
    var pool = pickItems("boss_battle", 6);
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
    var words = (lesson.vocabulary || []).slice(0, 6);
    if (!words.length) {
      modal.body.innerHTML = '<div class="gx-empty">' + icon("book", "icon--lg") + '<h3>Chưa có từ vựng</h3><p>Bài học này chưa có thẻ để chơi.</p><button class="btn btn--primary" data-gx-done>Đóng</button></div>';
      $("[data-gx-done]", modal.body).addEventListener("click", close);
      return;
    }
    var cards = [];
    words.forEach(function (word) {
      cards.push({ pair: word.id, label: word.word, kind: "word", icon: word.icon, speak: word.word });
      cards.push({ pair: word.id, label: word.meaning_vi || word.example_en || word.word, kind: "meaning", icon: null, speak: word.word });
    });
    game = { type: "memory", cards: shuffle(cards), flipped: [], matched: {}, moves: 0, lock: false, total: words.length };
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
      '<p class="gx-prompt">Tìm cặp từ tiếng Anh và nghĩa tiếng Việt.</p></div>' +
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
    var pool = pickItems("detective_cloze", 5);
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
      button.setAttribute("aria-busy", "true");
      button.classList.add("is-listening");
      button.innerHTML = icon("mic") + "Đang nghe…";
      result.hidden = true;
      window.SETSpeech.stt.listen({
        lang: "en-US",
        timeout: 9000,
        onResult: function (transcripts) {
          var score = window.SETSpeech.stt.score(target, transcripts);
          result.hidden = false;
          result.innerHTML = '<span class="voice-stars" aria-label="' + score.stars + ' trên 3 sao">' +
            new Array(score.stars + 1).join("★") + new Array(4 - score.stars).join("☆") + "</span>" +
            '<span class="voice-msg">' + esc(score.message) + "</span>" +
            '<span class="voice-heard">Máy nghe: “' + esc(score.transcript) + "”</span>";
        },
        onError: function () {
          result.hidden = false;
          result.innerHTML = '<span class="voice-msg">Chưa nghe được. Con thử lại gần micro hơn nhé.</span>';
        },
        onEnd: function () {
          button.removeAttribute("aria-busy");
          button.classList.remove("is-listening");
          button.innerHTML = icon("mic") + "Đọc to";
        }
      });
    });
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
  }

  window.SET_GAMES = {
    open: open,
    close: close,
    meta: META
  };
})();