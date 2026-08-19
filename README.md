# Cổng thông tin DLS

Trang web tĩnh hỗ trợ hoạt động Dược lâm sàng tại Bệnh viện Đa khoa Thành phố Vinh.

## Cấu trúc file

Code không còn nằm trong 1 file `script.js` duy nhất — đã tách theo module, load đúng thứ tự sau trong `index.html`:

| File | Vai trò |
|---|---|
| `index.html` | Khung trang, toàn bộ HTML các trang/section |
| `style.css` | Toàn bộ giao diện |
| `config.js` | **Cấu hình dùng chung**: `SEARCH_SHEET_ID`, `ADMIN_SCRIPT_URL`, URL 3 app Apps Script, schema các tab Quản trị (`ADMIN_TAB_SCHEMAS`) — sửa cấu hình thì sửa ở đây |
| `core.js` | Tiện ích DOM dùng chung (`$`, `escapeHtml`, `toast`...), `sanitizeRichHtml`, điều hướng app-shell (`showPage`/`route`/`switchApp`) — load trước các module tính năng |
| `calculators.js` | Công cụ tính CrCl / eGFR / Albumin cần bù |
| `lookup.js` | Tra cứu Thuốc / Hoạt chất / ICD-10 / Tương tác — đọc trực tiếp Google Sheet qua gviz |
| `antibiotic.js` | 2 công cụ Kháng sinh: đề xuất theo chuỗi Vị trí→Vi khuẩn→Kháng sinh, và phân tích nhanh kháng sinh đồ (chạy hoàn toàn ở trình duyệt) |
| `docs.js` | Tab Tài liệu (6 mục tĩnh + Bài viết mới), trang ADR |
| `phacdo.js` | Trang Phác đồ BYT |
| `qlcl.js` | Trang QLCL Dược (2 cơ sở) |
| `globalsearch.js` | Ô tìm kiếm tổng ở header, gộp kết quả từ mọi module trên |
| `admin.js` | Đăng nhập + thêm/sửa/xoá dữ liệu tất cả các tab Quản trị, tải ảnh lên Drive |
| `app-init.js` | Khởi tạo trang, gắn sự kiện — **luôn load sau cùng** vì gọi hàm từ mọi module trên |

Mọi hướng dẫn cấu hình bên dưới (`SEARCH_SHEET_ID`, `ADMIN_SCRIPT_URL`...) đều sửa trong **`config.js`**, không phải `script.js` (tên file cũ từ bản trước khi tách module).

## Đã hoàn thiện

- Giao diện được chuẩn hóa lại theo cùng hệ màu, card, spacing và responsive layout.
- Công cụ tính realtime: CrCl (Cockcroft–Gault), eGFR (CKD-EPI 2021), Albumin cần bù.
- Đánh giá nhanh chức năng thận (CrCl) và phân tầng G1–G5 (eGFR); chuyển dữ liệu sang app "Hiệu chỉnh liều kháng sinh" qua query string + `postMessage`.
- **Tra cứu Thuốc / Hoạt chất / ICD-10 / Tương tác thuốc — lấy trực tiếp từ 1 Google Sheet dùng chung**, không còn hardcode trong code (`lookup.js`). Sửa dữ liệu trên Sheet là web cập nhật ngay, không cần đụng vào code.
- Module lựa chọn kháng sinh và đọc nhanh kháng sinh đồ dạng S/I/R.
- Thư viện tài liệu có lọc theo nhóm và từ khóa.

## Thiết lập nguồn dữ liệu tra cứu (Google Sheet)

File **`DLS_TraCuu.xlsx`** đi kèm đã được làm sạch từ `Toa_thuốc.xlsx` và `ICD.xlsx`, gồm đúng 4 tab mà `lookup.js` (qua `SEARCH_TABS` khai báo trong `config.js`) cần:

