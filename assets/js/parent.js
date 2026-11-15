/* Space Explorer · M4 Parent Dashboard
   Parent gate, progress overview, JSON backup, lesson import, and PDF -> Gemini
   lesson creation directly in the browser. No server, no tracking. */
(function () {
  "use strict";

  var api = null;
  var rootEl = null;
  var state = {
    unlocked: false,
    tab: "overview",
    pdfBusy: false,
    status: []
  };
  var KEY_STORAGE = "set.prj09.geminiKey.v1";
  var GATE_STORAGE = "set.prj09.parentUnlocked";
  var DEFAULT_MODEL = "gemini-2.5-flash";

  function esc(value) {
    return api && api.esc ? api.esc(value) : String(value == null ? "" : value);
  }
  function icon(name, cls) {
    return api && api.icon ? api.icon(name, cls) : "";
  }
  function toast(message) {
    if (api && api.toast) api.toast(message);
  }
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function mount(container, options) {
    rootEl = container;
    api = options;
    try {
      state.unlocked = window.sessionStorage.getItem(GATE_STORAGE) === "1";
    } catch (err) {
      state.unlocked = false;
    }
    state.tab = "overview";
    render();
  }

  function render() {
    if (!rootEl) return;
    rootEl.innerHTML = state.unlocked ? dashboardHtml() : gateHtml();
    if (state.unlocked) bindDashboard();
    else bindGate();
  }

  /* ---------------- gate ---------------- */

  function gateHtml() {
    return `
      <section class="parent-gate card">
        <div class="parent-gate__art">${icon("lock", "icon--lg")}</div>
        <div class="eyebrow">Khu vực phụ huynh</div>
        <h1 class="parent-gate__title">Góc Phụ Huynh</h1>
        <p class="parent-gate__sub">Khu vực này dành cho bố mẹ: xem tiến độ, sao lưu, in phiếu và nạp bài học mới. Hãy trả lời câu hỏi nhỏ để vào.</p>
        <div class="parent-gate__question" aria-live="polite">7 × 8 = ?</div>
        <div class="parent-gate__options" role="group" aria-label="Chọn đáp án">
          <button class="btn btn--outline" type="button" data-gate="54">54</button>
          <button class="btn btn--primary" type="button" data-gate="56">56</button>
          <button class="btn btn--outline" type="button" data-gate="58">58</button>
        </div>
        <p class="parent-gate__feedback" id="gate-feedback" role="status" aria-live="polite"></p>
        <a class="backlink" href="#/home">${icon("arrow-left")}Về ứng dụng học</a>
      </section>`;
  }

  function bindGate() {
    var feedback = rootEl.querySelector("#gate-feedback");
    rootEl.querySelectorAll("[data-gate]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.getAttribute("data-gate") === "56") {
          try {
            window.sessionStorage.setItem(GATE_STORAGE, "1");
          } catch (err) {
            /* session only */
          }
          state.unlocked = true;
          render();
        } else {
          feedback.textContent = "Chưa đúng rồi. Bố mẹ thử lại phép nhân nhé.";
          button.classList.add("is-wrong");
          window.setTimeout(function () {
            button.classList.remove("is-wrong");
          }, 400);
        }
      });
    });
  }

  /* ---------------- dashboard ---------------- */

  function totals() {
    var lessons = api.lessons || [];
    var progress = api.progress || {};
    var vocabTotal = 0;
    var vocabRemembered = 0;
    lessons.forEach(function (lesson) {
      vocabTotal += lesson.vocabulary.length;
      vocabRemembered += lesson.vocabulary.filter(function (item) {
        return !!progress.remembered[lesson.id + ":" + item.id];
      }).length;
    });
    var due = 0;
    if (window.SET_SRS) {
      var now = Date.now();
      due = Object.keys(progress.mistakes || {}).map(function (key) {
        return progress.mistakes[key];
      }).filter(function (record) {
        return record && window.SET_SRS.isDue(record, now);
      }).length;
    }
    return {
      lessons: lessons,
      xp: progress.xp || 0,
      stars: progress.stars || 0,
      streak: progress.streak || 0,
      vocabTotal: vocabTotal,
      vocabRemembered: vocabRemembered,
      due: due,
      stickers: Object.keys(progress.stickers || {}).length
    };
  }

  function lessonStats(lesson) {
    var progress = api.progress || {};
    var remembered = lesson.vocabulary.filter(function (item) {
      return !!progress.remembered[lesson.id + ":" + item.id];
    }).length;
    var due = 0;
    var skills = {};
    if (window.SET_SRS) {
      var now = Date.now();
      Object.keys(progress.mistakes || {}).forEach(function (key) {
        var record = progress.mistakes[key];
        if (!record || record.lessonId !== lesson.id) return;
        skills[record.skill] = (skills[record.skill] || 0) + 1;
        if (window.SET_SRS.isDue(record, now)) due += 1;
      });
    }
    var weakest = Object.keys(skills).sort(function (a, b) {
      return skills[b] - skills[a];
    })[0];
    return {
      remembered: remembered,
      percent: lesson.vocabulary.length ? Math.round((remembered / lesson.vocabulary.length) * 100) : 0,
      due: due,
      weakest: weakest || "—",
      answered: Object.keys(progress.answered || {}).filter(function (key) {
        return key.indexOf(lesson.id + ":") === 0;
      }).length
    };
  }

  function dashboardHtml() {
    var data = totals();
    var tabs = [
      { key: "overview", label: "Tổng quan" },
      { key: "import", label: "Nạp bài mới" },
      { key: "backup", label: "Sao lưu & In" }
    ];
    var lessonCards = data.lessons.map(function (lesson) {
      var stats = lessonStats(lesson);
      return `
        <article class="card parent-lesson">
          <div class="parent-lesson__head">
            <span class="lesson-emblem">${icon("book")}</span>
            <div>
              <div class="lesson-card__unit">${esc(lesson.unit || "Bài học")}</div>
              <h3 class="parent-lesson__title">${esc(lesson.title)}</h3>
              <p class="parent-lesson__sub">${esc(lesson.subtitleVi || "")}</p>
            </div>
          </div>
          <div class="progress-line">
            <div class="progress-line__top"><span>Đã nhớ từ vựng</span><strong>${stats.remembered}/${lesson.vocabulary.length}</strong></div>
            <div class="progress-track"><span class="progress-track__fill" style="width:${stats.percent}%"></span></div>
          </div>
          <div class="parent-lesson__meta">
            <span class="chip chip--cyan">${icon("check")}${stats.answered} câu đã làm</span>
            <span class="chip chip--star">${icon("refresh")}${stats.due} mục cần ôn</span>
            <span class="chip">Kỹ năng cần chú ý: ${esc(stats.weakest)}</span>
          </div>
          <div class="cta-row">
            <a class="btn btn--outline btn--sm" href="#/lesson/${encodeURIComponent(lesson.id)}/review">${icon("refresh")}Kho báu bài này</a>
            <button class="btn btn--outline btn--sm" type="button" data-copy-lesson="${esc(lesson.id)}">${icon("globe")}Sao chép link</button>
            <button class="btn btn--outline btn--sm" type="button" data-qr-lesson="${esc(lesson.id)}">${icon("star")}Mã QR</button>
          </div>
        </article>`;
    }).join("");

    return `
      <div class="parent-shell">
        <header class="parent-head">
          <a class="backlink" href="#/home">${icon("arrow-left")}Về ứng dụng</a>
          <div class="eyebrow">PRJ-09 · Góc Phụ Huynh</div>
          <h1 class="parent-title">Bảng điều khiển của bố mẹ</h1>
          <p class="parent-sub">Mọi dữ liệu học tập nằm trên thiết bị này. Ứng dụng không gửi tiến độ của con lên máy chủ nào.</p>
        </header>

        <div class="parent-tabs" role="tablist" aria-label="Khu vực phụ huynh">
          ${tabs.map(function (tab) {
            return `<button class="tab-link" type="button" role="tab" data-parent-tab="${tab.key}" aria-selected="${state.tab === tab.key}" aria-controls="parent-panel">${esc(tab.label)}</button>`;
          }).join("")}
        </div>

        <section id="parent-panel" class="parent-panel" role="tabpanel">
          ${state.tab === "overview" ? overviewHtml(data, lessonCards) : state.tab === "import" ? importHtml() : backupHtml()}
        </section>
      </div>`;
  }

  function overviewHtml(data, lessonCards) {
    return `
      <div class="stats parent-stats">
        <div class="stat"><span class="stat__icon stat__icon--star">${icon("star")}</span><span><span class="stat__value">${data.stars}</span><span class="stat__label">Sao</span></span></div>
        <div class="stat"><span class="stat__icon stat__icon--flame">${icon("flame")}</span><span><span class="stat__value">${data.streak} ngày</span><span class="stat__label">Chuỗi học</span></span></div>
        <div class="stat"><span class="stat__icon">${icon("bolt")}</span><span><span class="stat__value">${data.xp}</span><span class="stat__label">XP</span></span></div>
        <div class="stat"><span class="stat__icon">${icon("book")}</span><span><span class="stat__value">${data.vocabRemembered}/${data.vocabTotal}</span><span class="stat__label">Từ đã nhớ</span></span></div>
        <div class="stat"><span class="stat__icon">${icon("refresh")}</span><span><span class="stat__value">${data.due}</span><span class="stat__label">Mục cần ôn hôm nay</span></span></div>
        <div class="stat"><span class="stat__icon stat__icon--star">${icon("star")}</span><span><span class="stat__value">${data.stickers}</span><span class="stat__label">Sticker</span></span></div>
      </div>
      <div class="section__head" style="margin-top:24px"><div><div class="eyebrow">Theo bài học</div><h2 class="section__title">Tiến độ từng bài</h2></div>
      <a class="btn btn--primary btn--sm" href="#/lesson/${encodeURIComponent((data.lessons[0] || {}).id || "")}/games">${icon("spark")}Chơi cùng con</a></div>
      <div class="parent-lessons">${lessonCards || '<div class="card empty-state"><p>Chưa có bài học nào.</p></div>'}</div>
      <div class="hint-card">${icon("info")}<div><strong>Gợi ý cho bố mẹ:</strong> 10–15 phút mỗi ngày hiệu quả hơn học dồn. Hãy để con tự chạm và đọc to; sai không sao, hệ thống sẽ nhắc lại qua Kho báu.</div></div>`;
  }

  function importHtml() {
    var key = "";
    try {
      key = window.localStorage.getItem(KEY_STORAGE) || "";
    } catch (err) {
      key = "";
    }
    return `
      <div class="parent-grid">
        <section class="card parent-card">
          <div class="eyebrow">Cách 1 · Nhanh</div>
          <h2 class="parent-card__title">Nạp bài học JSON</h2>
          <p class="parent-card__sub">Chọn tệp <code>.json</code> đã biên dịch sẵn theo Lesson Contract. Bài học sẽ được kiểm tra cấu trúc trước khi thêm.</p>
          <label class="file-drop" for="json-file">${icon("book", "icon--lg")}<span>Chọn tệp JSON từ máy</span><input id="json-file" type="file" accept="application/json,.json" hidden></label>
          <p class="dev-note" id="json-status" role="status" aria-live="polite"></p>
        </section>
        <section class="card parent-card">
          <div class="eyebrow">Cách 2 · Từ PDF</div>
          <h2 class="parent-card__title">Tạo bài từ PDF bằng Gemini</h2>
          <p class="parent-card__sub">Chọn PDF bài giảng lớp 3–5. Ứng dụng đọc chữ ngay trên máy, sau đó gửi nội dung tới Gemini để tạo Lesson JSON. PDF và tiến độ không được tải lên máy chủ của chúng tôi.</p>
          <label class="parent-key"><span>Gemini API key (chỉ lưu trên thiết bị này)</span>
            <input id="gemini-key" type="password" autocomplete="off" placeholder="AIza..." value="${esc(key)}">
          </label>
          <label class="parent-key"><span>Model</span>
            <input id="gemini-model" type="text" value="${esc(DEFAULT_MODEL)}" spellcheck="false">
          </label>
          <label class="parent-key"><span>Lớp của bài học</span>
            <select id="pdf-grade"><option value="3">Lớp 3</option><option value="4" selected>Lớp 4</option><option value="5">Lớp 5</option></select>
          </label>
          <label class="file-drop" for="pdf-file">${icon("ear", "icon--lg")}<span>Chọn tệp PDF bài giảng</span><input id="pdf-file" type="file" accept="application/pdf,.pdf" hidden></label>
          <div class="parent-steps" id="pdf-steps" aria-live="polite"></div>
          <button class="btn btn--outline btn--sm" id="save-key" type="button">${icon("lock")}Lưu key trên thiết bị</button>
          <p class="dev-note">Key chỉ dùng cho yêu cầu Gemini từ trình duyệt. Không commit key lên GitHub.</p>
        </section>
      </div>
      <div class="hint-card">${icon("info")}<div><strong>Giới hạn M4:</strong> PDF scan/ảnh chụp chưa có OCR; nên dùng PDF có lớp chữ (text-based). Bố mẹ có thể xem trước JSON trước khi cho con học.</div></div>`;
  }

  function backupHtml() {
    return `
      <div class="parent-grid">
        <section class="card parent-card">
          <div class="eyebrow">Sao lưu</div>
          <h2 class="parent-card__title">Xuất tiến độ & bài học</h2>
          <p class="parent-card__sub">Tạo một tệp JSON chứa XP, Sao, Sticker, Kho báu lỗi sai, lịch sử mini-game và các bài học tự nạp. Dùng để chuyển máy hoặc cất giữ an toàn.</p>
          <button class="btn btn--primary" type="button" id="export-backup">${icon("download")}Xuất tệp sao lưu</button>
          <p class="dev-note">Nên sao lưu trước khi xóa cache trình duyệt hoặc đổi thiết bị.</p>
        </section>
        <section class="card parent-card">
          <div class="eyebrow">Khôi phục</div>
          <h2 class="parent-card__title">Nhập tệp sao lưu</h2>
          <p class="parent-card__sub">Chọn tệp JSON đã xuất trước đó. Dữ liệu hiện tại trên thiết bị sẽ được thay thế.</p>
          <label class="file-drop" for="backup-file">${icon("refresh", "icon--lg")}<span>Chọn tệp sao lưu JSON</span><input id="backup-file" type="file" accept="application/json,.json" hidden></label>
          <p class="dev-note" id="backup-status" role="status" aria-live="polite"></p>
        </section>
        <section class="card parent-card">
          <div class="eyebrow">In ấn</div>
          <h2 class="parent-card__title">In phiếu ôn tập</h2>
          <p class="parent-card__sub">In danh sách từ vựng và các câu cần ôn để con luyện viết tay. Bản in dùng CSS tối ưu giấy trắng mực đen.</p>
          <button class="btn btn--outline" type="button" id="print-sheet">${icon("book")}In phiếu ôn tập</button>
        </section>
      </div>
      <div class="hint-card">${icon("lock")}<div><strong>Quyền riêng tư:</strong> tệp sao lưu chỉ nằm trên máy của bố mẹ. Ứng dụng không có backend, không tài khoản, không quảng cáo.</div></div>`;
  }

  function bindDashboard() {
    rootEl.querySelectorAll("[data-parent-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.tab = button.getAttribute("data-parent-tab");
        render();
      });
    });
    rootEl.querySelectorAll("[data-copy-lesson]").forEach(function (button) {
      button.addEventListener("click", function () {
        shareLesson(button.getAttribute("data-copy-lesson"), "copy");
      });
    });
    rootEl.querySelectorAll("[data-qr-lesson]").forEach(function (button) {
      button.addEventListener("click", function () {
        shareLesson(button.getAttribute("data-qr-lesson"), "qr");
      });
    });
    var exportButton = rootEl.querySelector("#export-backup");
    if (exportButton) {
      exportButton.addEventListener("click", function () {
        downloadJson("student_english_tutor_backup_" + today() + ".json", api.exportBackup());
      });
    }
    var printButton = rootEl.querySelector("#print-sheet");
    if (printButton) printButton.addEventListener("click", printSheet);
    bindBackupImport();
    if (state.tab === "import") bindImport();
  }

  function bindBackupImport() {
    var input = rootEl.querySelector("#backup-file");
    if (!input) return;
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var status = rootEl.querySelector("#backup-status");
      file.text().then(function (text) {
        var payload;
        try {
          payload = JSON.parse(text);
        } catch (err) {
          throw new Error("Tệp không phải JSON hợp lệ.");
        }
        if (!window.confirm("Khôi phục sẽ thay thế tiến độ hiện tại trên thiết bị này. Tiếp tục?")) return;
        api.restoreBackup(payload);
        status.textContent = "Đã khôi phục. Đang tải lại ứng dụng…";
        window.setTimeout(function () {
          window.location.reload();
        }, 600);
      }).catch(function (err) {
        status.textContent = err.message || "Không đọc được tệp.";
      });
    });
  }

  /* ---------------- JSON lesson import ---------------- */

  function bindImport() {
    var jsonInput = rootEl.querySelector("#json-file");
    var status = rootEl.querySelector("#json-status");
    if (jsonInput) {
      jsonInput.addEventListener("change", function () {
        var file = jsonInput.files && jsonInput.files[0];
        if (!file) return;
        status.textContent = "Đang đọc tệp…";
        file.text().then(function (text) {
          var raw;
          try {
            raw = JSON.parse(text);
          } catch (err) {
            throw new Error("Tệp không phải JSON hợp lệ.");
          }
          var lesson = normalizeCandidate(raw, file.name);
          var result = validateLesson(lesson);
          if (!result.ok) throw new Error("Bài học chưa hợp lệ: " + result.errors.slice(0, 3).join("; "));
          api.addLesson(lesson);
          status.innerHTML = 'Đã thêm bài “' + esc(lesson.title) + '”. <a class="link" href="#/lesson/' + encodeURIComponent(lesson.lesson_id) + '">Mở bài học</a>';
          toast("Đã thêm bài học mới.");
        }).catch(function (err) {
          status.textContent = err.message || "Không đọc được tệp.";
        });
      });
    }
    var keyInput = rootEl.querySelector("#gemini-key");
    var saveKey = rootEl.querySelector("#save-key");
    if (saveKey && keyInput) {
      saveKey.addEventListener("click", function () {
        try {
          window.localStorage.setItem(KEY_STORAGE, keyInput.value.trim());
          toast("Đã lưu Gemini key trên thiết bị này.");
        } catch (err) {
          toast("Không lưu được key trên thiết bị này.");
        }
      });
    }
    var pdfInput = rootEl.querySelector("#pdf-file");
    if (pdfInput) {
      pdfInput.addEventListener("change", function () {
        var file = pdfInput.files && pdfInput.files[0];
        if (!file) return;
        runPdfImport(file);
      });
    }
  }

  /* ---------------- PDF -> Gemini ---------------- */

  function setSteps(steps) {
    var container = rootEl.querySelector("#pdf-steps");
    if (!container) return;
    container.innerHTML = steps.map(function (step) {
      return `<div class="parent-step is-${step.status}"><span class="parent-step__dot">${step.status === "done" ? icon("check") : step.status === "active" ? icon("refresh") : icon("info")}</span><span>${esc(step.text)}</span></div>`;
    }).join("");
  }

  function updateStep(index, status, text) {
    if (!state.status[index]) state.status[index] = {};
    state.status[index].status = status;
    if (text) state.status[index].text = text;
    setSteps(state.status);
  }

  function runPdfImport(file) {
    if (state.pdfBusy) return;
    if (file.size > 25 * 1024 * 1024) {
      toast("PDF quá lớn (giới hạn 25 MB).");
      return;
    }
    var keyInput = rootEl.querySelector("#gemini-key");
    var modelInput = rootEl.querySelector("#gemini-model");
    var gradeInput = rootEl.querySelector("#pdf-grade");
    var key = (keyInput && keyInput.value.trim()) || "";
    if (!key) {
      try {
        key = window.localStorage.getItem(KEY_STORAGE) || "";
      } catch (err) {
        key = "";
      }
    }
    if (!key) {
      toast("Bố mẹ cần nhập Gemini API key trước.");
      if (keyInput) keyInput.focus();
      return;
    }
    var model = (modelInput && modelInput.value.trim()) || DEFAULT_MODEL;
    var grade = parseInt((gradeInput && gradeInput.value) || "4", 10);
    state.pdfBusy = true;
    state.currentStep = 0;
    state.status = [
      { status: "active", text: "Đọc PDF trên thiết bị…" },
      { status: "wait", text: "Gọi Gemini tạo Lesson JSON…" },
      { status: "wait", text: "Kiểm tra cấu trúc và trích dẫn…" },
      { status: "wait", text: "Lưu bài học…" }
    ];
    setSteps(state.status);

    extractPdfPages(file)
      .then(function (pages) {
        var textLength = pages.reduce(function (sum, page) { return sum + page.text.length; }, 0);
        if (textLength < 120) {
          throw new Error("PDF gần như không có lớp chữ (có thể là bản scan). Bản M4 chưa hỗ trợ OCR.");
        }
        updateStep(0, "done", "Đã đọc " + pages.length + " trang, " + textLength + " ký tự.");
        state.currentStep = 1;
        updateStep(1, "active");
        return callGemini(key, model, pages, grade).then(function (raw) {
          updateStep(1, "done", "Gemini đã trả về Lesson JSON.");
          state.currentStep = 2;
          updateStep(2, "active");
          var lesson = normalizeCandidate(raw, file.name, pages.length);
          lesson.grade_level = grade;
          var result = validateLesson(lesson);
          var quote = verifyQuotes(lesson, pages);
          lesson.metadata.qa = {
            quote_match_rate: quote.rate,
            warning_count: quote.warnings.length,
            warnings: quote.warnings.slice(0, 20)
          };
          if (quote.rate < 0.9) {
            throw new Error("Chỉ " + Math.round(quote.rate * 100) + "% trích dẫn khớp PDF. Bài học chưa được lưu để tránh sai nội dung.");
          }
          if (!result.ok) {
            throw new Error("Lesson JSON thiếu trường: " + result.errors.slice(0, 3).join("; "));
          }
          updateStep(2, "done", "Cấu trúc hợp lệ; trích dẫn khớp " + Math.round(quote.rate * 100) + "%.");
          state.currentStep = 3;
          updateStep(3, "active");
          api.addLesson(lesson);
          updateStep(3, "done", "Đã lưu bài “" + lesson.title + "”.");
          state.pdfBusy = false;
          toast("Đã tạo bài học từ PDF.");
          var panel = rootEl.querySelector("#pdf-steps");
          if (panel) {
            panel.insertAdjacentHTML("beforeend", '<a class="btn btn--primary" href="#/lesson/' + encodeURIComponent(lesson.lesson_id) + '">' + icon("rocket") + "Mở bài học mới</a>");
          }
        });
      })
      .catch(function (err) {
        state.pdfBusy = false;
        var message = err && err.message ? err.message : "Không xử lý được PDF.";
        updateStep(typeof state.currentStep === "number" ? state.currentStep : 0, "error", message);
        var panel = rootEl.querySelector("#pdf-steps");
        if (panel) panel.insertAdjacentHTML("beforeend", '<p class="parent-error">' + esc(message) + "</p>");
        toast(message);
      });
  }

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "assets/vendor/pdfjs/pdf.min.js";
      script.onload = function () {
        if (window.pdfjsLib) resolve(window.pdfjsLib);
        else reject(new Error("PDF.js không khởi động được."));
      };
      script.onerror = function () {
        reject(new Error("Không tải được PDF.js từ assets/vendor/pdfjs/."));
      };
      document.head.appendChild(script);
    });
  }

  function extractPdfPages(file) {
    return loadPdfJs().then(function (pdfjsLib) {
      return new Promise(function (resolve, reject) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "assets/vendor/pdfjs/pdf.worker.min.js";
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error("Không đọc được tệp PDF."));
      };
      reader.onload = function () {
        var task = window.pdfjsLib.getDocument({ data: new Uint8Array(reader.result) });
        task.promise.then(function (pdf) {
          var pages = [];
          var chain = Promise.resolve();
          for (var i = 1; i <= pdf.numPages; i += 1) {
            chain = chain.then(function (pageNumber) {
              return pdf.getPage(pageNumber).then(function (page) {
                return page.getTextContent().then(function (content) {
                  var text = content.items.map(function (item) { return item.str; }).join(" ").replace(/\s+/g, " ").trim();
                  pages.push({ page: pageNumber, text: text });
                });
              });
            }.bind(null, i));
          }
          return chain.then(function () {
            resolve(pages);
          });
        }).catch(function () {
          reject(new Error("PDF bị lỗi hoặc được bảo vệ."));
        });
      };
      reader.readAsArrayBuffer(file);
      });
    });
  }

  function geminiSchema() {
    var quiz = {
      type: "object",
      properties: {
        id: { type: "string" },
        game_type: { type: "string" },
        skill: { type: "string" },
        prompt_en: { type: "string" },
        prompt_vi: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        answer_index: { type: "integer" },
        hint_vi: { type: "string" },
        explanation_vi: { type: "string", nullable: true },
        audio_text: { type: "string", nullable: true },
        difficulty: { type: "string" },
        vocab_id: { type: "string", nullable: true },
        grammar_id: { type: "string", nullable: true },
        source_page: { type: "integer", nullable: true },
        source_type: { type: "string" },
        source_quote: { type: "string", nullable: true }
      },
      required: ["id", "game_type", "skill", "prompt_en", "prompt_vi", "options", "answer_index", "hint_vi", "difficulty", "source_type"]
    };
    var vocab = {
      type: "object",
      properties: {
        id: { type: "string" },
        word: { type: "string" },
        ipa: { type: "string", nullable: true },
        pos: { type: "string" },
        meaning_vi: { type: "string" },
        example_en: { type: "string" },
        example_vi: { type: "string" },
        mnemonic_vi: { type: "string", nullable: true },
        icon: { type: "string", nullable: true },
        source_page: { type: "integer" },
        source_type: { type: "string" },
        source_quote: { type: "string", nullable: true }
      },
      required: ["id", "word", "pos", "meaning_vi", "example_en", "example_vi", "source_page", "source_type"]
    };
    var lego = {
      type: "object",
      properties: {
        text: { type: "string" },
        role: { type: "string" },
        color: { type: "string" }
      },
      required: ["text", "role", "color"]
    };
    var grammar = {
      type: "object",
      properties: {
        id: { type: "string" },
        pattern: { type: "string" },
        explanation_vi: { type: "string" },
        lego_blocks: { type: "array", items: lego },
        source_page: { type: "integer", nullable: true },
        source_type: { type: "string" },
        source_quote: { type: "string", nullable: true }
      },
      required: ["id", "pattern", "explanation_vi", "lego_blocks", "source_type"]
    };
    var line = {
      type: "object",
      properties: {
        speaker: { type: "string" },
        en: { type: "string" },
        vi: { type: "string", nullable: true }
      },
      required: ["speaker", "en"]
    };
    var reading = {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        lines: { type: "array", items: line },
        source_page: { type: "integer", nullable: true },
        source_type: { type: "string" },
        source_quote: { type: "string", nullable: true }
      },
      required: ["id", "title", "lines", "source_type"]
    };
    return {
      type: "object",
      properties: {
        lesson_id: { type: "string" },
        grade_level: { type: "integer" },
        cefr: { type: "string" },
        unit: { type: "string" },
        title: { type: "string" },
        subtitle_vi: { type: "string" },
        estimated_minutes: { type: "integer" },
        learning_objectives: { type: "array", items: { type: "string" } },
        vocabulary: { type: "array", items: vocab },
        grammar_patterns: { type: "array", items: grammar },
        reading_dialogues: { type: "array", items: reading },
        quiz_bank: { type: "array", items: quiz }
      },
      required: ["lesson_id", "grade_level", "cefr", "title", "learning_objectives", "vocabulary", "grammar_patterns", "reading_dialogues", "quiz_bank"]
    };
  }

  function callGemini(key, model, pages, grade) {
    var system = [
      "You extract English lesson content for Vietnamese primary school children (grade 3-5, CEFR Pre-A1 to A1+).",
      "Return only JSON that matches the provided schema.",
      "Rules:",
      "1. Use only vocabulary, grammar, reading text and questions that appear in the provided PDF pages.",
      "2. Every item with source_type='pdf_extracted' MUST include source_page (1-based) and source_quote copied verbatim from that page.",
      "3. If you add a practice item that is not in the PDF, set source_type='generated' and source_quote=null.",
      "4. Vietnamese meanings must be natural, accurate and child-friendly. Never invent words or meanings.",
      "5. Produce 8-14 vocabulary items, 2-4 grammar patterns, 1 reading dialogue using PDF text, and at least 10 quiz items.",
      "6. Quiz game_type must be one of: balloon_pop, boss_battle, memory_match, detective_cloze, listen_tap. skill must be vocabulary, grammar, reading or listening.",
      "7. answer_index is 0-based and must point to a correct option. Use 2-4 options.",
      "8. For grade level use the provided grade. Add no markdown, no code fences, JSON only."
    ].join("\n");
    var pageText = pages.map(function (page) {
      return "<page number=\"" + page.page + "\">\n" + page.text + "\n</page>";
    }).join("\n\n");
    var user = "Grade: " + grade + "\nExtract the lesson from these worksheet pages:\n" + pageText;
    var body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0,
        response_mime_type: "application/json",
        response_schema: geminiSchema()
      }
    };
    return postGemini(key, model, body).catch(function (err) {
      if (!err.retryWithoutSchema) throw err;
      var fallback = JSON.parse(JSON.stringify(body));
      delete fallback.generationConfig.response_schema;
      return postGemini(key, model, fallback);
    });
  }

  function postGemini(key, model, body) {
    var endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent";
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var error = new Error(response.status === 400 ? "Gemini từ chối yêu cầu (kiểm tra model/schema)." : response.status === 403 ? "API key không hợp lệ hoặc chưa bật quyền." : "Gemini lỗi " + response.status + ".");
          error.retryWithoutSchema = response.status === 400;
          throw error;
        }
        var payload;
        try {
          payload = JSON.parse(text);
        } catch (err) {
          throw new Error("Gemini trả về dữ liệu không đọc được.");
        }
        var candidate = payload.candidates && payload.candidates[0];
        var content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
        var output = content && content.text ? content.text.trim() : "";
        output = output.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
        if (!output) throw new Error("Gemini không trả về nội dung.");
        try {
          return JSON.parse(output);
        } catch (err) {
          throw new Error("Gemini trả về JSON không hợp lệ.");
        }
      });
    });
  }

  function normalizeCandidate(raw, fileName, pageCount) {
    if (!raw || typeof raw !== "object") throw new Error("Gemini không trả về JSON bài học.");
    var lesson = raw;
    lesson.schema_version = "1.0.0";
    lesson.source_pdf = fileName;
    lesson.theme = "space_explorer";
    lesson.cefr = lesson.cefr || "A1";
    lesson.estimated_minutes = lesson.estimated_minutes || 15;
    lesson.learning_objectives = Array.isArray(lesson.learning_objectives) ? lesson.learning_objectives : ["Học từ vựng và mẫu câu trong bài."];
    lesson.vocabulary = Array.isArray(lesson.vocabulary) ? lesson.vocabulary : [];
    lesson.grammar_patterns = Array.isArray(lesson.grammar_patterns) ? lesson.grammar_patterns : [];
    lesson.reading_dialogues = Array.isArray(lesson.reading_dialogues) ? lesson.reading_dialogues : [];
    lesson.quiz_bank = Array.isArray(lesson.quiz_bank) ? lesson.quiz_bank : [];
    lesson.metadata = {
      extraction: {
        engine: fileName.toLowerCase().endsWith(".pdf") ? "gemini_structured_v1" : "manual_curation_v1",
        extracted_at: new Date().toISOString(),
        model: fileName.toLowerCase().endsWith(".pdf") ? ((rootEl.querySelector("#gemini-model") || {}).value || DEFAULT_MODEL) : null,
        temperature: 0,
        page_count: Math.max(1, pageCount || (lesson.metadata && lesson.metadata.extraction && lesson.metadata.extraction.page_count) || 1)
      },
      qa: { quote_match_rate: 1, warning_count: 0, warnings: [] }
    };
    return lesson;
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase()
      .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
      .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactText(value) {
    return normalizeText(value).replace(/[^a-z0-9\u00c0-\u024f]/g, "");
  }

  function tokenCoverage(quote, pageText) {
    var tokens = normalizeText(quote).replace(/[^a-z0-9\u00c0-\u024f' ]/g, " ").split(/\s+/).filter(function (token) {
      return token.length > 2;
    });
    if (tokens.length < 4) return 0;
    var hits = 0;
    tokens.forEach(function (token) {
      if (pageText.indexOf(token) !== -1) hits += 1;
    });
    return hits / tokens.length;
  }

  function verifyQuotes(lesson, pages) {
    var pageMap = {};
    pages.forEach(function (page) { pageMap[page.page] = normalizeText(page.text); });
    var checked = 0;
    var matched = 0;
    var fuzzy = 0;
    var warnings = [];
    function check(path, item) {
      if (!item || item.source_type !== "pdf_extracted") return;
      checked += 1;
      var quote = normalizeText(item.source_quote);
      var page = item.source_page;
      if (!quote || !page || !pageMap[page]) {
        warnings.push(path + ": thiếu source_page/source_quote");
        return;
      }
      var pageText = pageMap[page];
      if (pageText.indexOf(quote) !== -1) {
        matched += 1;
        return;
      }
      var compactQuote = compactText(quote);
      if (compactQuote.length >= 8 && compactText(pageText).indexOf(compactQuote) !== -1) {
        matched += 1;
        fuzzy += 1;
        return;
      }
      if (tokenCoverage(quote, pageText) >= 0.9) {
        matched += 1;
        fuzzy += 1;
        return;
      }
      warnings.push(path + ": trích dẫn không khớp trang " + page);
    }
    (lesson.vocabulary || []).forEach(function (item, index) { check("vocabulary[" + index + "]", item); });
    (lesson.grammar_patterns || []).forEach(function (item, index) { check("grammar_patterns[" + index + "]", item); });
    (lesson.reading_dialogues || []).forEach(function (item, index) { check("reading_dialogues[" + index + "]", item); });
    (lesson.quiz_bank || []).forEach(function (item, index) { check("quiz_bank[" + index + "]", item); });
    if (!checked) {
      warnings.push("Không có mục nào được đánh dấu pdf_extracted; không thể kiểm chứng nguồn.");
      return { rate: 0, checked: 0, matched: 0, warnings: warnings };
    }
    if (fuzzy) warnings.push(fuzzy + " trích dẫn khớp qua chuẩn hóa khoảng trắng/token (PDF.js chèn khoảng trắng trong từ).");
    return { rate: matched / checked, checked: checked, matched: matched, warnings: warnings };
  }

  function validateLesson(lesson) {
    var errors = [];
    if (!lesson.lesson_id || !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(lesson.lesson_id)) errors.push("lesson_id không hợp lệ");
    if (!lesson.title) errors.push("thiếu title");
    if (![3, 4, 5].includes(lesson.grade_level)) errors.push("grade_level phải là 3, 4 hoặc 5");
    if (!Array.isArray(lesson.vocabulary) || !lesson.vocabulary.length) errors.push("thiếu vocabulary");
    if (!Array.isArray(lesson.grammar_patterns) || !lesson.grammar_patterns.length) errors.push("thiếu grammar_patterns");
    if (!Array.isArray(lesson.reading_dialogues) || !lesson.reading_dialogues.length) errors.push("thiếu reading_dialogues");
    if (!Array.isArray(lesson.quiz_bank) || lesson.quiz_bank.length < 5) errors.push("cần ít nhất 5 quiz item");
    var ids = {};
    (lesson.vocabulary || []).forEach(function (item, index) {
      if (!item.id || !item.word || !item.meaning_vi) errors.push("vocabulary[" + index + "] thiếu id/word/meaning_vi");
      if (item.id) {
        if (ids[item.id]) errors.push("trùng id " + item.id);
        ids[item.id] = true;
      }
    });
    (lesson.quiz_bank || []).forEach(function (item, index) {
      if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 4) errors.push("quiz_bank[" + index + "] options phải 2-4");
      if (typeof item.answer_index !== "number" || item.answer_index < 0 || item.answer_index >= (item.options || []).length) errors.push("quiz_bank[" + index + "] answer_index sai");
      if (!["balloon_pop", "boss_battle", "memory_match", "detective_cloze", "listen_tap"].includes(item.game_type)) errors.push("quiz_bank[" + index + "] game_type sai");
    });
    return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
  }

  function shareUrlFor(lessonId) {
    var base = window.location.origin + window.location.pathname;
    var custom = (api.readCustomLessons ? api.readCustomLessons() : []).filter(function (raw) {
      return raw && raw.lesson_id === lessonId;
    })[0];
    if (custom && window.LZString) {
      var packed = window.LZString.compressToEncodedURIComponent(JSON.stringify(custom));
      return base + "#/import?data=" + packed;
    }
    return base + "#/lesson/" + encodeURIComponent(lessonId);
  }

  function shareLesson(lessonId, mode) {
    var url = shareUrlFor(lessonId);
    if (mode === "copy" || !window.qrcode) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          toast(url.length > 2500 ? "Đã sao chép link dữ liệu bài học." : "Đã sao chép link bài học.");
        }).catch(function () {
          toast(url.slice(0, 120) + "…");
        });
      } else {
        toast(url.slice(0, 160) + "…");
      }
      return;
    }
    if (url.length > 2500) {
      toast("Link bài tự nạp quá dài để tạo QR. Hãy dùng Sao chép link.");
      return;
    }
    var overlay = document.createElement("div");
    overlay.className = "share-modal";
    overlay.innerHTML = `<div class="share-card" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <button class="btn btn--ghost btn--icon share-close" type="button" aria-label="Đóng">${icon("x")}</button>
      <div class="eyebrow">Chia sẻ bài học</div>
      <h2 class="share-title" id="share-title">Quét mã QR</h2>
      <div class="share-qr" id="share-qr"></div>
      <p class="share-url">${esc(url)}</p>
      <div class="btn-row"><button class="btn btn--primary" type="button" data-share-copy>${icon("globe")}Sao chép link</button>
      ${navigator.share ? `<button class="btn btn--outline" type="button" data-share-native>${icon("rocket")}Chia sẻ</button>` : ""}</div>
      <p class="dev-note">Bài có sẵn trên GitHub Pages dùng link ngắn. Bài tự nạp được nén vào link dữ liệu.</p>
    </div>`;
    document.body.appendChild(overlay);
    try {
      var qr = window.qrcode(0, "M");
      qr.addData(url);
      qr.make();
      overlay.querySelector("#share-qr").innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2 });
    } catch (err) {
      overlay.querySelector("#share-qr").innerHTML = '<p class="dev-note">Không tạo được QR cho link này.</p>';
    }
    function close() {
      overlay.remove();
    }
    overlay.querySelector(".share-close").addEventListener("click", close);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });
    overlay.querySelector("[data-share-copy]").addEventListener("click", function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast("Đã sao chép link."); });
      }
    });
    var native = overlay.querySelector("[data-share-native]");
    if (native) {
      native.addEventListener("click", function () {
        navigator.share({ title: "Student English Tutor", url: url }).catch(function () {});
      });
    }
    overlay.querySelector(".share-close").focus({ preventScroll: true });
  }

  function downloadJson(filename, payload) {
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function printSheet() {
    var lessons = api.lessons || [];
    var progress = api.progress || {};
    var rows = [];
    lessons.forEach(function (lesson) {
      lesson.vocabulary.forEach(function (item) {
        var remembered = !!progress.remembered[lesson.id + ":" + item.id];
        rows.push(`<tr><td>${esc(item.word)}</td><td>${esc(item.meaning_vi)}</td><td>${esc(item.example_en || "")}</td><td>${remembered ? "✓" : ""}</td></tr>`);
      });
    });
    var sheet = document.createElement("section");
    sheet.className = "print-sheet";
    sheet.innerHTML = `<h1>Phiếu ôn tập · Student English Tutor</h1><p>Ngày in: ${today()} · Tổng số từ: ${rows.length}</p><table><thead><tr><th>Từ tiếng Anh</th><th>Nghĩa tiếng Việt</th><th>Ví dụ</th><th>Đã nhớ</th></tr></thead><tbody>${rows.join("")}</tbody></table><p class="print-note">Con hãy viết lại từ và đọc to ví dụ. Đánh dấu ✓ vào cột cuối khi đã nhớ.</p>`;
    document.body.appendChild(sheet);
    window.print();
    window.setTimeout(function () { sheet.remove(); }, 1200);
  }

  window.SET_PARENT = { mount: mount };
})();