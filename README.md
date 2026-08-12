# Cổng thông tin DLS

Trang web tĩnh hỗ trợ hoạt động Dược lâm sàng tại Bệnh viện Đa khoa Thành phố Vinh.

## Đã hoàn thiện

- Giao diện được chuẩn hóa lại theo cùng hệ màu, card, spacing và responsive layout.
- Công cụ tính realtime: CrCl (Cockcroft–Gault), eGFR (CKD-EPI 2021), Albumin cần bù.
- Đánh giá nhanh chức năng thận (CrCl) và phân tầng G1–G5 (eGFR); chuyển dữ liệu sang app "Hiệu chỉnh liều kháng sinh" qua query string + `postMessage`.
- **Tra cứu Thuốc / Hoạt chất / ICD-10 / Tương tác thuốc — lấy trực tiếp từ 1 Google Sheet dùng chung**, không còn hardcode trong `script.js`. Sửa dữ liệu trên Sheet là web cập nhật ngay, không cần đụng vào code.
- Module lựa chọn kháng sinh và đọc nhanh kháng sinh đồ dạng S/I/R.
- Thư viện tài liệu có lọc theo nhóm và từ khóa.

## Thiết lập nguồn dữ liệu tra cứu (Google Sheet)

File **`DLS_TraCuu.xlsx`** đi kèm đã được làm sạch từ `Toa_thuốc.xlsx` và `ICD.xlsx`, gồm đúng 4 tab mà `script.js` cần:

| Tab | Số dòng | Cột |
|---|---|---|
| `THUOC` | 1.465 | TEN_THUOC, HOAT_CHAT, NHOM_TAC_DUNG, HAM_LUONG, TDKMM, LINK_TOA (link ảnh toa thuốc gốc, trích từ hyperlink trong `Toa_thuốc.xlsx`) |
| `HOATCHAT` | 880 | HOAT_CHAT, NHOM_TAC_DUNG, SO_TEN_THUONG_MAI, TEN_THUONG_MAI_LIEN_QUAN (tự gộp từ tab THUOC) |
| `ICD` | 15.844 | MA_ICD, TEN_BENH, LA_MA_NHOM |
| `TUONGTAC` | 2 (mẫu khởi đầu) | CAP_THUOC, MUC_DO, MO_TA, XU_TRI |

**Quan trọng — thứ tự cột phải giữ nguyên đúng như trên** (script.js đọc dữ liệu theo vị trí cột A, B, C... chứ không theo tên tiêu đề, để tránh lỗi khi Google Sheets tự nhận diện sai tiêu đề trên tab dữ liệu lớn như ICD). Có thể đổi tên tiêu đề hiển thị tuỳ ý, nhưng không được chèn/xoá/đảo cột.

**Các bước:**

1. Vào **Google Drive** → mở `DLS_TraCuu.xlsx` bằng **Google Sheets** (chuột phải → Open with → Google Sheets), sau đó **File → Save as Google Sheets** để giữ nguyên cả 4 tab trong cùng 1 file (mở trực tiếp giữ đủ tab hơn là Import từng phần).
2. Kiểm tra đúng tên 4 tab: `THUOC`, `HOATCHAT`, `ICD`, `TUONGTAC` (viết hoa, không dấu — `script.js` gọi đúng theo tên này).
3. **Share → General access → Anyone with the link → Viewer** (bắt buộc, để trang web đọc được dữ liệu công khai chỉ-xem).
4. Copy **ID Sheet** trong đường dẫn URL:
   `https://docs.google.com/spreadsheets/d/`**`<ID_Ở_ĐÂY>`**`/edit`
5. Mở `script.js`, tìm dòng:
   ```js
   const SEARCH_SHEET_ID="PASTE_GOOGLE_SHEET_ID_HERE";
   ```
   thay `PASTE_GOOGLE_SHEET_ID_HERE` bằng ID vừa copy, lưu lại và tải lại trang web.

Từ lúc này, Dược sĩ chỉ cần sửa/thêm dòng trực tiếp trên Google Sheet (thêm thuốc mới, sửa TDKMM, bổ sung cặp tương tác...) — trang **Tra cứu** sẽ tự lấy dữ liệu mới nhất mỗi khi có người tải lại trang, không cần sửa code hay deploy lại.

> Cơ chế: trang gọi endpoint công khai `docs.google.com/.../gviz/tq?...&sheet=<tên tab>` của chính Google Sheet — không cần viết hay deploy thêm Apps Script nào cho phần tra cứu này (khác với 3 app Báo cáo/Hiệu chỉnh liều/SGLT2 vẫn dùng Apps Script Web App như cũ, giữ nguyên URL trong `script.js`).

### Ghi chú về dữ liệu

- Tab `TUONGTAC` hiện chỉ có 2 cặp tương tác mẫu (kế thừa từ bản cũ) — đây là bảng khởi đầu để Khoa Dược tự bổ sung dần, không phải danh mục đầy đủ.
- Tab `HOATCHAT` được suy ra tự động từ tab `THUOC` (gộp theo tên hoạt chất) khi tạo file — sửa `THUOC` trên Google Sheet sau này không tự động cập nhật lại `HOATCHAT`; cần gộp lại tay hoặc chạy lại script chuẩn hoá nếu muốn đồng bộ.
- Với mã ICD ở dạng nhóm 3 ký tự (ví dụ `A00`), cột `LA_MA_NHOM` đánh dấu "Có (mã nhóm...)" để nhắc dùng mã 4 ký tự chi tiết hơn khi có thể — theo đúng ghi chú gốc trong `ICD.xlsx` ("Mã không được sử dụng làm mã chính").
- 126 dòng trong `Toa_thuốc.xlsx` không có tên thuốc nên đã bị loại khỏi tab `THUOC` (không thể tra cứu nếu thiếu tên).
- Mỗi dòng thuốc trong `Toa_thuốc.xlsx` gốc có 1 hyperlink ẩn trong cột "TOA" (link ảnh toa thuốc trên imgur/postimg) — đã trích xuất sang cột `LINK_TOA`. Trang Tra cứu hiện hiển thị nút "Xem toa ↗" cho từng thuốc nếu có link (1.284/1.465 thuốc có link, 181 thuốc chưa có link trong file gốc). Nếu cần thêm/sửa link, dán trực tiếp URL vào ô `LINK_TOA` tương ứng trên Google Sheet.
- Nếu tra cứu ICD/thuốc không ra kết quả dù đã cấu hình đúng `SEARCH_SHEET_ID`: mở Console trình duyệt (F12) để xem dòng log `[DLS] Đã tải: thuoc=..., icd=...` — nếu một tab báo `0`, kiểm tra lại đúng tên tab và quyền chia sẻ "Anyone with the link – Viewer".

## Ghi chú khác

Các URL Google Apps Script của 3 ứng dụng (Báo cáo thuốc ngoại trú, Hiệu chỉnh liều kháng sinh, Quản lý BN SGLT2) được giữ nguyên trong `script.js`.

Để app "Hiệu chỉnh liều kháng sinh" tự điền form, Apps Script cần đọc query string như `crcl`, `egfr`, `age`, `sex`, `weight`, `scr` hoặc lắng nghe message `DLS_RENAL_DATA` từ trang mẹ.