| Tab | Số dòng | Cột |
|---|---|---|
| `THUOC` | 1.465 | TEN_THUOC, HOAT_CHAT, NHOM_TAC_DUNG, HAM_LUONG, TDKMM, LINK_TOA (link ảnh toa thuốc gốc, trích từ hyperlink trong `Toa_thuốc.xlsx`) |
| `HOATCHAT` | 880 | HOAT_CHAT, NHOM_TAC_DUNG, SO_TEN_THUONG_MAI, TEN_THUONG_MAI_LIEN_QUAN (tự gộp từ tab THUOC) |
| `ICD` | 15.844 | MA_ICD, TEN_BENH, LA_MA_NHOM |
| `TUONGTAC` | 2 (mẫu khởi đầu) | CAP_THUOC, MUC_DO, MO_TA, XU_TRI |
| `VITRI_VIKHUAN` | 21 (mẫu khởi đầu) | HE_CO_QUAN, VI_KHUAN, MUC_DO_THUONG_GAP (Cao/Trung bình/Thấp), GHI_CHU — quan hệ nhiều-nhiều: 1 vị trí có nhiều vi khuẩn, 1 vi khuẩn có thể thuộc nhiều vị trí |
| `VIKHUAN_KHANGSINH` | 35 (mẫu khởi đầu) | VI_KHUAN, KHANG_SINH, UU_TIEN (Ưu tiên 1/Thay thế), GHI_CHU_LIEU — sửa kháng sinh của 1 vi khuẩn ở đây là áp dụng cho mọi vị trí có vi khuẩn đó, không cần sửa nhiều chỗ |

**Vì sao tách 2 bảng thay vì gộp chung:** nếu để chung 1 dòng "Vị trí → vi khuẩn → kháng sinh" như bản trước, cùng 1 vi khuẩn (vd. *E. coli* xuất hiện ở cả Tiết niệu, Ổ bụng, Nhiễm khuẩn huyết) sẽ phải lặp lại danh sách kháng sinh ở nhiều dòng — sửa 1 kháng sinh phải sửa ở nhiều nơi, dễ sai lệch. Tách thành 2 bảng quan hệ (Vị trí↔Vi khuẩn và Vi khuẩn↔Kháng sinh), trang web tự JOIN lại khi hiển thị, nên chỉ cần sửa đúng 1 chỗ.

**Quan trọng — thứ tự cột phải giữ nguyên đúng như trên** (`lookup.js`, hàm `fetchSheetTab()`, đọc dữ liệu theo vị trí cột A, B, C... chứ không theo tên tiêu đề, để tránh lỗi khi Google Sheets tự nhận diện sai tiêu đề trên tab dữ liệu lớn như ICD). Có thể đổi tên tiêu đề hiển thị tuỳ ý, nhưng không được chèn/xoá/đảo cột.

**Các bước:**

1. Vào **Google Drive** → mở `DLS_TraCuu.xlsx` bằng **Google Sheets** (chuột phải → Open with → Google Sheets), sau đó **File → Save as Google Sheets** để giữ nguyên cả 4 tab trong cùng 1 file (mở trực tiếp giữ đủ tab hơn là Import từng phần).
2. Kiểm tra đúng tên 4 tab: `THUOC`, `HOATCHAT`, `ICD`, `TUONGTAC` (viết hoa, không dấu — khớp với `SEARCH_TABS` khai báo trong `config.js`).
3. **Share → General access → Anyone with the link → Viewer** (bắt buộc, để trang web đọc được dữ liệu công khai chỉ-xem).
4. Copy **ID Sheet** trong đường dẫn URL:
   `https://docs.google.com/spreadsheets/d/`**`<ID_Ở_ĐÂY>`**`/edit`
5. Mở **`config.js`**, tìm dòng:
   ```js
   const SEARCH_SHEET_ID="10af2fwE99_ZXlGfWu5AXamdLoyZrIxz7L1IxUAP09xA";
   ```
   thay bằng ID Sheet vừa copy, lưu lại và tải lại trang web.

Từ lúc này, Dược sĩ chỉ cần sửa/thêm dòng trực tiếp trên Google Sheet (thêm thuốc mới, sửa TDKMM, bổ sung cặp tương tác...) — trang **Tra cứu** sẽ tự lấy dữ liệu mới nhất mỗi khi có người tải lại trang, không cần sửa code hay deploy lại.

