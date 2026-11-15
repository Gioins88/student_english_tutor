# Private hosting options — Family Edition

> **Hiện trạng 2026-11-15:** owner đã chọn public (`D-026`); GitHub Pages live 18 bài. Tài liệu này giữ lại cho phương án private trong tương lai.

## Trạng thái hiện tại (2026-11-15)

- Repo `Gioins88/student_english_tutor` đã **private**.
- GitHub API: `has_pages = false`; tạo Pages trả **422** — plan Free không hỗ trợ GitHub Pages cho repo private.
- URL `https://gioins88.github.io/student_english_tutor/` chỉ còn là **bản cache cũ**; push mới không deploy, sẽ ngừng hoạt động khi cache hết hạn.
- 18 bài đã nằm trong repo private tại `assets/data/lessons.json` (544 KB). Không có PDF trong repo.

## Cách A — Cloudflare Pages + Access (khuyến nghị)

Mục tiêu: push lên repo private → Cloudflare tự build → chỉ email được cấp phép vào.

1. Tạo tài khoản Cloudflare (Free).
2. **Workers & Pages → Create → Pages → Connect to Git** → chọn repo private.
3. Cấu hình:
   - Framework preset: **None**
   - Build command: để trống
   - Build output directory: `/` (repo root là thư mục `web/`)
4. Deploy. Mỗi lần push `main`, Cloudflare tự deploy; thiết bị nhận bài mới sau reload.
5. **Zero Trust → Access → Applications → Add self-hosted**:
   - Domain: `<project>.pages.dev`
   - Policy: `Allow` → emails của bạn/gia đình
   - Login method: One-time PIN qua email.
6. Thiết bị mở link Cloudflare, nhập email, nhận OTP một lần mỗi phiên.

## Cách B — Cloudflare Tunnel về máy Mac

Dùng khi không muốn đưa repo lên host nào:

```bash
cd "01 - Project/Student_English_Tutor/web"
python3 -m http.server 8765
# Cloudflare Tunnel trỏ tới localhost:8765, bảo vệ bằng Access
```

Thiết bị chỉ vào được khi Mac bật và tunnel chạy.

## Cách C — Public GitHub Pages

- Chuyển repo public + bật Pages; mọi thiết bị nhận update tự động.
- Nhược điểm: công khai toàn bộ học liệu/đáp án trích từ PDF bản quyền.

## Cách D — GitHub Pro/Enterprise

- Pro/Team bật được Pages cho repo private, nhưng site Pages **vẫn public** theo mặc định.
- Chỉ GitHub Enterprise Cloud có kiểm soát truy cập trang private.

## Fallback không cần host

- Mở `Deliverables/Student_English_Tutor_Family_v1.1.html` (offline, 18 bài).
- Hoặc import `Deliverables/Family_Lessons_v1.1.json` qua Góc Phụ Huynh trên từng thiết bị.
