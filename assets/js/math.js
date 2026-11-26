/* Space Academy · Math Cartridge (WP3)
   Worked Examples, Math NumPad, Fraction & Comparison checkers,
   Step-by-step Word Problems, and Touch Canvas Scratchpad. */
(function () {
  "use strict";

  var lastLessonId = null;
  var theoryIndex = 0;
  var exIndex = 0;
  var probIndex = 0;
  var wordIndex = 0;

  function syncLesson(lesson) {
    var id = lesson && lesson.id ? lesson.id : null;
    if (id !== lastLessonId) {
      lastLessonId = id;
      theoryIndex = 0;
      exIndex = 0;
      probIndex = 0;
      wordIndex = 0;
    }
  }

  function gcd(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b !== 0) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a || 1;
  }

  function parseDecimal(text) {
    var s = String(text == null ? "" : text).trim().replace(/\s+/g, "").replace(",", ".");
    if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }

  function checkNumeric(studentText, expectedNum, tolerance) {
    var val = parseDecimal(studentText);
    if (!isFinite(val)) return { ok: false, reason: "invalid" };
    var tol = typeof tolerance === "number" && tolerance >= 0 ? tolerance : 1e-6;
    return { ok: Math.abs(val - expectedNum) <= tol, value: val };
  }

  function checkFraction(numText, denText, expNum, expDen) {
    var num = parseDecimal(numText);
    var den = parseDecimal(denText);
    if (!isFinite(num) || !isFinite(den) || den === 0 || num % 1 !== 0 || den % 1 !== 0) {
      return { ok: false, simplified: false, reason: "invalid" };
    }
    var eq = num * expDen === expNum * den;
    var simplified = gcd(num, den) === 1;
    return { ok: eq, simplified: simplified, num: num, den: den };
  }

  function formatMathHtml(text, escFn) {
    var safe = escFn ? escFn(text) : String(text == null ? "" : text);
    return safe.replace(/\b(\d+)\/(\d+)\b/g, function (_, n, d) {
      return '<span class="math-frac" aria-label="' + n + ' phần ' + d + '">' +
        '<span class="math-frac__num">' + n + "</span>" +
        '<span class="math-frac__den">' + d + "</span></span>";
    });
  }

  function bilingualBar(api) {
    var on = api.bilingual();
    return '<button class="bilingual-toggle" type="button" data-math-bi aria-pressed="' + on + '">' +
      api.icon("globe") + (on ? "Song ngữ: BẬT (VI + EN)" : "Song ngữ: TẮT (Tiếng Việt)") + "</button>";
  }

  function bindBilingual(root, api, rerender) {
    var btn = root.querySelector("[data-math-bi]");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = api.toggleBilingual();
      api.toast(next ? "Đã bật chế độ Song ngữ (Việt + Anh)." : "Đã chuyển về Tiếng Việt.");
      rerender();
    });
  }

  /* ---------------- Canvas Scratchpad ---------------- */

  function initScratchpad(canvas, root) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var drawing = false;
    var color = "#0f172a";
    var lineWidth = 3;
    var erasing = false;

    function resizeCanvas() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    resizeCanvas();

    function pointOf(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drawing = true;
      var p = pointOf(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.strokeStyle = erasing ? "#fffdf7" : color;
      ctx.lineWidth = erasing ? 18 : lineWidth;
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pointOf(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    function endDraw() {
      if (!drawing) return;
      drawing = false;
      ctx.closePath();
    }
    canvas.addEventListener("pointerup", endDraw);
    canvas.addEventListener("pointercancel", endDraw);

    root.querySelectorAll("[data-pad-color]").forEach(function (dot) {
      dot.addEventListener("click", function () {
        erasing = false;
        color = dot.getAttribute("data-pad-color");
        root.querySelectorAll("[data-pad-color]").forEach(function (d) { d.classList.remove("is-active"); });
        dot.classList.add("is-active");
        var eraserBtn = root.querySelector("#pad-eraser");
        if (eraserBtn) eraserBtn.setAttribute("aria-pressed", "false");
      });
    });
    var eraserBtn = root.querySelector("#pad-eraser");
    if (eraserBtn) {
      eraserBtn.addEventListener("click", function () {
        erasing = !erasing;
        eraserBtn.setAttribute("aria-pressed", String(erasing));
      });
    }
    var clearBtn = root.querySelector("#pad-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  }

  function scratchpadHtml() {
    return '<section class="card math-scratchpad" aria-label="Bảng nháp cảm ứng">' +
      '<div class="math-pad-tools"><strong>' + "Bảng nháp đặt tính" + '</strong>' +
      '<div class="math-pad-colors">' +
      '<button class="math-color-dot is-active" type="button" data-pad-color="#0f172a" style="background:#0f172a" aria-label="Mực đen"></button>' +
      '<button class="math-color-dot" type="button" data-pad-color="#0284c7" style="background:#0284c7" aria-label="Mực xanh"></button>' +
      '<button class="math-color-dot" type="button" data-pad-color="#dc2626" style="background:#dc2626" aria-label="Mực đỏ"></button>' +
      '<button class="btn btn--outline btn--sm" type="button" id="pad-eraser" aria-pressed="false">Tẩy</button>' +
      '<button class="btn btn--outline btn--sm" type="button" id="pad-clear">Xóa hết</button>' +
      '</div></div>' +
      '<canvas class="math-canvas" id="math-canvas"></canvas>' +
      '<span style="font-size:13px;color:var(--muted-on-card)">Dùng ngón tay hoặc bút cảm ứng viết phép tính nháp trực tiếp tại đây.</span>' +
      "</section>";
  }

  /* ---------------- 0. Theory Puzzle Game (Ôn Lý thuyết Giải đố) ---------------- */

  function renderTheoryGame(lesson, api) {
    var mb = lesson.mathBlocks || {};
    var puzzles = Array.isArray(mb.theory_puzzles) ? mb.theory_puzzles : [];
    if (!puzzles.length) {
      api.mountTo(api.tabsHtml("math-theory") + '<div class="card empty-state">' + api.icon("spark", "icon--lg") + '<h2 class="empty-state__title">Chưa có trò chơi lý thuyết</h2><p>Chương này chưa có câu đố lý thuyết. Con có thể xem ngay Ví dụ mẫu nhé.</p><a class="btn btn--primary" href="#/lesson/' + encodeURIComponent(lesson.id) + '/math-examples">Sang Ví dụ mẫu</a></div>');
      return;
    }

    theoryIndex = Math.max(0, Math.min(theoryIndex, puzzles.length - 1));
    var solvedIds = {};
    var streak = 0;
    var bestStreak = 0;
    var wrongChoices = {};
    var hintStep = 0;
    var answeredRight = false;
    var finishedScreen = false;

    function typeBadge(ptype) {
      if (ptype === "true_false_myth") return "Phá giải Đúng / Sai";
      if (ptype === "rule_cloze") return "Lắp ghép Quy tắc";
      return "Thử thách Nhanh";
    }

    function draw() {
      var bi = api.bilingual();
      if (finishedScreen) {
        var totalSolved = Object.keys(solvedIds).length;
        api.mountTo(
          api.tabsHtml("math-theory") +
          api.headerHtml("Toán học · Ôn Lý thuyết", "Giải mã Lý thuyết Hoàn tất!", "Con đã nắm chắc quy tắc trước khi bước vào giải toán.") +
          '<div class="card mt-finish">' +
          '<div class="mt-finish__icon">' + api.icon("star", "icon--lg") + "</div>" +
          '<h2 style="font-size:26px;font-weight:900">Chúc mừng! Con giải xong ' + totalSolved + "/" + puzzles.length + " câu đố!</h2>" +
          '<p style="color:var(--muted-on-card)">Chuỗi trả lời đúng liên tiếp cao nhất: <strong>' + bestStreak + "</strong>. Bây giờ con sẵn sàng chinh phục Ví dụ mẫu và Luyện tập rồi!</p>" +
          '<div class="wb-actions" style="justify-content:center">' +
          '<button class="btn btn--outline" type="button" id="mt-replay">' + api.icon("refresh") + "Chơi lại từ đầu</button>" +
          '<a class="btn btn--primary" href="#/lesson/' + encodeURIComponent(lesson.id) + '/math-examples">Xem Ví dụ mẫu ' + api.icon("arrow-right") + "</a>" +
          '<a class="btn btn--outline" href="#/lesson/' + encodeURIComponent(lesson.id) + '/math-practice">Sang Luyện tập & Nháp ' + api.icon("calc") + "</a>" +
          "</div></div>"
        );
        var replayBtn = document.querySelector("#mt-replay");
        if (replayBtn) {
          replayBtn.addEventListener("click", function () {
            theoryIndex = 0;
            solvedIds = {};
            streak = 0;
            wrongChoices = {};
            hintStep = 0;
            answeredRight = false;
            finishedScreen = false;
            draw();
          });
        }
        return;
      }

      var pz = puzzles[theoryIndex];
      var opts = Array.isArray(pz.options) ? pz.options : [];
      var hints = Array.isArray(pz.hints) ? pz.hints : [];
      var doneCount = Object.keys(solvedIds).length;
      var pctDone = Math.round((doneCount / puzzles.length) * 100);

      var optsHtml = opts.map(function (opt, idx) {
        var isCorrect = answeredRight && idx === pz.answer_index;
        var isWrong = !!wrongChoices[idx];
        var cls = "mt-opt" + (isCorrect ? " is-correct" : "") + (isWrong ? " is-wrong" : "");
        return '<button class="' + cls + '" type="button" data-mt-opt="' + idx + '"' + (answeredRight || isWrong ? " disabled" : "") + ">" +
          '<span class="answer__key">' + "ABCD".charAt(idx) + "</span>" +
          '<span class="answer__text">' + formatMathHtml(opt, api.esc) + "</span>" +
          "</button>";
      }).join("");

      var hintsHtml = hintStep > 0 && hints.length
        ? '<div class="mt-hint-box">' + api.icon("info") + "<div><strong>Gợi ý " + hintStep + "/" + hints.length + ":</strong> " +
          formatMathHtml(hints.slice(0, hintStep).join(" · "), api.esc) + "</div></div>"
        : "";

      var explainHtml = answeredRight
        ? '<div class="wb-success">' + api.icon("star") + "<div><strong>Giải thích:</strong> " + formatMathHtml(pz.explanation_vi, api.esc) +
          (bi && pz.explanation_en ? "<br><small>" + formatMathHtml(pz.explanation_en, api.esc) + "</small>" : "") + "</div></div>"
        : "";

      var root = api.mountTo(
        api.tabsHtml("math-theory") +
        api.headerHtml("Toán học · Giải đố Lý thuyết", "Mở khóa Quy tắc trước khi Luyện tập", "Phá giải các hiểu nhầm hay gặp và nắm vững mẹo tính nhanh qua trò chơi.") +
        '<div class="sci-concept-meta"><div class="pager">' +
        '<button class="btn btn--ghost btn--sm" type="button" id="mt-prev"' + (theoryIndex === 0 ? " disabled" : "") + ">" + api.icon("arrow-left") + "Câu trước</button>" +
        '<span class="pager__label">Câu ' + (theoryIndex + 1) + " / " + puzzles.length + "</span>" +
        '<button class="btn btn--ghost btn--sm" type="button" id="mt-next"' + (theoryIndex === puzzles.length - 1 ? " disabled" : "") + ">Câu sau " + api.icon("arrow-right") + "</button>" +
        "</div>" + bilingualBar(api) + "</div>" +
        '<div class="card math-problem-card">' +
        '<div class="mt-hud">' +
        '<span class="chip chip--cyan">' + api.icon("spark") + api.esc(typeBadge(pz.puzzle_type)) + "</span>" +
        '<span class="chip chip--star">' + api.icon("flame") + "Chuỗi đúng: " + streak + "</span>" +
        '<span class="chip chip--green">' + api.icon("check") + "Đã giải: " + doneCount + "/" + puzzles.length + "</span>" +
        "</div>" +
        '<div class="progress-track"><span class="progress-track__fill" style="width:' + pctDone + '%"></span></div>' +
        (pz.title_vi ? '<div style="font-size:15px;font-weight:800;color:var(--primary-deep)">' + api.esc(pz.title_vi) + (bi && pz.title_en ? " · " + api.esc(pz.title_en) : "") + "</div>" : "") +
        '<div class="wb-meaning" style="font-size:clamp(19px,2.8vw,23px)">' + formatMathHtml(pz.prompt_vi, api.esc) + "</div>" +
        (bi && pz.prompt_en ? '<div class="sci-bilingual-line">' + formatMathHtml(pz.prompt_en, api.esc) + "</div>" : "") +
        '<div class="mt-options" role="group" aria-label="Chọn đáp án giải đố">' + optsHtml + "</div>" +
        hintsHtml +
        explainHtml +
        '<div class="wb-actions">' +
        (!answeredRight && hintStep < hints.length ? '<button class="btn btn--outline" type="button" id="mt-hint">' + api.icon("info") + "Xem gợi ý (" + (hintStep + 1) + "/" + hints.length + ")</button>" : "") +
        (answeredRight && theoryIndex < puzzles.length - 1 ? '<button class="btn btn--primary" type="button" id="mt-continue">Câu đố tiếp theo ' + api.icon("arrow-right") + "</button>" : "") +
        (answeredRight && theoryIndex === puzzles.length - 1 ? '<button class="btn btn--primary" type="button" id="mt-done-btn">' + api.icon("star") + "Tổng kết Lý thuyết</button>" : "") +
        '<a class="btn btn--ghost" href="#/lesson/' + encodeURIComponent(lesson.id) + '/math-examples">Sang Ví dụ mẫu ' + api.icon("arrow-right") + "</a>" +
        "</div></div>"
      );

      bindBilingual(root, api, draw);
      var prev = root.querySelector("#mt-prev");
      var next = root.querySelector("#mt-next");
      if (prev) prev.addEventListener("click", function () {
        if (theoryIndex > 0) {
          theoryIndex -= 1;
          wrongChoices = {};
          hintStep = 0;
          answeredRight = !!solvedIds[puzzles[theoryIndex].id];
          draw();
        }
      });
      if (next) next.addEventListener("click", function () {
        if (theoryIndex < puzzles.length - 1) {
          theoryIndex += 1;
          wrongChoices = {};
          hintStep = 0;
          answeredRight = !!solvedIds[puzzles[theoryIndex].id];
          draw();
        }
      });
      var hintBtn = root.querySelector("#mt-hint");
      if (hintBtn) hintBtn.addEventListener("click", function () {
        hintStep = Math.min(hints.length, hintStep + 1);
        draw();
      });
      root.querySelectorAll("[data-mt-opt]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (answeredRight) return;
          var idx = parseInt(btn.getAttribute("data-mt-opt"), 10);
          if (idx === pz.answer_index) {
            answeredRight = true;
            if (!solvedIds[pz.id]) {
              solvedIds[pz.id] = true;
              streak += 1;
              bestStreak = Math.max(bestStreak, streak);
              api.award(8, Object.keys(solvedIds).length === puzzles.length ? 2 : 0);
              if (api.markProgress) api.markProgress("math-theory", pz.id, puzzles.length);
              if (Object.keys(solvedIds).length === puzzles.length) {
                api.unlockSticker("sticker_math_pad");
                api.confetti();
              }
            }
            api.toast("Chính xác! +8 XP");
            draw();
          } else {
            wrongChoices[idx] = true;
            streak = 0;
            if (hintStep === 0 && hints.length) hintStep = 1;
            api.recordMistake({ id: pz.id, skill: "grammar" });
            draw();
          }
        });
      });
      var contBtn = root.querySelector("#mt-continue");
      if (contBtn) contBtn.addEventListener("click", function () {
        theoryIndex += 1;
        wrongChoices = {};
        hintStep = 0;
        answeredRight = !!solvedIds[puzzles[theoryIndex].id];
        draw();
      });
      var doneBtn = root.querySelector("#mt-done-btn");
      if (doneBtn) doneBtn.addEventListener("click", function () {
        finishedScreen = true;
        api.confetti();
        draw();
      });
    }
    draw();
  }

  /* ---------------- 1. Worked Examples ---------------- */

  function renderExamples(lesson, api) {
    var mb = lesson.mathBlocks || {};
    var examples = Array.isArray(mb.worked_examples) ? mb.worked_examples : [];
    if (!examples.length) {
      api.mountTo(api.tabsHtml("math-examples") + '<div class="card empty-state">' + api.icon("book", "icon--lg") + '<h2 class="empty-state__title">Chưa có ví dụ mẫu</h2><p>Bài học này chưa có ví dụ từng bước.</p></div>');
      return;
    }
    exIndex = Math.max(0, Math.min(exIndex, examples.length - 1));
    var ex = examples[exIndex];
    var steps = Array.isArray(ex.steps) ? ex.steps : [];
    var revealed = 1;

    function draw() {
      var bi = api.bilingual();
      var visibleSteps = steps.slice(0, revealed).map(function (st) {
        return '<div class="math-step-card">' +
          '<div class="math-step-card__label">Bước ' + st.step_no + ": " + api.esc(st.label_vi) + (bi && st.label_en ? " (" + api.esc(st.label_en) + ")" : "") + "</div>" +
          '<div class="math-step-card__expr">' + formatMathHtml(st.expression, api.esc) + "</div>" +
          '<div class="math-step-card__exp">' + formatMathHtml(st.explanation_vi, api.esc) + (bi && st.explanation_en ? "<br><small>" + formatMathHtml(st.explanation_en, api.esc) + "</small>" : "") + "</div>" +
          "</div>";
      }).join("");

      var pager = examples.length > 1
        ? '<div class="pager"><button class="btn btn--ghost btn--sm" type="button" id="ex-prev"' + (exIndex === 0 ? " disabled" : "") + ">" + api.icon("arrow-left") + "Trước</button>" +
          '<span class="pager__label">' + (exIndex + 1) + " / " + examples.length + "</span>" +
          '<button class="btn btn--ghost btn--sm" type="button" id="ex-next"' + (exIndex === examples.length - 1 ? " disabled" : "") + ">Sau " + api.icon("arrow-right") + "</button></div>"
        : "";

      var root = api.mountTo(
        api.tabsHtml("math-examples") +
        api.headerHtml("Toán học · Ví dụ mẫu", ex.title_vi + (bi && ex.title_en ? " · " + ex.title_en : ""), "Chạm từng bước để hiểu cách suy luận trước khi tự làm bài.") +
        '<div class="sci-concept-meta">' + pager + bilingualBar(api) + "</div>" +
        '<div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px">' +
        '<div class="wb-meaning" style="font-size:clamp(20px,3vw,24px)">' + formatMathHtml(ex.problem_vi, api.esc) + "</div>" +
        (bi && ex.problem_en ? '<div class="sci-bilingual-line">' + formatMathHtml(ex.problem_en, api.esc) + "</div>" : "") +
        '<div class="math-step-list">' + visibleSteps + "</div>" +
        (revealed >= steps.length ? '<div class="wb-success">' + api.icon("star") + "<div><strong>Đáp số:</strong> " + formatMathHtml(ex.final_answer, api.esc) + "</div></div>" : "") +
        '<div class="wb-actions">' +
        (revealed < steps.length ? '<button class="btn btn--primary" type="button" id="ex-step-next">' + api.icon("spark") + "Mở bước " + (revealed + 1) + "/" + steps.length + "</button>" : "") +
        '<a class="btn btn--outline" href="#/lesson/' + encodeURIComponent(lesson.id) + '/math-practice">Sang Luyện tập & Nháp ' + api.icon("arrow-right") + "</a>" +
        "</div></div>"
      );

      bindBilingual(root, api, draw);
      var prev = root.querySelector("#ex-prev");
      var next = root.querySelector("#ex-next");
      if (prev) prev.addEventListener("click", function () { if (exIndex > 0) { exIndex -= 1; renderExamples(lesson, api); } });
      if (next) next.addEventListener("click", function () { if (exIndex < examples.length - 1) { exIndex += 1; renderExamples(lesson, api); } });
      var stepBtn = root.querySelector("#ex-step-next");
      if (stepBtn) stepBtn.addEventListener("click", function () {
        revealed += 1;
        if (revealed >= steps.length && api.markProgress) {
          api.markProgress("math-examples", ex.id, examples.length);
        }
        draw();
      });
      if (revealed >= steps.length && api.markProgress) {
        api.markProgress("math-examples", ex.id, examples.length);
      }
    }
    draw();
  }

  /* ---------------- 2. Math Practice + NumPad + Scratchpad ---------------- */

  function renderPractice(lesson, api, wordOnly) {
    var mb = lesson.mathBlocks || {};
    var all = Array.isArray(mb.math_problems) ? mb.math_problems : [];
    var pool = wordOnly
      ? all.filter(function (p) { return p.problem_type === "step_word_problem"; })
      : all.filter(function (p) { return p.problem_type !== "step_word_problem"; });
    if (!pool.length) pool = all;

    var tabKey = wordOnly ? "math-word" : "math-practice";
    if (!pool.length) {
      api.mountTo(api.tabsHtml(tabKey) + '<div class="card empty-state">' + api.icon("calc", "icon--lg") + '<h2 class="empty-state__title">Chưa có bài toán</h2><p>Bài học này chưa có bài tập Toán tương ứng.</p></div>');
      return;
    }

    var idxRef = wordOnly ? wordIndex : probIndex;
    idxRef = Math.max(0, Math.min(idxRef, pool.length - 1));
    if (wordOnly) wordIndex = idxRef; else probIndex = idxRef;
    var p = pool[idxRef];

    var valMain = "";
    var valDen = "";
    var activeField = "main"; // "main" | "den"
    var cmpVal = "";
    var subStepIdx = 0;
    var solved = false;
    var fbKind = "info";
    var fbText = "Dùng bàn phím số hoặc bảng nháp bên cạnh để giải bài nhé.";

    function currentSubStep() {
      if (p.problem_type === "step_word_problem" && Array.isArray(p.sub_steps) && p.sub_steps.length) {
        return p.sub_steps[Math.min(subStepIdx, p.sub_steps.length - 1)];
      }
      return null;
    }

    function mountWorkspace() {
      var bi = api.bilingual();
      var root = api.mountTo(
        api.tabsHtml(tabKey) +
        api.headerHtml(wordOnly ? "Toán học · Toán đố" : "Toán học · Luyện tập", wordOnly ? "Toán có lời văn chia chặng" : "Luyện tập & Bảng nháp", "Tự nhập số, phân số hoặc chọn dấu so sánh. Có sẵn bảng nháp cảm ứng bên cạnh.") +
        '<div class="sci-concept-meta"><div class="pager">' +
        '<button class="btn btn--ghost btn--sm" type="button" id="mp-prev"' + (idxRef === 0 ? " disabled" : "") + ">" + api.icon("arrow-left") + "Bài trước</button>" +
        '<span class="pager__label">Bài ' + (idxRef + 1) + " / " + pool.length + "</span>" +
        '<button class="btn btn--ghost btn--sm" type="button" id="mp-next"' + (idxRef === pool.length - 1 ? " disabled" : "") + ">Bài sau " + api.icon("arrow-right") + "</button>" +
        "</div>" + bilingualBar(api) + "</div>" +
        '<div class="math-workspace">' +
        '<section class="card math-problem-card" id="mp-card"></section>' +
        scratchpadHtml() +
        "</div>"
      );

      bindBilingual(root, api, function () { renderPractice(lesson, api, wordOnly); });
      initScratchpad(root.querySelector("#math-canvas"), root);
      root.querySelector("#mp-prev").addEventListener("click", function () {
        if (idxRef > 0) {
          if (wordOnly) wordIndex -= 1; else probIndex -= 1;
          renderPractice(lesson, api, wordOnly);
        }
      });
      root.querySelector("#mp-next").addEventListener("click", function () {
        if (idxRef < pool.length - 1) {
          if (wordOnly) wordIndex += 1; else probIndex += 1;
          renderPractice(lesson, api, wordOnly);
        }
      });

      function drawCard() {
        var card = root.querySelector("#mp-card");
        var step = currentSubStep();
        var answerHtml = "";

        if (p.problem_type === "fraction_input") {
          answerHtml = '<div class="math-answer-box">' +
            '<span>Phân số:</span>' +
            '<div class="math-frac-input">' +
            '<button class="math-field' + (activeField === "main" ? " is-active" : "") + '" type="button" data-field="main" aria-label="Tử số">' + api.esc(valMain || "?") + "</button>" +
            '<span class="math-frac-bar"></span>' +
            '<button class="math-field' + (activeField === "den" ? " is-active" : "") + '" type="button" data-field="den" aria-label="Mẫu số">' + api.esc(valDen || "?") + "</button>" +
            "</div>" + (p.unit ? "<strong>" + api.esc(p.unit) + "</strong>" : "") + "</div>";
        } else if (p.problem_type === "comparison") {
          answerHtml = '<div class="math-answer-box" style="justify-content:center;font-size:24px;font-weight:900">' +
            '<span>' + formatMathHtml(p.left_expr || "", api.esc) + "</span>" +
            '<span class="math-field is-active" style="min-width:64px">' + api.esc(cmpVal || "?") + "</span>" +
            '<span>' + formatMathHtml(p.right_expr || "", api.esc) + "</span></div>" +
            '<div class="wb-actions">' +
            ["<", "=", ">"].map(function (op) {
              return '<button class="math-key math-key--cmp" type="button" data-cmp="' + api.esc(op) + '">' + api.esc(op) + "</button>";
            }).join("") + "</div>";
        } else {
          var unitLabel = step ? (step.unit || "") : (p.unit || "");
          answerHtml = '<div class="math-answer-box">' +
            '<span>Đáp số:</span>' +
            '<button class="math-field is-active" type="button" data-field="main">' + api.esc(valMain || "?") + "</button>" +
            (unitLabel ? "<strong>" + api.esc(unitLabel) + "</strong>" : "") + "</div>";
        }

        var numpadHtml = p.problem_type === "comparison" ? "" : (
          '<div class="math-numpad">' +
          ["7", "8", "9", "⌫", "4", "5", "6", "-", "1", "2", "3", ",", "0", "C"].map(function (k) {
            var opCls = (k === "⌫" || k === "-" || k === "," || k === "C") ? " math-key--op" : "";
            return '<button class="math-key' + opCls + '" type="button" data-numkey="' + api.esc(k) + '"' + (k === "0" ? ' style="grid-column:span 2"' : "") + ">" + api.esc(k) + "</button>";
          }).join("") + "</div>"
        );

        var stepBanner = step
          ? '<div class="wb-masked"><span class="wb-masked__label">Chặng ' + (subStepIdx + 1) + "/" + p.sub_steps.length + ':</span><strong>' + formatMathHtml(step.prompt_vi, api.esc) + "</strong></div>"
          : "";

        var solutionHtml = solved && Array.isArray(p.steps_solution) && p.steps_solution.length
          ? '<div class="math-step-list">' + p.steps_solution.map(function (s, idx) {
            return '<div class="math-step-card"><div class="math-step-card__label">Lời giải · Bước ' + (idx + 1) + '</div><div class="math-step-card__exp">' + formatMathHtml(s, api.esc) + "</div></div>";
          }).join("") + "</div>"
          : "";

        card.innerHTML =
          '<div class="wb-clue"><span class="chip chip--cyan">' + api.esc(p.problem_type === "fraction_input" ? "Phân số" : p.problem_type === "comparison" ? "So sánh" : p.problem_type === "step_word_problem" ? "Toán lời văn" : "Tính toán") + "</span></div>" +
          '<div class="wb-meaning" style="font-size:clamp(19px,2.8vw,23px)">' + formatMathHtml(p.prompt_vi, api.esc) + "</div>" +
          (bi && p.prompt_en ? '<div class="sci-bilingual-line">' + formatMathHtml(p.prompt_en, api.esc) + "</div>" : "") +
          stepBanner +
          answerHtml +
          numpadHtml +
          '<div class="wb-status' + (fbKind === "hint" ? " is-hint" : "") + '" role="status" aria-live="polite">' + api.esc(fbText) + "</div>" +
          solutionHtml +
          '<div class="wb-actions">' +
          '<button class="btn btn--primary" type="button" id="mp-check"' + (solved ? " disabled" : "") + ">" + api.icon("check") + "Kiểm tra</button>" +
          '<button class="btn btn--outline" type="button" id="mp-hint">' + api.icon("info") + "Gợi ý</button>" +
          "</div>";

        card.querySelectorAll("[data-field]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            activeField = btn.getAttribute("data-field");
            drawCard();
          });
        });

        card.querySelectorAll("[data-cmp]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            if (solved) return;
            cmpVal = btn.getAttribute("data-cmp");
            drawCard();
          });
        });

        card.querySelectorAll("[data-numkey]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            if (solved) return;
            var k = btn.getAttribute("data-numkey");
            var cur = activeField === "den" ? valDen : valMain;
            if (k === "C") cur = "";
            else if (k === "⌫") cur = cur.slice(0, -1);
            else if (k === "-") cur = cur.indexOf("-") === 0 ? cur.slice(1) : "-" + cur;
            else if (k === ",") { if (cur.indexOf(",") === -1 && cur.indexOf(".") === -1) cur = (cur || "0") + ","; }
            else if (cur.length < 10) cur += k;
            if (activeField === "den") valDen = cur; else valMain = cur;
            drawCard();
          });
        });

        card.querySelector("#mp-hint").addEventListener("click", function () {
          fbKind = "hint";
          fbText = "Gợi ý: " + ((step && step.hint_vi) || p.hint_vi || "Con đọc kỹ dữ kiện đề bài và thử nháp bên phải nhé.");
          drawCard();
        });

        card.querySelector("#mp-check").addEventListener("click", function () {
          if (solved) return;
          if (p.problem_type === "fraction_input") {
            var fres = checkFraction(valMain, valDen, p.answer_num, p.answer_den);
            if (fres.ok) {
              solved = true;
              fbKind = "ok";
              fbText = fres.simplified
                ? "Chính xác tuyệt đối! +10 XP và +1 Sao."
                : "Đúng giá trị rồi! (+10 XP) — Mẹo nhỏ: con có thể rút gọn phân số gọn hơn nữa đấy.";
              api.award(10, 1);
              api.unlockSticker("sticker_math_pad");
              if (api.markProgress) api.markProgress(tabKey, p.id, pool.length);
              api.confetti();
            } else {
              fbKind = "hint";
              fbText = fres.reason === "invalid" ? "Con nhập đủ cả Tử số và Mẫu số (khác 0) nhé." : "Chưa đúng rồi. " + (p.hint_vi || "");
              api.recordMistake({ id: p.id, skill: "grammar" });
            }
          } else if (p.problem_type === "comparison") {
            if (!cmpVal) {
              fbKind = "hint";
              fbText = "Con chọn dấu <, = hoặc > trước nhé.";
            } else if (cmpVal === p.answer_cmp) {
              solved = true;
              fbKind = "ok";
              fbText = "Chính xác! +8 XP và +1 Sao.";
              api.award(8, 1);
              api.unlockSticker("sticker_math_pad");
              if (api.markProgress) api.markProgress(tabKey, p.id, pool.length);
              api.confetti();
            } else {
              fbKind = "hint";
              fbText = "Chưa đúng rồi. " + (p.hint_vi || "");
              api.recordMistake({ id: p.id, skill: "grammar" });
            }
          } else if (step) {
            var sres = checkNumeric(valMain, step.answer_num, p.tolerance);
            if (sres.ok) {
              if (subStepIdx < p.sub_steps.length - 1) {
                subStepIdx += 1;
                valMain = "";
                fbKind = "ok";
                fbText = "Đúng chặng " + subStepIdx + "! Tiếp tục chặng tiếp theo nhé (+5 XP).";
                api.award(5, 0);
              } else {
                solved = true;
                fbKind = "ok";
                fbText = "Xuất sắc! Con giải xong bài toán có lời văn (+12 XP và +1 Sao).";
                api.award(12, 1);
                api.unlockSticker("sticker_math_word");
                if (api.markProgress) api.markProgress(tabKey, p.id, pool.length);
                api.confetti();
              }
            } else {
              fbKind = "hint";
              fbText = sres.reason === "invalid" ? "Con nhập một số hợp lệ nhé." : "Chưa đúng chặng này. " + (step.hint_vi || "");
              api.recordMistake({ id: p.id, skill: "grammar" });
            }
          } else {
            var nres = checkNumeric(valMain, p.answer_num, p.tolerance);
            if (nres.ok) {
              solved = true;
              fbKind = "ok";
              fbText = "Chính xác! +10 XP và +1 Sao.";
              api.award(10, 1);
              api.unlockSticker("sticker_math_pad");
              if (api.markProgress) api.markProgress(tabKey, p.id, pool.length);
              api.confetti();
            } else {
              fbKind = "hint";
              fbText = nres.reason === "invalid" ? "Con nhập số vào ô đáp số nhé." : "Chưa đúng rồi. " + (p.hint_vi || "");
              api.recordMistake({ id: p.id, skill: "grammar" });
            }
          }
          drawCard();
        });
      }

      drawCard();
    }

    mountWorkspace();
  }

  function render(moduleName, lesson, api) {
    syncLesson(lesson);
    if (moduleName === "math-theory") renderTheoryGame(lesson, api);
    else if (moduleName === "math-examples") renderExamples(lesson, api);
    else if (moduleName === "math-practice") renderPractice(lesson, api, false);
    else if (moduleName === "math-word") renderPractice(lesson, api, true);
  }

  if (typeof window !== "undefined") {
    window.SET_MATH = {
      render: render,
      parseDecimal: parseDecimal,
      checkNumeric: checkNumeric,
      checkFraction: checkFraction,
      gcd: gcd,
      formatMathHtml: formatMathHtml
    };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {
      parseDecimal: parseDecimal,
      checkNumeric: checkNumeric,
      checkFraction: checkFraction,
      gcd: gcd,
      formatMathHtml: formatMathHtml
    };
  }
})();