> Cơ chế: trang gọi endpoint công khai `docs.google.com/.../gviz/tq?...&sheet=<tên tab>` của chính Google Sheet — không cần viết hay deploy thêm Apps Script nào cho phần tra cứu này (khác với 3 app Báo cáo/Hiệu chỉnh liều/SGLT2 vẫn dùng Apps Script Web App như cũ, giữ nguyên URL trong `config.js`, biến `APP_URLS`).

### Ghi chú về dữ liệu

- Tab `TUONGTAC` hiện chỉ có 2 cặp tương tác mẫu (kế thừa từ bản cũ) — đây là bảng khởi đầu để Khoa Dược tự bổ sung dần, không phải danh mục đầy đủ.
- Tab `HOATCHAT` được suy ra tự động từ tab `THUOC` (gộp theo tên hoạt chất) khi tạo file — sửa `THUOC` trên Google Sheet sau này không tự động cập nhật lại `HOATCHAT`; cần gộp lại tay hoặc chạy lại script chuẩn hoá nếu muốn đồng bộ.
- Với mã ICD ở dạng nhóm 3 ký tự (ví dụ `A00`), cột `LA_MA_NHOM` đánh dấu "Có (mã nhóm...)" để nhắc dùng mã 4 ký tự chi tiết hơn khi có thể — theo đúng ghi chú gốc trong `ICD.xlsx` ("Mã không được sử dụng làm mã chính").
- 126 dòng trong `Toa_thuốc.xlsx` không có tên thuốc nên đã bị loại khỏi tab `THUOC` (không thể tra cứu nếu thiếu tên).
- Mỗi dòng thuốc trong `Toa_thuốc.xlsx` gốc có 1 hyperlink ẩn trong cột "TOA" (link ảnh toa thuốc trên imgur/postimg) — đã trích xuất sang cột `LINK_TOA`. Trang Tra cứu hiện hiển thị nút "Xem toa ↗" cho từng thuốc nếu có link (1.284/1.465 thuốc có link, 181 thuốc chưa có link trong file gốc). Nếu cần thêm/sửa link, dán trực tiếp URL vào ô `LINK_TOA` tương ứng trên Google Sheet.
- Nếu tra cứu ICD/thuốc không ra kết quả dù đã cấu hình đúng `SEARCH_SHEET_ID`: mở Console trình duyệt (F12) để xem dòng log `[DLS] Đã tải: thuoc=..., icd=...` — nếu một tab báo `0`, kiểm tra lại đúng tên tab và quyền chia sẻ "Anyone with the link – Viewer".
- Tab `VITRI_VIKHUAN` / `VIKHUAN_KHANGSINH`: thêm vị trí mới → chỉ cần thêm dòng vào `VITRI_VIKHUAN` với đúng tên vi khuẩn đã có (hoặc thêm vi khuẩn mới). Thêm/sửa kháng sinh cho 1 vi khuẩn → sửa trong `VIKHUAN_KHANGSINH`, áp dụng ngay cho mọi vị trí đang tham chiếu vi khuẩn đó. Tên vi khuẩn ở 2 tab phải gõ **giống hệt nhau** (không phân biệt hoa/thường nhưng nên gõ nhất quán) để trang web JOIN đúng.
- **Kháng sinh đồ theo từng ca bệnh: KHÔNG lưu trên Sheet.** Mục "Phân tích nhanh kết quả kháng sinh đồ" trên trang xử lý hoàn toàn trên trình duyệt của người dùng — dán đoạn text từ phần mềm xét nghiệm vào, bấm Phân tích, xem kết quả (phân loại S/Nhạy, I/Trung gian, R/Kháng) ngay lập tức, không gửi đi đâu, không ai khác thấy được, tải lại trang là mất — đúng vì đây là dữ liệu riêng theo từng bệnh nhân, không phải dữ liệu tham khảo dùng chung.

## Quản trị dữ liệu ngay trong trang (đăng nhập, sửa/thêm/xoá)

