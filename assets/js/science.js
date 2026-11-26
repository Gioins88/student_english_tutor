/* Space Academy · Science Cartridge (WP2)
   Concept Flashcards, Category Sorter, Process Sequencer with Bilingual toggle. */
(function () {
  "use strict";

  var lastLessonId = null;
  var conceptIndex = 0;
  var sortIndex = 0;
  var seqIndex = 0;

  function syncLesson(lesson) {
    var id = lesson && lesson.id ? lesson.id : null;
    if (id !== lastLessonId) {
      lastLessonId = id;
      conceptIndex = 0;
      sortIndex = 0;
      seqIndex = 0;
    }
  }

  function hashStr(s) {
    var h = 2166136261;
    var text = String(s || "");
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function shuffleSeeded(list, seed) {
    var out = list.slice();
    var s = seed || 1;
    for (var i = out.length - 1; i > 0; i -= 1) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      var j = s % (i + 1);
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function bilingualBar(api) {
    var on = api.bilingual();
    return '<button class="bilingual-toggle" type="button" data-sci-bi aria-pressed="' + on + '">' +
      api.icon("globe") + (on ? "Song ngữ: BẬT (VI + EN)" : "Song ngữ: TẮT (Tiếng Việt)") + "</button>";
  }

  function bindBilingual(root, api, rerender) {
    var btn = root.querySelector("[data-sci-bi]");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = api.toggleBilingual();
      api.toast(next ? "Đã bật chế độ Song ngữ (Việt + Anh)." : "Đã chuyển về Tiếng Việt.");
      rerender();
    });
  }

  /* ---------------- 1. Concept Flashcard ---------------- */

  function renderConcepts(lesson, api) {
    var sb = lesson.scienceBlocks || {};
    var cards = Array.isArray(sb.concept_cards) ? sb.concept_cards : [];
    if (!cards.length) {
      api.mountTo(api.tabsHtml("science-concepts") + '<div class="card empty-state">' + api.icon("flask", "icon--lg") + '<h2 class="empty-state__title">Chưa có thẻ khái niệm</h2><p>Bài học này chưa có thẻ khái niệm Khoa học.</p></div>');
      return;
    }
    conceptIndex = Math.max(0, Math.min(conceptIndex, cards.length - 1));
    var card = cards[conceptIndex];
    var bi = api.bilingual();

    var html = api.tabsHtml("science-concepts") +
      api.headerHtml("Khoa học · Khái niệm", "Thẻ Khái niệm 3D", "Chạm vào thẻ để lật xem giải thích và ví dụ thực tế.") +
      '<div class="sci-concept-meta"><div class="pager">' +
      '<button class="btn btn--ghost btn--sm" type="button" id="sci-prev"' + (conceptIndex === 0 ? " disabled" : "") + ">" + api.icon("arrow-left") + "Trước</button>" +
      '<span class="pager__label">' + (conceptIndex + 1) + " / " + cards.length + "</span>" +
      '<button class="btn btn--ghost btn--sm" type="button" id="sci-next"' + (conceptIndex === cards.length - 1 ? " disabled" : "") + ">Sau " + api.icon("arrow-right") + "</button>" +
      "</div>" + bilingualBar(api) + "</div>" +
      '<div class="flashcard-scene"><div class="flashcard" id="sci-card" data-flipped="false">' +
      '<div class="flashcard__face flashcard__front">' +
      '<span class="flashcard__tag">Khái niệm Khoa học</span>' +
      (card.icon ? '<div style="font-size:56px;line-height:1" aria-hidden="true">' + api.esc(card.icon) + "</div>" : "") +
      '<div class="flashcard__word" style="font-size:clamp(26px,4vw,36px)">' + api.esc(card.term_vi) + "</div>" +
      (bi && card.term_en ? '<div class="sci-bilingual-line">' + api.esc(card.term_en) + "</div>" : "") +
      (bi && card.term_en ? '<button class="btn btn--primary btn--icon flashcard__speaker" id="sci-speak" type="button" aria-label="Nghe tiếng Anh">' + api.icon("speaker") + "</button>" : "") +
      '<button class="flashcard__hint" id="sci-flip" type="button">' + api.icon("refresh") + "Chạm thẻ để xem giải thích</button>" +
      "</div>" +
      '<div class="flashcard__face flashcard__back">' +
      '<span class="flashcard__tag">' + api.icon("check") + "Giải thích & Ví dụ</span>" +
      '<div class="flashcard__meaning" style="font-size:clamp(20px,3vw,24px)">' + api.esc(card.definition_vi) + "</div>" +
      (bi && card.definition_en ? '<div class="sci-bilingual-line">' + api.esc(card.definition_en) + "</div>" : "") +
      '<p class="flashcard__example"><strong>Ví dụ:</strong> ' + api.esc(card.example_vi) + (bi && card.example_en ? "<span>" + api.esc(card.example_en) + "</span>" : "") + "</p>" +
      '<div class="meta-row" style="margin-top:8px"><span class="chip">Trang ' + api.esc(card.source_page || 1) + "</span></div>" +
      "</div></div></div>" +
      '<div class="flash-actions"><button class="btn btn--success" type="button" id="sci-known">' + api.icon("check") + "Con đã hiểu (+5 XP)</button></div>" +
      '<div class="cta-row" style="margin-top:18px"><a class="btn btn--outline" href="#/lesson/' + encodeURIComponent(lesson.id) + '/science-sort">Chơi Phân loại ' + api.icon("arrow-right") + "</a></div>";

    var root = api.mountTo(html);
    bindBilingual(root, api, function () { renderConcepts(lesson, api); });
    var flash = root.querySelector("#sci-card");
    var flipBtn = root.querySelector("#sci-flip");
    function toggleFlip() {
      var flipped = flash.classList.toggle("is-flipped");
      flash.setAttribute("data-flipped", String(flipped));
      flipBtn.innerHTML = api.icon("refresh") + (flipped ? "Lật lại mặt trước" : "Chạm thẻ để xem giải thích");
    }
    flash.addEventListener("click", toggleFlip);
    flipBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleFlip(); });
    var speakBtn = root.querySelector("#sci-speak");
    if (speakBtn) {
      speakBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        api.speak(card.term_en + ". " + (card.definition_en || ""), {});
      });
    }
    root.querySelector("#sci-prev").addEventListener("click", function () {
      if (conceptIndex > 0) { conceptIndex -= 1; renderConcepts(lesson, api); }
    });
    root.querySelector("#sci-next").addEventListener("click", function () {
      if (conceptIndex < cards.length - 1) { conceptIndex += 1; renderConcepts(lesson, api); }
    });
    root.querySelector("#sci-known").addEventListener("click", function () {
      api.award(5, 1);
      if (api.markProgress) api.markProgress("science-concepts", card.id, cards.length);
      api.toast("Tuyệt vời! +5 XP và +1 Sao.");
      if (conceptIndex < cards.length - 1) {
        conceptIndex += 1;
        renderConcepts(lesson, api);
      }
    });
  }

  /* ---------------- 2. Category Sorter ---------------- */

  function renderSort(lesson, api) {
    var sb = lesson.scienceBlocks || {};
    var challenges = Array.isArray(sb.sort_challenges) ? sb.sort_challenges : [];
    if (!challenges.length) {
      api.mountTo(api.tabsHtml("science-sort") + '<div class="card empty-state">' + api.icon("target", "icon--lg") + '<h2 class="empty-state__title">Chưa có bài phân loại</h2><p>Bài học này chưa có thử thách phân loại.</p></div>');
      return;
    }
    sortIndex = Math.max(0, Math.min(sortIndex, challenges.length - 1));
    var ch = challenges[sortIndex];
    var bi = api.bilingual();
    var shuffledItems = shuffleSeeded(ch.items || [], hashStr(ch.id));
    var placed = {};
    var selectedId = null;
    var wrongId = null;
    var statusText = "Chạm chọn một thẻ bên trên rồi chạm vào giỏ phù hợp.";

    function draw() {
      var remaining = shuffledItems.filter(function (it) { return !placed[it.id]; });
      var done = remaining.length === 0;
      var trayHtml = remaining.length
        ? remaining.map(function (it) {
          var cls = "sci-chip" + (selectedId === it.id ? " is-selected" : "") + (wrongId === it.id ? " is-wrong" : "");
          return '<button class="' + cls + '" type="button" data-sort-item="' + api.esc(it.id) + '">' +
            (it.icon ? '<span aria-hidden="true">' + api.esc(it.icon) + "</span>" : "") +
            "<span>" + api.esc(it.text_vi) + (bi && it.text_en ? " (" + api.esc(it.text_en) + ")" : "") + "</span></button>";
        }).join("")
        : '<div class="wb-success" style="width:100%">' + api.icon("star") + "<strong>Xuất sắc!</strong> Con đã phân loại đúng toàn bộ " + shuffledItems.length + " thẻ.</div>";

      var bucketsHtml = (ch.buckets || []).map(function (b) {
        var inside = shuffledItems.filter(function (it) { return placed[it.id] === b.id; });
        return '<button class="sci-bucket" type="button" data-sort-bucket="' + api.esc(b.id) + '" style="--bucket-color:' + api.esc(b.color || "#22c55e") + '">' +
          '<div class="sci-bucket__head"><div><div class="sci-bucket__title">' + api.esc(b.label_vi) + "</div>" +
          (bi && b.label_en ? '<div class="sci-bucket__sub">' + api.esc(b.label_en) + "</div>" : "") +
          '</div><span class="chip">' + inside.length + "</span></div>" +
          '<div class="sci-bucket__items">' +
          (inside.length ? inside.map(function (it) {
            return '<span class="sci-placed-pill">' + (it.icon ? api.esc(it.icon) + " " : "") + api.esc(it.text_vi) + "</span>";
          }).join("") : '<span style="color:var(--muted-on-card);font-size:14px">Chạm vào đây để thả thẻ</span>') +
          "</div></button>";
      }).join("");

      var switcher = challenges.length > 1
        ? '<div class="read-switcher">' + challenges.map(function (entry, idx) {
          return '<button class="btn ' + (idx === sortIndex ? "btn--primary" : "btn--outline") + ' btn--sm" type="button" data-sort-switch="' + idx + '">Thử thách ' + (idx + 1) + "</button>";
        }).join("") + "</div>"
        : "";

      var root = api.mountTo(
        api.tabsHtml("science-sort") +
        api.headerHtml("Khoa học · Phân loại", ch.title_vi, (ch.prompt_vi || "") + (bi && ch.prompt_en ? " (" + ch.prompt_en + ")" : "")) +
        '<div class="sci-concept-meta">' + switcher + bilingualBar(api) + "</div>" +
        '<div class="sci-sort-wrap">' +
        '<div class="sci-sort-tray" role="group" aria-label="Thẻ cần phân loại">' + trayHtml + "</div>" +
        '<div class="sci-buckets">' + bucketsHtml + "</div>" +
        '<div class="wb-status" role="status" aria-live="polite">' + api.esc(statusText) + "</div>" +
        '<div class="wb-actions"><button class="btn btn--outline" type="button" id="sort-reset">' + api.icon("refresh") + "Chơi lại</button>" +
        '<button class="btn btn--outline" type="button" id="sort-hint">' + api.icon("info") + "Gợi ý</button>" +
        '<a class="btn btn--primary" href="#/lesson/' + encodeURIComponent(lesson.id) + '/science-seq">Sang Xếp Quy trình ' + api.icon("arrow-right") + "</a></div></div>"
      );

      bindBilingual(root, api, draw);
      root.querySelectorAll("[data-sort-switch]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          sortIndex = parseInt(btn.getAttribute("data-sort-switch"), 10) || 0;
          renderSort(lesson, api);
        });
      });
      root.querySelectorAll("[data-sort-item]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          selectedId = btn.getAttribute("data-sort-item");
          wrongId = null;
          statusText = "Đã chọn thẻ. Giờ chạm vào giỏ đúng bên dưới nhé!";
          draw();
        });
      });
      root.querySelectorAll("[data-sort-bucket]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!selectedId) {
            statusText = "Con chạm chọn một thẻ ở khay trên trước nhé!";
            draw();
            return;
          }
          var bucketId = btn.getAttribute("data-sort-bucket");
          var item = shuffledItems.filter(function (it) { return it.id === selectedId; })[0];
          if (!item) return;
          if (item.bucket_id === bucketId) {
            placed[item.id] = bucketId;
            selectedId = null;
            wrongId = null;
            api.award(4, 0);
            var left = shuffledItems.filter(function (it) { return !placed[it.id]; }).length;
            if (left === 0) {
              statusText = "Hoàn thành xuất sắc! +10 XP và +1 Sao.";
              api.award(10, 1);
              api.unlockSticker("sticker_sci_sorter");
              if (api.markProgress) api.markProgress("science-sort", ch.id, challenges.length);
              api.confetti();
            } else {
              statusText = "Chính xác! Còn " + left + " thẻ nữa.";
            }
          } else {
            wrongId = item.id;
            statusText = "Chưa đúng giỏ rồi. " + (ch.hint_vi || "Con thử suy nghĩ kỹ hơn nhé!");
          }
          draw();
        });
      });
      root.querySelector("#sort-reset").addEventListener("click", function () {
        placed = {};
        selectedId = null;
        wrongId = null;
        statusText = "Chạm chọn một thẻ bên trên rồi chạm vào giỏ phù hợp.";
        draw();
      });
      root.querySelector("#sort-hint").addEventListener("click", function () {
        statusText = "Gợi ý: " + (ch.hint_vi || "Đọc kỹ đặc điểm của từng nhóm.");
        draw();
      });
    }
    draw();
  }

  /* ---------------- 3. Process Sequencer ---------------- */

  function renderSequence(lesson, api) {
    var sb = lesson.scienceBlocks || {};
    var seqs = Array.isArray(sb.sequence_challenges) ? sb.sequence_challenges : [];
    if (!seqs.length) {
      api.mountTo(api.tabsHtml("science-seq") + '<div class="card empty-state">' + api.icon("refresh", "icon--lg") + '<h2 class="empty-state__title">Chưa có bài xếp quy trình</h2><p>Bài học này chưa có thử thách xếp thứ tự.</p></div>');
      return;
    }
    seqIndex = Math.max(0, Math.min(seqIndex, seqs.length - 1));
    var ch = seqs[seqIndex];
    var bi = api.bilingual();
    var steps = (ch.steps || []).slice().sort(function (a, b) { return a.order - b.order; });
    var shuffled = shuffleSeeded(steps, hashStr(ch.id + ":seq"));
    if (shuffled.every(function (s, idx) { return s.order === idx + 1; })) shuffled.reverse();
    var placed = [];
    var solved = false;
    var statusText = "Chạm các bước bên dưới để xếp theo thứ tự đúng từ 1 đến " + steps.length + ".";

    function draw() {
      var slotsHtml = steps.map(function (_, idx) {
        var stepOrder = placed[idx];
        var current = stepOrder ? steps.filter(function (s) { return s.order === stepOrder; })[0] : null;
        return '<button class="sci-seq-slot' + (current ? " is-filled" : "") + '" type="button" data-seq-slot="' + idx + '">' +
          '<span class="sci-seq-num">' + (idx + 1) + "</span>" +
          '<span>' + (current ? (current.icon ? api.esc(current.icon) + " " : "") + api.esc(current.text_vi) + (bi && current.text_en ? " (" + api.esc(current.text_en) + ")" : "") : "Bước " + (idx + 1) + " (còn trống)") + "</span></button>";
      }).join("");

      var trayHtml = shuffled.map(function (s) {
        var used = placed.indexOf(s.order) !== -1;
        return '<button class="sci-chip' + (used ? " is-used" : "") + '" type="button" data-seq-pick="' + s.order + '"' + (used ? " disabled style='opacity:0.35'" : "") + ">" +
          (s.icon ? '<span aria-hidden="true">' + api.esc(s.icon) + "</span>" : "") +
          "<span>" + api.esc(s.text_vi) + (bi && s.text_en ? " (" + api.esc(s.text_en) + ")" : "") + "</span></button>";
      }).join("");

      var switcher = seqs.length > 1
        ? '<div class="read-switcher">' + seqs.map(function (entry, idx) {
          return '<button class="btn ' + (idx === seqIndex ? "btn--primary" : "btn--outline") + ' btn--sm" type="button" data-seq-switch="' + idx + '">Quy trình ' + (idx + 1) + "</button>";
        }).join("") + "</div>"
        : "";

      var root = api.mountTo(
        api.tabsHtml("science-seq") +
        api.headerHtml("Khoa học · Quy trình", ch.title_vi, (ch.prompt_vi || "") + (bi && ch.prompt_en ? " (" + ch.prompt_en + ")" : "")) +
        '<div class="sci-concept-meta">' + switcher + bilingualBar(api) + "</div>" +
        '<div class="card" style="padding:18px;display:flex;flex-direction:column;gap:14px">' +
        '<div class="sci-seq-slots">' + slotsHtml + "</div>" +
        '<div class="sci-sort-tray">' + trayHtml + "</div>" +
        '<div class="wb-status' + (solved ? " is-hint" : "") + '" role="status">' + api.esc(statusText) + "</div>" +
        (solved ? '<div class="wb-success">' + api.icon("star") + "<div><strong>Chính xác!</strong> " + api.esc(ch.explanation_vi) + "</div></div>" : "") +
        '<div class="wb-actions"><button class="btn btn--outline" type="button" id="seq-reset">' + api.icon("refresh") + "Xếp lại</button>" +
        '<button class="btn btn--outline" type="button" id="seq-hint">' + api.icon("info") + "Gợi ý</button>" +
        '<a class="btn btn--primary" href="#/lesson/' + encodeURIComponent(lesson.id) + '/games">Chơi Boss Khoa học ' + api.icon("arrow-right") + "</a></div></div>"
      );

      bindBilingual(root, api, draw);
      root.querySelectorAll("[data-seq-switch]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          seqIndex = parseInt(btn.getAttribute("data-seq-switch"), 10) || 0;
          renderSequence(lesson, api);
        });
      });
      root.querySelectorAll("[data-seq-pick]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (solved) return;
          var ord = parseInt(btn.getAttribute("data-seq-pick"), 10);
          if (placed.indexOf(ord) !== -1 || placed.length >= steps.length) return;
          placed.push(ord);
          if (placed.length === steps.length) {
            var ok = placed.every(function (v, idx) { return v === idx + 1; });
            if (ok) {
              solved = true;
              statusText = "Chính xác tuyệt đối! +10 XP và +1 Sao.";
              api.award(10, 1);
              api.unlockSticker("sticker_sci_seq");
              if (api.markProgress) api.markProgress("science-seq", ch.id, seqs.length);
              api.confetti();
            } else {
              statusText = "Thứ tự chưa đúng hết. Chạm vào bước muốn bỏ ra để xếp lại nhé!";
            }
          } else {
            statusText = "Đã xếp " + placed.length + "/" + steps.length + " bước.";
          }
          draw();
        });
      });
      root.querySelectorAll("[data-seq-slot]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (solved) return;
          var idx = parseInt(btn.getAttribute("data-seq-slot"), 10);
          if (idx >= placed.length) return;
          placed.splice(idx, 1);
          statusText = "Đã lấy bước ra. Chọn lại bước đúng nhé!";
          draw();
        });
      });
      root.querySelector("#seq-reset").addEventListener("click", function () {
        placed = [];
        solved = false;
        statusText = "Chạm các bước bên dưới để xếp theo thứ tự đúng.";
        draw();
      });
      root.querySelector("#seq-hint").addEventListener("click", function () {
        var nextIdx = placed.length;
        if (nextIdx < steps.length) {
          statusText = "Gợi ý bước " + (nextIdx + 1) + ": “" + steps[nextIdx].text_vi + "”.";
          draw();
        }
      });
    }
    draw();
  }

  function render(moduleName, lesson, api) {
    syncLesson(lesson);
    if (moduleName === "science-concepts") renderConcepts(lesson, api);
    else if (moduleName === "science-sort") renderSort(lesson, api);
    else if (moduleName === "science-seq") renderSequence(lesson, api);
  }

  window.SET_SCIENCE = {
    render: render
  };
})();
