# Space Explorer — Web (M1)

Prototype HTML5 offline-first cho `PRJ-09` · Student_English_Tutor.

## Chạy local

```bash
cd "01 - Project/Student_English_Tutor/web"
python3 -m http.server 8765
# mở http://localhost:8765
```

Không mở trực tiếp `file://` nếu muốn kiểm thử service worker và cài PWA; khi mở `file://` ứng dụng vẫn chạy nhưng dùng dữ liệu nhúng trong `assets/js/data.js` và không đăng ký service worker.

## Cấu trúc

| Đường dẫn | Vai trò |
|---|---|
| `index.html` | App shell, icon sprite SVG, các vùng live-region |
| `assets/css/app.css` | Design tokens Space Explorer + toàn bộ component |
| `assets/js/app.js` | Router hash, flashcard, Sentence Lego, Read-Along, quiz demo, Design System |
| `assets/js/data.js` | Fallback lesson nhúng khi `fetch()` không khả dụng |
| `assets/data/lessons.json` | Kho bài học JSON (nạp từ `Assets/lessons/*.json` của dự án) |
| `manifest.webmanifest`, `sw.js` | PWA: cài màn hình chính, cache offline `set-v0.1.0` |
| `icons/` | Icon PWA 192/512/maskable + favicon SVG |

## Deploy GitHub Pages

Repo đích: `https://github.com/Gioins88/student_english_tutor` (thư mục `web/` chính là root của repo Pages).

Workflow `.github/workflows/pages.yml` build và deploy toàn bộ thư mục này. Sau khi push lên nhánh `main`:

1. Vào **Settings → Pages**, chọn **Source: GitHub Actions** (nếu chưa tự bật).
2. Link công khai: `https://gioins88.github.io/student_english_tutor/`.

## Phạm vi M1

- Đã có: Design System, flashcard 3D + TTS, Sentence Lego, Read-Along chạm từng từ, quiz thám tử, XP/Sao/streak lưu `localStorage`, PWA cache.
- Chưa có (M2–M4): Word Builder đầy đủ, 5 mini-game hoàn chỉnh, Mistake Bank + Spaced Repetition, Góc Phụ Huynh, nạp PDF trực tiếp trên trình duyệt.

## Ghi chú dữ liệu

`assets/data/lessons.json` hiện chứa 2 golden fixture:

- `grade4_unit04_food` — từ `S4_W11_U4_Worksheet.pdf`
- `grade4_unit03_homes` — từ `End of Unit 3 Worksheet.pdf`

Mọi item `pdf_extracted` có `source_page` + `source_quote` đã được kiểm chứng verbatim bằng `Assets/tools/pdf_to_lesson/verify.py`.