Trang có mục **"Quản trị dữ liệu"** (link ở cuối footer, hoặc vào thẳng `#admin`) cho phép Dược sĩ đăng nhập bằng mật khẩu để thêm/sửa/xoá dữ liệu các tab `THUOC`/`HOATCHAT`/`ICD`/`TUONGTAC`/`VITRI_VIKHUAN`/`VIKHUAN_KHANGSINH`/`TAILIEU_TINH`/`BAIVIET` ngay trên trang web, không cần mở Google Sheets thủ công (danh sách tab quản lý được khai báo ở `ADMIN_TAB_SCHEMAS` trong `config.js` — thêm object mới vào đó là Quản trị tự hiện thêm 1 tab thao tác mới, không cần sửa `admin.js`).

**Vì sao an toàn, F12 không lộ mật khẩu:** đây là trang tĩnh nên không có server riêng — nếu viết mật khẩu trực tiếp trong code frontend (`config.js` hay bất kỳ file `.js` nào gửi xuống trình duyệt) thì ai cũng đọc được qua View Source. Do đó việc kiểm tra mật khẩu được chuyển sang chạy trên **Google Apps Script** (server của Google): trình duyệt chỉ gửi mật khẩu người dùng gõ lên để Apps Script kiểm tra, mật khẩu đúng để so sánh được lưu ở "Script Properties" phía server — không có dòng code nào chứa mật khẩu thật được gửi xuống trình duyệt, nên F12/View Source không thấy được.

**Thiết lập (làm 1 lần):**

1. Mở Google Sheet `DLS_TraCuu` (Sheet đã tạo ở phần Tra cứu phía trên) → **Extensions → Apps Script**.
2. Xoá code mẫu, dán toàn bộ nội dung file **`AdminApi_CodeGs.txt`** (đính kèm) vào.
3. Bên trái, bấm biểu tượng bánh răng **Project Settings** → mục **Script Properties** → **Add script property**:
   - Key: `DLS_PASSWORDS`
   - Value: `{"matkhau_cua_ban":"Tên hiển thị"}` — ví dụ `{"khoaduoc2026":"Dược sĩ trực","truongkhoa2026":"Trưởng khoa Dược"}` để có nhiều mật khẩu cho nhiều người, hoặc chỉ 1 cặp dùng chung cho cả khoa.
4. **Deploy → New deployment** → chọn loại **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Bấm **Deploy**, cấp quyền khi được hỏi, rồi **copy Web app URL**.
5. Mở **`config.js`**, tìm dòng:
   ```js
   const ADMIN_SCRIPT_URL="https://script.google.com/macros/s/AKfycbx.../exec";
   ```
   dán URL Web app vừa copy vào (thay giá trị cũ), lưu lại và tải lại trang web.

Từ lúc này, vào **Quản trị dữ liệu**, nhập đúng mật khẩu đã đặt ở bước 3 là dùng được. Mỗi lần sửa nội dung `AdminApi_CodeGs.txt` sau này, nhớ vào **Deploy → Manage deployments → biểu tượng bút chì → Version: New version → Deploy** thì thay đổi mới có hiệu lực (Apps Script không tự cập nhật deployment cũ).

**Một số điểm cần biết:**
- Phiên đăng nhập tồn tại 4 giờ (có thể đổi `TOKEN_TTL_SECONDS` trong Apps Script), sau đó cần đăng nhập lại.
- Mọi thao tác thêm/sửa/xoá được ghi lại vào tab `LOG` tự tạo trong Sheet (thời gian, người sửa, tab, dòng, hành động) để truy vết.
- Tìm kiếm trong khung Quản trị dùng công cụ tìm kiếm gốc của Google Sheets nên vẫn nhanh với tab ICD ~15.800 dòng.
- Xoá dòng không thể hoàn tác (có hộp xác nhận trước khi xoá).
- Đây là mật khẩu dùng chung/cấp riêng theo thoả thuận nội bộ, không phải tài khoản Google thật — nếu muốn gắn với từng tài khoản Google cá nhân (có 2FA riêng từng người), có thể nâng cấp thêm bằng cách kiểm tra `Session.getActiveUser().getEmail()` trong Apps Script, cho tôi biết nếu bạn muốn làm hướng này thay vì mật khẩu chung.
- Nút **"🔒 Quản trị"** nằm ngay trên thanh menu chính (và cả link ở footer) — không phải chỉ trong footer.

