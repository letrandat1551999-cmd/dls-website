# Website Dược lâm sàng – BVĐK Thành phố Vinh

Website tĩnh, có thể triển khai miễn phí bằng GitHub Pages.

## Cấu trúc

- `index.html` – giao diện trang chủ
- `style.css` – toàn bộ giao diện
- `script.js` – JavaScript và cấu hình Apps Script

## Kết nối Apps Script

Mở `script.js` và thay:

const APPS_SCRIPT_URL = "";

bằng URL Web App của Google Apps Script:

https://script.google.com/macros/s/XXXXXXXX/exec

Sau đó bấm "Báo cáo thuốc ngoại trú" để mở ứng dụng.

## Triển khai GitHub Pages

1. Tạo repository trên GitHub, ví dụ `dls-website`.
2. Upload 3 file `index.html`, `style.css`, `script.js`.
3. Vào Settings → Pages.
4. Source: Deploy from a branch.
5. Branch: `main`, folder `/ (root)`.
6. Save.
7. GitHub sẽ cấp URL dạng:
   `https://TEN-GITHUB-CUA-BAN.github.io/dls-website/`

Chưa cần mua domain. Sau này có thể gắn custom domain.
