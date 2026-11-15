/* Space Explorer · M2 practice modules
   Word Builder (tap-to-spell), Sentence Lego builder (tap-to-place),
   Voice Coach mic helper. Rendered as accessible overlays on top of the app. */
(function () {
  "use strict";

  var api = null;
  var activeModal = null;

  function setApi(next) {
    api = next || {};
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

  function hashString(value) {
    var hash = 2166136261;
    var text = String(value || "");
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededShuffle(list, seed) {
    var result = list.slice();
    var state = seed || 1;
    for (var i = result.length - 1; i > 0; i -= 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      var j = state % (i + 1);
      var swap = result[i];
      result[i] = result[j];
      result[j] = swap;
    }
    return result;
  }

  function textColorFor(hex) {
    function channel(value) {
      var normalized = parseInt(value, 16) / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    }
    var value = String(hex || "").replace("#", "");
    if (value.length !== 6) return "#0f172a";
    var luminance = 0.2126 * channel(value.slice(0, 2)) + 0.7152 * channel(value.slice(2, 4)) + 0.0722 * channel(value.slice(4, 6));
    var white = 1.05 / (luminance + 0.05);
    var dark = (luminance + 0.05) / 0.06;
    return white >= dark ? "#ffffff" : "#0f172a";
  }

  function openModal(options) {
    closeModal();
    var previousFocus = document.activeElement;
    var wrapper = document.createElement("div");
    wrapper.className = "m2-modal";
    wrapper.innerHTML =
      '<div class="m2-sheet" role="dialog" aria-modal="true" aria-labelledby="m2-title">' +
      '<header class="m2-head"><div><div class="m2-kicker">' + esc(options.kicker || "Luyện tập") + "</div>" +
      '<h2 class="m2-title" id="m2-title">' + esc(options.title || "") + "</h2>" +
      (options.subtitle ? '<p class="m2-sub">' + esc(options.subtitle) + "</p>" : "") + "</div>" +
      '<button class="btn btn--ghost btn--icon" type="button" data-m2-close aria-label="Đóng">' + icon("x") + "</button></header>" +
      '<div class="m2-body"></div></div>';
    document.body.appendChild(wrapper);
    document.body.classList.add("m2-open");
    var body = wrapper.querySelector(".m2-body");
    var close = wrapper.querySelector("[data-m2-close]");
    var state = {
      wrapper: wrapper,
      body: body,
      close: function () {
        closeModal();
      },
      previousFocus: previousFocus
    };
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        state.close();
      }
      if (event.key === "Tab") {
        var focusables = wrapper.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    wrapper.addEventListener("keydown", onKey);
    wrapper.addEventListener("click", function (event) {
      if (event.target === wrapper) state.close();
    });
    close.addEventListener("click", state.close);
    activeModal = state;
    window.setTimeout(function () {
      close.focus({ preventScroll: true });
    }, 30);
    return state;
  }

  function closeModal() {
    if (!activeModal) return;
    var previous = activeModal.previousFocus;
    activeModal.wrapper.remove();
    document.body.classList.remove("m2-open");
    activeModal = null;
    if (previous && typeof previous.focus === "function") {
      previous.focus({ preventScroll: true });
    }
  }

  /* ---------------- Word Builder ---------------- */

  function splitWord(word) {
    var chars = Array.from(String(word || ""));
    return chars.map(function (ch) {
      if (/[a-z]/i.test(ch)) return { type: "letter", ch: ch.toLowerCase() };
      if (/\s/.test(ch)) return { type: "gap", ch: " " };
      return { type: "fixed", ch: ch };
    });
  }

  function makeTiles(word) {
    var letters = splitWord(word).filter(function (part) {
      return part.type === "letter";
    }).map(function (part) {
      return part.ch;
    });
    var used = {};
    letters.forEach(function (ch) {
      used[ch] = true;
    });
    var alphabet = "abcdefghijklmnopqrstuvwxyz";
    var state = hashString(word);
    var decoys = [];
    var guard = 0;
    while (decoys.length < 2 && guard < 80) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      var candidate = alphabet.charAt(state % 26);
      if (!used[candidate]) {
        decoys.push(candidate);
        used[candidate] = true;
      }
      guard += 1;
    }
    var tiles = letters.map(function (ch, index) {
      return { id: "l" + index, ch: ch };
    }).concat(decoys.map(function (ch, index) {
      return { id: "d" + index, ch: ch };
    }));
    return { letters: letters, tiles: seededShuffle(tiles, hashString(word + ":tiles")) };
  }

  function openWordBuilder(options) {
    var lesson = options.lesson;
    var item = options.item;
    var parts = splitWord(item.word);
    var letterSlots = [];
    parts.forEach(function (part, index) {
      if (part.type === "letter") letterSlots.push(index);
    });
    var letterTotal = letterSlots.length;
    var tileData = makeTiles(item.word);
    var placed = {};
    var solved = false;
    var modal = openModal({
      kicker: "Word Builder · chạm để ghép chữ",
      title: item.word.length > 18 ? "Ghép chữ" : "Ghép chữ: " + item.word,
      subtitle: item.meaning_vi || "Chạm từng chữ cái để xếp thành từ đúng."
    });

    function placedCount() {
      return Object.keys(placed).length;
    }

    function render() {
      var slots = parts.map(function (part, index) {
        if (part.type === "gap") return '<span class="wb-gap" aria-hidden="true"></span>';
        if (part.type === "fixed") return '<span class="wb-fixed">' + esc(part.ch) + "</span>";
        var tileId = placed[index];
        var tile = tileId ? tileData.tiles.filter(function (entry) { return entry.id === tileId; })[0] : null;
        return '<button class="wb-slot' + (tile ? " is-filled" : "") + '" type="button" data-slot="' + index + '" aria-label="Ô chữ ' + (index + 1) + (tile ? ", đang có chữ " + esc(tile.ch) : ", còn trống") + '">' + (tile ? esc(tile.ch) : "") + "</button>";
      }).join("");

      var used = {};
      Object.keys(placed).forEach(function (slot) {
        used[placed[slot]] = true;
      });
      var tray = tileData.tiles.map(function (tile) {
        var isUsed = Boolean(used[tile.id]);
        return '<button class="wb-tile' + (isUsed ? " is-used" : "") + '" type="button" data-tile="' + tile.id + '"' + (isUsed ? " disabled" : "") + ">" + esc(tile.ch) + "</button>";
      }).join("");

      var correct = placedCount() === letterTotal && solved;
      modal.body.innerHTML =
        '<div class="wb-clue"><span class="chip chip--cyan">' + icon("book") + esc(item.pos ? "từ mới" : "từ vựng") + "</span>" +
        '<span class="chip">' + esc(item.ipa || "") + "</span>" +
        '<button class="btn btn--outline btn--sm" type="button" data-wb-speak>' + icon("speaker") + "Nghe từ</button></div>" +
        '<p class="wb-meaning">' + esc(item.meaning_vi) + "</p>" +
        '<p class="wb-example">' + esc(item.example_en || "") + "</p>" +
        '<div class="wb-slots" role="group" aria-label="Các ô chữ cần ghép">' + slots + "</div>" +
        '<div class="wb-tray" role="group" aria-label="Các chữ cái">' + tray + "</div>" +
        '<div class="wb-status" role="status" aria-live="polite">' + (correct ? "Chính xác! Con ghép đúng rồi." : placedCount() ? "Đã ghép " + placedCount() + "/" + letterTotal + " chữ." : "Chạm một chữ cái bên dưới để bắt đầu.") + "</div>" +
        '<div class="wb-actions"><button class="btn btn--outline" type="button" data-wb-reset>' + icon("refresh") + "Xáo lại</button>" +
        '<button class="btn btn--outline" type="button" data-wb-hint>' + icon("info") + "Gợi ý</button>" +
        '<button class="btn btn--primary" type="button" data-wb-close>Đóng</button></div>' +
        (correct ? '<div class="wb-success" role="status">' + icon("star") + "<strong>Hoàn thành!</strong> Con đã ghép đúng từ “" + esc(item.word) + "”.</div>" : "");

      modal.body.querySelector("[data-wb-speak]").addEventListener("click", function () {
        speak(item.word, {});
      });
      modal.body.querySelector("[data-wb-reset]").addEventListener("click", function () {
        placed = {};
        solved = false;
        render();
      });
      modal.body.querySelector("[data-wb-hint]").addEventListener("click", function () {
        var next = letterSlots.filter(function (slotIndex) {
          return placed[slotIndex] === undefined;
        })[0];
        var firstLetter = tileData.letters[0] || "";
        notify("Gợi ý: từ này bắt đầu bằng chữ " + firstLetter.toUpperCase() + ".");
        if (next !== undefined) {
          var slot = modal.body.querySelector('[data-slot="' + next + '"]');
          if (slot) {
            slot.classList.add("is-hint");
            window.setTimeout(function () { slot.classList.remove("is-hint"); }, 900);
          }
        }
      });
      modal.body.querySelector("[data-wb-close]").addEventListener("click", modal.close);
      modal.body.querySelectorAll("[data-tile]").forEach(function (button) {
        button.addEventListener("click", function () {
          if (solved) return;
          var tileId = button.getAttribute("data-tile");
          var usedIds = Object.keys(placed).map(function (slot) { return placed[slot]; });
          if (usedIds.indexOf(tileId) !== -1) return;
          var emptySlot = parts.findIndex(function (part, index) {
            return part.type === "letter" && placed[index] === undefined;
          });
          if (emptySlot === -1) return;
          placed[emptySlot] = tileId;
          var total = placedCount();
          if (total === letterTotal) {
            var attempt = letterSlots.map(function (slotIndex) {
              var tile = tileData.tiles.filter(function (entry) {
                return entry.id === placed[slotIndex];
              })[0];
              return tile ? tile.ch : "";
            }).join("");
            if (attempt === tileData.letters.join("")) {
              solved = true;
              celebrate();
              if (api.onWordComplete) api.onWordComplete(lesson, item, "word_builder");
            } else {
              notify("Chưa đúng rồi. Con chạm vào ô để lấy lại chữ và thử lại nhé.");
            }
          }
          render();
        });
      });
      modal.body.querySelectorAll("[data-slot]").forEach(function (button) {
        button.addEventListener("click", function () {
          var slot = parseInt(button.getAttribute("data-slot"), 10);
          if (placed[slot] === undefined) return;
          delete placed[slot];
          solved = false;
          render();
        });
      });
    }

    render();
    return modal;
  }

  /* ---------------- Sentence Lego builder ---------------- */

  function openLego(options) {
    var pattern = options.pattern;
    var lesson = options.lesson;
    var blocks = (pattern.lego_blocks || []).map(function (block, index) {
      return { id: "b" + index, text: block.text, role: block.role, color: block.color, order: index };
    });
    if (blocks.length < 2) {
      notify("Mẫu câu này cần ít nhất 2 khối từ.");
      return null;
    }
    var shuffled = seededShuffle(blocks, hashString(pattern.id + ":lego"));
    if (shuffled.every(function (block, index) { return block.order === index; })) {
      shuffled = shuffled.slice().reverse();
    }
    var placed = [];
    var solved = false;
    var modal = openModal({
      kicker: "Sentence Lego · chạm để xếp câu",
      title: "Lắp câu",
      subtitle: pattern.explanation_vi || "Chạm từng khối từ để xếp thành câu đúng."
    });

    function render() {
      var slots = blocks.map(function (block, index) {
        var blockId = placed[index];
        var current = blockId ? blocks.filter(function (entry) { return entry.id === blockId; })[0] : null;
        return '<button class="lego-slot' + (current ? " is-filled" : "") + '" type="button" data-slot="' + index + '" style="' + (current ? "background:" + esc(current.color) + ";color:" + textColorFor(current.color) : "") + '" aria-label="Ô ' + (index + 1) + (current ? ", " + esc(current.text) : ", còn trống") + '">' + (current ? esc(current.text) : "") + "</button>";
      }).join("");

      var tray = shuffled.map(function (block) {
        var used = placed.indexOf(block.id) !== -1;
        return '<button class="lego-block m2-lego-block' + (used ? " is-used" : "") + '" type="button" data-block="' + block.id + '"' + (used ? " disabled" : "") + ' style="background:' + esc(block.color) + ";color:" + textColorFor(block.color) + '" aria-label="Khối từ ' + esc(block.text) + '">' + esc(block.text) + "</button>";
      }).join("");

      modal.body.innerHTML =
        '<div class="lego-builder-zone"><div class="lego-label">Các khối từ (đã xáo trộn):</div>' +
        '<div class="lego-row" role="group" aria-label="Khối từ">' + tray + "</div></div>" +
        '<div class="lego-builder-zone"><div class="lego-label">Câu của con:</div>' +
        '<div class="lego-slots" role="group" aria-label="Các ô cần xếp">' + slots + "</div></div>" +
        '<div class="wb-status" role="status" aria-live="polite">' + (solved ? "Chính xác! Câu đã đúng." : placed.length ? "Đã xếp " + placed.length + "/" + blocks.length + " khối." : "Chạm một khối từ để đặt vào ô đầu tiên.") + "</div>" +
        '<div class="wb-actions"><button class="btn btn--outline" type="button" data-lego-speak>' + icon("speaker") + "Nghe mẫu</button>" +
        '<button class="btn btn--outline" type="button" data-lego-reset>' + icon("refresh") + "Xáo lại</button>" +
        '<button class="btn btn--outline" type="button" data-lego-hint>' + icon("info") + "Gợi ý</button>" +
        '<button class="btn btn--primary" type="button" data-lego-close>Đóng</button></div>' +
        (solved ? '<div class="wb-success" role="status">' + icon("star") + "<strong>Hoàn thành!</strong> " + esc(pattern.pattern) + "</div>" : "");

      modal.body.querySelector("[data-lego-speak]").addEventListener("click", function () {
        speak(blocks.map(function (block) { return block.text; }).join(" "), {});
      });
      modal.body.querySelector("[data-lego-reset]").addEventListener("click", function () {
        placed = [];
        solved = false;
        render();
      });
      modal.body.querySelector("[data-lego-hint]").addEventListener("click", function () {
        notify("Gợi ý: khối đầu tiên là “" + blocks[0].text + "”.");
      });
      modal.body.querySelector("[data-lego-close]").addEventListener("click", modal.close);
      modal.body.querySelectorAll("[data-block]").forEach(function (button) {
        button.addEventListener("click", function () {
          if (solved) return;
          var blockId = button.getAttribute("data-block");
          if (placed.indexOf(blockId) !== -1) return;
          if (placed.length >= blocks.length) return;
          placed.push(blockId);
          if (placed.length === blocks.length) {
            var correct = placed.every(function (id, index) {
              return blocks[index].id === id;
            });
            if (correct) {
              solved = true;
              celebrate();
              speak(blocks.map(function (block) { return block.text; }).join(" "), {});
              if (api.onLegoComplete) api.onLegoComplete(lesson, pattern);
            } else {
              notify("Chưa đúng thứ tự rồi. Con chạm vào ô để lấy khối ra và thử lại nhé.");
            }
          }
          render();
        });
      });
      modal.body.querySelectorAll("[data-slot]").forEach(function (button) {
        button.addEventListener("click", function () {
          var index = parseInt(button.getAttribute("data-slot"), 10);
          if (index >= placed.length) return;
          placed.splice(index, 1);
          solved = false;
          render();
        });
      });
    }

    render();
    return modal;
  }

  /* ---------------- Voice Coach ---------------- */

  function attachMic(button, options) {
    if (!button) return;
    if (!window.SETSpeech || !window.SETSpeech.stt.supported) {
      button.disabled = true;
      button.title = "Thiết bị này chưa hỗ trợ micro nhận diện giọng nói.";
      return;
    }
    var result = document.createElement("div");
    result.className = "voice-result";
    result.setAttribute("role", "status");
    result.setAttribute("aria-live", "polite");
    result.hidden = true;
    button.insertAdjacentElement("afterend", result);

    button.addEventListener("click", function () {
      if (button.getAttribute("aria-busy") === "true") return;
      button.setAttribute("aria-busy", "true");
      button.classList.add("is-listening");
      button.innerHTML = icon("mic") + "Đang nghe…";
      result.hidden = true;
      var heard = false;
      window.SETSpeech.stt.listen({
        lang: "en-US",
        timeout: 9000,
        onResult: function (transcripts) {
          heard = true;
          var score = window.SETSpeech.stt.score(options.target, transcripts);
          result.hidden = false;
          result.innerHTML = '<span class="voice-stars" aria-label="' + score.stars + ' trên 3 sao">' +
            new Array(score.stars + 1).join("★") + new Array(4 - score.stars).join("☆") + "</span>" +
            '<span class="voice-msg">' + esc(score.message) + "</span>" +
            (score.transcript ? '<span class="voice-heard">Máy nghe: “' + esc(score.transcript) + "”</span>" : "") +
            '<span class="voice-target">Câu mẫu: “' + esc(options.target) + "”</span>";
          if (api.onVoiceScore) {
            api.onVoiceScore({
              key: options.key || options.target,
              target: options.target,
              score: score.score,
              stars: score.stars,
              transcript: score.transcript
            });
          }
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
            if (!result.innerHTML) result.innerHTML = '<span class="voice-msg">Chưa nghe được. Con thử lại gần micro hơn nhé.</span>';
          }
        }
      });
    });
  }

  window.SET_M2 = {
    setApi: setApi,
    openWordBuilder: openWordBuilder,
    openLego: openLego,
    attachMic: attachMic,
    close: closeModal
  };
})();