### Đánh giá mức độ bảo mật (nói thật, không tô hồng)

**Đã đạt được:** mật khẩu thật không nằm trong bất kỳ file nào gửi xuống trình duyệt (F12/View Source không thấy) — đây là yêu cầu ban đầu và đã giải quyết đúng.

**Còn hạn chế cần biết, đã vá phần vá được, phần còn lại cần bạn cân nhắc:**
1. **Đã vá — chống XSS lưu trữ**: trước đó dữ liệu từ Sheet được chèn thẳng vào trang dạng HTML; nếu ai đó (vô tình hoặc cố ý) gõ `<script>...</script>` vào một ô, mọi người xem trang đều bị chạy đoạn mã đó. Đã sửa để mọi nội dung từ Sheet được "escape" trước khi hiển thị, ở cả trang Tra cứu công khai lẫn khung Quản trị.
2. **Đã vá — chống dò mật khẩu (brute-force)**: đã thêm khoá tạm 15 phút sau 8 lần sai liên tiếp (khoá dùng chung, không phân biệt theo người/máy — chấp nhận được với quy mô nội bộ).
3. **Đã vá (bản `AdminApi_CodeGs.txt` mới nhất)**:
   - Kiểm tra biên dòng khi Sửa/Xoá — không còn cho ghi đè/xoá dòng tiêu đề (dòng 1) hay dòng ngoài phạm vi dữ liệu hiện có.
   - Giới hạn tần suất (rate limit) cho upsert/delete/uploadImage/syncNews theo từng token — chặn kiểu gọi API dồn dập bất thường mà không ảnh hưởng thao tác bình thường qua giao diện web.
   - Kiểm tra loại ảnh (MIME) khi tải ảnh lên — chỉ nhận jpeg/png/gif/webp thay vì nhận mọi loại file.
   - Hỗ trợ lưu mật khẩu dạng đã băm SHA-256 thay vì chữ thường (tuỳ chọn — mật khẩu dạng cũ vẫn hoạt động, xem hướng dẫn/hàm `debugHashPassword_` trong file Code.gs để chuyển dần).
   - Thêm action "logout" để thu hồi token ngay khi bấm Đăng xuất, không phải chờ hết hạn.
   - Giảm thời gian sống token từ 4 giờ xuống 2 giờ.
   - Log (tab `LOG`) ghi thêm giá trị cũ/mới rút gọn để dễ truy vết/khôi phục khi cần.
   - (Tuỳ chọn, mặc định tắt) giới hạn action "syncNews" theo danh sách tên qua Script Property `DLS_ADMIN_NAMES`.
4. **Chưa vá, khuyến nghị bạn tự làm**: đặt mật khẩu **dài, ngẫu nhiên** (vd. `khoaduoc-vinh-x7Qm2r`), không dùng cụm dễ đoán như "khoaduoc2026". Đây là lớp phòng thủ chính vì mô hình hiện tại là 1 mật khẩu dùng chung, không phải tài khoản riêng từng người.
5. **Giới hạn về bản chất, chưa vá vì cần đổi kiến trúc lớn hơn**: đây vẫn là mật khẩu dùng chung, không phải đăng nhập tài khoản cá nhân có 2FA, và mọi mật khẩu hợp lệ vẫn gọi được toàn bộ action trên mọi sheet trong `ALLOWED_SHEETS` (chưa phân quyền đọc/ghi chi tiết theo từng người) — nếu để lộ thì ai có mật khẩu cũng sửa được, log chỉ ghi đúng "tên" nếu người dùng dùng đúng mật khẩu cấp riêng cho mình. Nếu khoa cần mức bảo mật cao hơn (định danh từng người dùng tài khoản Google thật, phân quyền theo vai trò), nhắn tôi để nâng cấp sang xác thực theo `Session.getActiveUser()`.

