# Space Explorer — Web App (M4)

Ứng dụng HTML5 offline-first cho `PRJ-09` · Student_English_Tutor.
Live: <https://gioins88.github.io/student_english_tutor/>

## Chạy local

```bash
cd "01 - Project/Student_English_Tutor/web"
python3 -m http.server 8765
# http://localhost:8765
```

Mở trực tiếp `file://` vẫn chạy (dùng dữ liệu nhúng + bản single-file), nhưng service worker và PDF import cần HTTP(S).

## Tính năng đã có

| Nhóm | Chi tiết |
|---|---|
| Học tương tác | Flashcard 3D + TTS, Word Builder ghép chữ, Sentence Lego lắp câu, Read-Along karaoke + chạm từng từ, Voice Coach micro (Web Speech Recognition) |
| Mini-games | Balloon Pop, Monster Boss Battle, Treasure Memory Match, Detective Cloze, Listen & Tap — 5 game, XP/Sao/Combo |
| Retention | Kho báu lỗi sai + Spaced Repetition half-life, Sticker Book, thú cưng, khiên chuỗi ngày |
| Phụ huynh | Cổng toán, dashboard tiến độ, export/import JSON, in phiếu, nạp Lesson JSON, nạp PDF qua PDF.js + Gemini API (key lưu cục bộ) |
| Chia sẻ | Link bài học, QR cho link ngắn, link dữ liệu nén LZString cho bài tự nạp |
| PWA | Cache `set-v1.0.5`, offline app shell, cài màn hình chính |

## Cấu trúc

```
index.html                 app shell + SVG icon sprite
assets/css/                app, m2, games, rewards, parent
assets/js/                 speech, srs, m2, games, parent, data, app
assets/data/lessons.json   2 golden lessons
assets/vendor/pdfjs/       PDF.js 3.11.174 (lazy load)
assets/vendor/share/       lz-string 1.4.4 + qrcode-generator 1.4.4
manifest.webmanifest, sw.js
tests/srs.test.js          Node built-in test runner (SRS + speech similarity)
```

## Deploy GitHub Pages

Repo: `https://github.com/Gioins88/student_english_tutor` — thư mục `web/` là root của repo Pages.
Workflow `.github/workflows/pages.yml` deploy qua GitHub Actions.

## Giới hạn đã biết

- PDF scan/ảnh chụp chưa có OCR (cần PDF có lớp chữ).
- Gemini extraction cần API key của phụ huynh; key chỉ lưu `localStorage`, gửi trực tiếp tới `generativelanguage.googleapis.com` bằng header `x-goog-api-key`.
- Link dữ liệu bài tự nạp có thể dài; QR chỉ tạo khi URL ≤ 2500 ký tự.
- Bản single-file `Deliverables/Student_English_Tutor_App_v1.0.html` không kèm PDF.js/worker; PDF import cần bản hosted.

## Tests

```bash
node --test tests/srs.test.js
cd ../.. && python3 -m pytest Scenarios/tests -q
```