**Kết luận:** với một công cụ nội bộ chỉnh sửa dữ liệu tham khảo (thuốc/ICD/tương tác — không phải dữ liệu bệnh nhân), mức bảo mật hiện tại (sau khi dán `AdminApi_CodeGs.txt` bản mới, mục 3 ở trên) là **tốt hơn đáng kể** so với bản trước và vẫn hợp lý/đủ dùng ở quy mô nội bộ. Nó không tương đương hệ thống đăng nhập cấp doanh nghiệp có 2FA/phân quyền đầy đủ — mục 5 là điểm cần nâng cấp kiến trúc nếu muốn đạt mức đó, không phải vá thêm vài dòng code.

### Công cụ quản lý mật khẩu riêng (chỉ 1 người dùng được)

Để đổi/thêm/xoá mật khẩu Quản trị dữ liệu **thuận tiện mà vẫn kín**, `AdminApi_CodeGs.txt` có thêm 1 trang riêng, tách biệt hoàn toàn khỏi web chính và khỏi hệ thống đăng nhập Quản trị dữ liệu thường:

- **Không có link nào tới trang này** ở bất kỳ đâu trên web hay trong `admin.js`/`config.js` — người khác đọc View Source/F12 trên web chính sẽ không tìm ra được.
- Bảo vệ bằng **1 "master key" riêng** — khác hoàn toàn với mọi mật khẩu Quản trị dữ liệu, chỉ mình bạn biết, lưu ở Script Property `DLS_MASTER_KEY` (không nằm trong bất kỳ file nào gửi xuống trình duyệt).
- Sai master key quá 5 lần → khoá tạm 30 phút. Đăng nhập đúng → phiên làm việc chỉ sống **15 phút**, dùng token hoàn toàn riêng (không liên quan gì tới token Quản trị dữ liệu thường — có lấy được 1 cái cũng không dùng được cho cái kia).
- Không bao giờ hiển thị lại mật khẩu/hash thật lên màn hình, kể cả cho chính bạn — chỉ hiện tên hiển thị + trạng thái "đã băm hay chưa".

**Thiết lập (làm 1 lần):**

1. Trong Apps Script → **Project Settings → Script Properties** → **Add script property**:
   - Key: `DLS_MASTER_KEY`
   - Value: 1 chuỗi thật dài, ngẫu nhiên, **khác hẳn** mọi mật khẩu đang có trong `DLS_PASSWORDS` (vd tạo bằng trình quản lý mật khẩu, dài ≥20 ký tự). Lưu chuỗi này ở nơi an toàn (trình quản lý mật khẩu cá nhân), không dán vào bất kỳ file code hay chat nào khác ngoài ô Script Property này.
2. Deploy lại (nếu chưa deploy bản `AdminApi_CodeGs.txt` mới nhất): **Deploy → Manage deployments → bút chì → New version → Deploy**.

**Cách dùng:**

1. Mở trình duyệt, gõ: `<ADMIN_SCRIPT_URL>?tool=quanlymatkhau` (thay `<ADMIN_SCRIPT_URL>` bằng đúng URL trong `config.js`) — nên tự lưu bookmark riêng, không chia sẻ URL này cho ai.
2. Nhập master key → Đăng nhập.
3. Xem danh sách tên hiện có; mục nào ghi "⚠ chưa băm" là mật khẩu kiểu cũ (chữ thường) — nên bấm sửa lại (đặt mật khẩu mới cho đúng tên đó) để chuyển sang dạng đã băm.
4. Thêm/đổi mật khẩu: gõ **Tên hiển thị** + **Mật khẩu mới** → Lưu. Nếu tên đã tồn tại, mật khẩu cũ của tên đó tự bị thay thế (không tồn tại song song 2 mật khẩu cho cùng 1 người).
5. Xoá quyền của 1 người: bấm **Xoá** cạnh tên tương ứng.

Mọi thay đổi qua công cụ này đều được ghi vào tab `LOG` (hành động `DAT_MAT_KHAU:<tên>` / `XOA_MAT_KHAU:<tên>`) để bạn tự đối chiếu lại sau này nếu cần.

## Tab "Tài liệu" — 6 mục tĩnh + Bài viết mới (soạn thảo có định dạng, chèn ảnh)

Tab Tài liệu chia 2 khu, cả 2 đều sửa/thêm được ngay trên web qua **Quản trị dữ liệu**, không cần code:

- **6 mục tĩnh** (hiện thành 6 tab con: HD dùng kháng sinh / HD hiệu chỉnh liều / SOP cung cấp TT thuốc / SOP theo dõi ADR / Phiếu tư vấn thuốc / Văn bản QL sử dụng thuốc) — dữ liệu ở tab Sheet **`TAILIEU_TINH`**, cột `MUC, TIEU_DE, ANH_DAI_DIEN, NOI_DUNG, LINK_CONG_CU, LINK_NHAN`. Mỗi dòng ứng với đúng 1 trong 6 mục (chọn qua ô "Thuộc mục nào" khi soạn ở Quản trị). Muốn đổi *tên/số lượng* 6 mục (chứ không phải nội dung) thì sửa mảng `STATIC_DOC_SECTIONS` trong `config.js`.
- **Bài viết mới** — feed không giới hạn số bài, mới nhất lên đầu, có ô tìm kiếm, bấm "Xem thêm bài cũ hơn" để tải thêm. Dữ liệu ở tab Sheet **`BAIVIET`**, cột `TIEU_DE, NGAY_DANG, ANH_DAI_DIEN, NOI_DUNG, LINK_CONG_CU, LINK_NHAN`.

Cả 2 tab đều cần thêm vào Google Sheet `DLS_TraCuu` giống các tab khác (đúng thứ tự cột trên), rồi đăng nhập **Quản trị dữ liệu** → chọn tab "Tài liệu — 6 mục tĩnh" hoặc "Bài viết mới" để soạn.

**Soạn nội dung:** ô "Nội dung" là khung soạn thảo có thanh công cụ (Đậm/Nghiêng/Gạch chân/Tiêu đề/Danh sách/Chèn ảnh) — không cần biết HTML. Nội dung lưu xuống Sheet dưới dạng HTML đã được lọc an toàn (chỉ giữ các thẻ định dạng cơ bản, tự chặn mã lạ) trước khi lưu lẫn lúc hiển thị công khai.

**Chèn ảnh / ảnh đại diện — cần cấu hình thêm 1 lần:** ảnh được tải thẳng từ máy lên 1 thư mục Google Drive riêng qua Apps Script, không dán URL thủ công.

1. Tạo 1 thư mục mới trên Google Drive để chứa ảnh (vd "DLS_AnhTaiLieu"), copy ID thư mục trong URL (`drive.google.com/drive/folders/`**`<ID_Ở_ĐÂY>`**).
2. Vào Apps Script (Extensions → Apps Script trên Sheet `DLS_TraCuu`) → **Project Settings → Script Properties** → thêm property `DLS_IMAGE_FOLDER_ID` = ID thư mục vừa tạo.
3. Thay toàn bộ nội dung file Apps Script quản trị bằng file **`AdminApi_CodeGs.txt`** phiên bản mới đính kèm (đã thêm sẵn `TAILIEU_TINH`/`BAIVIET` vào danh sách tab được phép, và action `uploadImage` khớp đúng cấu trúc file cũ — không cần tự ghép code).
4. **Deploy → Manage deployments → biểu tượng bút chì → Version: New version → Deploy** để đổi mới có hiệu lực.
5. Giới hạn ảnh 4MB/ảnh ở trình duyệt (server chặn thêm ở mức 6MB đề phòng gọi thẳng API) — phù hợp với giới hạn dung lượng request của Apps Script Web App.

> Nếu file Apps Script hiện tại của bạn đã có thay đổi riêng khác với bản gốc ban đầu (khác `AdminApi_CodeGs.txt` cũ), đừng ghi đè toàn bộ — chỉ cần tự thêm đúng 2 chỗ: (1) thêm `'TAILIEU_TINH', 'BAIVIET'` vào mảng `ALLOWED_SHEETS`, và (2) thêm nhánh `else if (action === 'uploadImage') result = handleUploadImage_(body, authName);` trong `doPost` cùng hàm `handleUploadImage_` — copy nguyên 2 đoạn đó từ file mới đính kèm.

## Mục "SOP theo dõi ADR" — 3 link nhanh + tin tức tự động từ Trung tâm DI & ADR Quốc gia

Mục này (1 trong 6 tab con của Tài liệu) có 2 phần đặc biệt, khác các mục còn lại:

- **3 link nhanh cố định** (Báo cáo ADR trực tuyến / Hướng dẫn báo cáo ADR / Trang tin tức của Trung tâm) — luôn hiện sẵn, không cần soạn gì trong Quản trị. Muốn đổi link hoặc thêm bớt, sửa mảng `quickLinks` của mục `sop-adr` trong `STATIC_DOC_SECTIONS` (file `config.js`).
- **Tin tức tự động** — hệ thống tự kiểm tra định kỳ 2 trang của canhgiacduoc.org.vn (Tin trong nước + Tin nước ngoài) và tự thêm bài mới vào mục này, ghi rõ nguồn "Trung tâm DI & ADR Quốc gia", bấm vào tin mở thẳng trang gốc.

**Thiết lập (làm 1 lần):**

1. Thêm 1 tab mới trên Google Sheet `DLS_TraCuu`, đặt tên đúng **`TIN_CANHGIACDUOC`**, dòng tiêu đề đúng thứ tự cột:
   ```
   TIEU_DE | LINK_GOC | NGUON | MA_TIN | NGAY_LAY
   ```
   Để trống, không cần nhập dữ liệu mẫu — hệ thống tự điền.
2. Dán lại nội dung `AdminApi_CodeGs.txt` bản mới nhất (đính kèm) vào Apps Script → **Deploy → Manage deployments → bút chì → New version → Deploy** (bắt buộc, vì có thêm action `syncNews` và hàm lấy tin mới).
3. **Bật lịch tự động kiểm tra:** vẫn trong trình soạn thảo Apps Script, ở thanh trên cùng (cạnh nút Run/Debug) đổi từ hàm `doPost` sang chọn hàm **`setupNewsTrigger_`**, rồi bấm nút **Run ▷** — chỉ chạy 1 lần, không phải mỗi lần sửa code. Lần đầu chạy sẽ hỏi cấp quyền truy cập, bấm đồng ý. Xong bước này, hệ thống tự kiểm tra tin mới **mỗi 6 giờ**, không cần làm gì thêm. Muốn đổi tần suất, tìm dòng `.everyHours(6)` trong hàm `setupNewsTrigger_` (file Apps Script), sửa số giờ rồi chạy lại hàm này 1 lần nữa.
4. Muốn kiểm tra ngay không cần đợi lịch: vào **Quản trị dữ liệu** → chọn tab "Tin tức Cảnh giác dược (tự động)" → bấm **"🔄 Đồng bộ tin tức ngay"**.

**Vài điểm cần biết:**
- Hệ thống chỉ **thêm bài mới**, không bao giờ tự xoá/sửa tin cũ — muốn gỡ 1 tin không phù hợp thì vào Quản trị, tab đó, tìm và bấm Xoá như các tab khác.
- Không lấy trùng: mỗi bài trên canhgiacduoc.org.vn có 1 mã số riêng (lấy từ URL), hệ thống dựa vào mã này để biết bài nào đã lấy rồi.
- Nếu canhgiacduoc.org.vn đổi giao diện/cấu trúc trang trong tương lai, việc tự lấy tin có thể ngừng hoạt động (không báo lỗi ồn ào, chỉ đơn giản là không thêm được tin mới nữa) — lúc đó cần xem lại phần `EXTERNAL_NEWS_SOURCES`/`TITLE_LINK_RE` trong Apps Script.

## Ghi chú khác

Các URL Google Apps Script của 3 ứng dụng (Báo cáo thuốc ngoại trú, Hiệu chỉnh liều kháng sinh, Quản lý BN SGLT2) được giữ nguyên trong `config.js` (biến `APP_URLS`).

Để app "Hiệu chỉnh liều kháng sinh" tự điền form, Apps Script cần đọc query string như `crcl`, `egfr`, `age`, `sex`, `weight`, `scr` hoặc lắng nghe message `DLS_RENAL_DATA` từ trang mẹ.
