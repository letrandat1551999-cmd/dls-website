/* ===== config.js =====
   Toàn bộ cấu hình/dữ liệu tĩnh dùng chung: URL Apps Script, ID Google Sheet,
   schema các tab Quản trị, danh sách tài liệu. Sửa Sheet/thêm app/đổi schema
   thì chỉ cần sửa ở đây, không cần đụng vào logic các file khác. */

const APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzk2LUh-SeJfpfMlENiiqDb0Q3DK2dyrD6z3xSxFM-XtlQcn2KiXQa1Ce1eX1kIpVIZfg/exec";
const RENAL_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzmrMFkvj35fryuGdzFT4ByH4PjYi6S6Peovm2xbajFds2nmK9KHUcm3TYX8KAFPnhe/exec";
const SGLT2_SCRIPT_URL="https://script.google.com/macros/s/AKfycbwAEZenu5dyxuzWSLth2esgN5S_bxbwmZhK5hZ63l-l-FK2xF5kDneL_XfZZdV5mGKc4A/exec";
const APP_URLS={report:APPS_SCRIPT_URL,renal:RENAL_SCRIPT_URL,sglt2:SGLT2_SCRIPT_URL};
const APP_LABELS={report:"Báo cáo thuốc ngoại trú",renal:"Hiệu chỉnh liều kháng sinh",sglt2:"Quản lý BN SGLT2"};
/* 2 app này chỉ dành cho dược sĩ đã đăng nhập Quản trị (chứa số liệu nội bộ) — "Hiệu chỉnh liều
   kháng sinh" (renal) vẫn công khai bình thường. Xem chỗ chặn trong switchApp() ở core.js. */
const RESTRICTED_APPS=["report","sglt2"];
let pendingRenalData=null;

/* Tra cứu: nguồn dữ liệu Google Sheet (không hardcode) —
   1) Tạo 1 Google Sheet với 4 tab tên đúng: THUOC, HOATCHAT, ICD, TUONGTAC
      (import file DLS_TraCuu.xlsx đã chuẩn hoá sẵn 4 tab này).
   2) Chia sẻ Sheet ở chế độ "Anyone with the link – Viewer".
   3) Copy ID Sheet trong URL: docs.google.com/spreadsheets/d/<ID>/edit → dán vào SEARCH_SHEET_ID.
   Sau đó chỉnh sửa trực tiếp trên Google Sheet sẽ tự cập nhật lên web (không cần sửa code, tải lại trang là thấy). */
const SEARCH_SHEET_ID="10af2fwE99_ZXlGfWu5AXamdLoyZrIxz7L1IxUAP09xA";
const SEARCH_TABS={thuoc:"THUOC",hoatchat:"HOATCHAT",icd:"ICD",tuongtac:"TUONGTAC"};

/* Tab "Tài liệu": 2 khu tách biệt, đều lấy dữ liệu từ Google Sheet (SEARCH_SHEET_ID ở trên),
   sửa/thêm qua Quản trị dữ liệu — không còn hardcode nội dung ở đây.
     - Khu 1 "5 mục tĩnh": mỗi mục là 1 tab con cố định (danh sách khai báo ở STATIC_DOC_SECTIONS
       bên dưới — muốn đổi tên/thêm/bớt SỐ LƯỢNG mục thì sửa mảng này, còn NỘI DUNG từng mục do dược sĩ
       tự soạn trên web). Dữ liệu 1 dòng = nội dung đầy đủ của 1 mục, khớp MUC với "id" bên dưới.
       (Mục ADR trước đây từng là mục thứ 6 ở đây — nay đã tách thành 1 trang RIÊNG trên thanh công
       cụ trên cùng #adr vì là mục lớn, xem ADR_SECTION bên dưới — vẫn dùng chung cơ chế dữ liệu này.)
     - Khu 2 "Bài viết mới": feed nhiều bài, không giới hạn số lượng, mới nhất lên đầu, có tìm kiếm. */
const STATIC_DOCS_TAB="TAILIEU_TINH";
const POSTS_TAB="BAIVIET";

/* Trang "Phác đồ BYT" (#phacdo): danh sách phẳng phác đồ điều trị do Bộ Y tế ban hành + link văn
   bản gốc, lấy từ tab Sheet PHACDO_BYT (đọc qua gviz như 4 tab tra cứu chính, xem phacdo.js). */
const PHACDO_TAB="PHACDO_BYT";

/* Trang "QLCL Dược" (#qlcl): Bộ tiêu chí chất lượng Dược bệnh viện (mã C9.1–C9.6, theo Mức 1–5),
   tách riêng 2 tab Sheet cho 2 cơ sở — mỗi dòng là 1 minh chứng đã "trải phẳng" sẵn (không dùng ô
   gộp), có cột MA_TIEUCHI/TEN_TIEUCHI/MUC lặp lại ở mọi dòng cùng nhóm để trình duyệt tự gom cây
   đúng chỗ dù thêm dòng mới ở bất kỳ đâu trong Sheet. Xem qlcl.js. */
const QLCL_TABS={cs1:"QLCL_CS1",cs2:"QLCL_CS2"};

/* Danh sách các trang có sẵn trong web, để dược sĩ CHỌN thay vì phải nhớ/gõ tay mã dạng #tools,
   #antibiotic... khi soạn "Link nút bên dưới" ở tab Tài liệu/Bài viết. Muốn thêm 1 lựa chọn mới
   (VD sau này có thêm trang) thì thêm 1 dòng vào đây — admin.js tự hiện ra trong danh sách chọn. */
const PAGE_LINK_OPTIONS=[
  {value:"",label:"— Không có nút —",defaultLabel:""},
  {value:"#tools",label:"Trang Công cụ tính (CrCl/eGFR/Albumin)",defaultLabel:"Mở Công cụ tính"},
  {value:"#antibiotic",label:"Trang Kháng sinh",defaultLabel:"Mở mục Kháng sinh"},
  {value:"#search",label:"Trang Tra cứu",defaultLabel:"Mở Tra cứu"},
  {value:"#apps",label:"Trang Ứng dụng nhúng",defaultLabel:"Mở Ứng dụng"},
  {value:"#docs",label:"Trang Tài liệu",defaultLabel:"Xem thêm tài liệu"},
  {value:"#phacdo",label:"Trang Phác đồ BYT",defaultLabel:"Xem phác đồ Bộ Y tế"},
  {value:"#qlcl",label:"Trang QLCL Dược",defaultLabel:"Xem bộ tiêu chí QLCL"},
  {value:"__custom__",label:"Link khác (dán URL ngoài — Drive, PDF...)",defaultLabel:""}
];

const STATIC_DOC_SECTIONS=[
  {id:"huongdan-ks",label:"HD dùng kháng sinh",defaultLink:"#antibiotic",defaultLinkLabel:"Mở mục Kháng sinh"},
  {id:"huongdan-lieu",label:"HD hiệu chỉnh liều",defaultLink:"#tools",defaultLinkLabel:"Mở Công cụ tính"},
  {id:"sop-cctt",label:"SOP cung cấp TT thuốc",defaultLink:"#search",defaultLinkLabel:"Mở Tra cứu"},
  {id:"phieu-tuvan",label:"Phiếu tư vấn thuốc",defaultLink:"",defaultLinkLabel:""},
  {id:"vanban-ql",label:"Văn bản QL sử dụng thuốc",defaultLink:"",defaultLinkLabel:""}
];

/* Mục ADR — tách riêng khỏi 6 mục tĩnh ở trên vì giờ có hẳn 1 trang riêng trên thanh công cụ (#adr),
   không còn nằm lồng trong tab Tài liệu nữa. Vẫn dùng chung cơ chế lưu nội dung tự soạn (nếu có) ở
   tab Sheet TAILIEU_TINH như các mục khác (khớp theo MUC = "sop-adr"), chỉ khác chỗ hiển thị. */
const ADR_SECTION={
  id:"sop-adr",label:"SOP theo dõi ADR",defaultLink:"",defaultLinkLabel:"",
  quickLinks:[
    {label:"Mở form Báo cáo ADR toàn màn hình",url:"https://docs.google.com/forms/d/e/1FAIpQLSdW4oTnfEvr_B-3DIEPUINdsNA32T7Iuu5tP6vwMUgA2FDTQg/viewform"},
    {label:"Hướng dẫn báo cáo ADR",url:"https://canhgiacduoc.org.vn/CanhGiacDuoc/howtoreportadr.aspx"},
    {label:"Trang tin tức Trung tâm DI & ADR Quốc gia",url:"https://canhgiacduoc.org.vn/Thongtinthuoc/ThongTinYDuoc.aspx"}
  ],
  // Nhúng thẳng Google Form vào trang (thêm ?embedded=true vào cuối link viewform — cách nhúng
  // chính thức Google Form hỗ trợ, không bị chặn khung như phần lớn website khác). Đổi link báo cáo
  // thì sửa CẢ url ở quickLinks phía trên LẪN embedFormUrl bên dưới (embedFormUrl luôn phải có thêm
  // "?embedded=true" ở cuối, quickLinks thì không cần).
  embedFormUrl:"https://docs.google.com/forms/d/e/1FAIpQLSdW4oTnfEvr_B-3DIEPUINdsNA32T7Iuu5tP6vwMUgA2FDTQg/viewform?embedded=true",
  showExternalNews:true
};

/* Tin tức tự động lấy về từ website Trung tâm DI & ADR Quốc gia (canhgiacduoc.org.vn) — Apps Script
   (AdminApi_CodeGs.txt, hàm syncExternalNews_) tự kiểm tra định kỳ và thêm bài mới vào tab Sheet này,
   trang web chỉ đọc và hiển thị (không tự cào trực tiếp từ trình duyệt vì bị chặn CORS). Xem README.md
   mục "Tin tức tự động — Trung tâm DI & ADR Quốc gia" để biết cách bật/tắt/đổi tần suất kiểm tra. */
const EXTERNAL_NEWS_TAB="TIN_CANHGIACDUOC";
const EXTERNAL_NEWS_SOURCE_LABEL="Trung tâm DI & ADR Quốc gia";

/* Quản trị dữ liệu (đăng nhập + sửa Google Sheet qua Apps Script):
   1) Deploy Apps Script "AdminApi_CodeGs.txt" thành Web App (xem hướng dẫn trong file đó).
   2) Dán URL Web App vào ADMIN_SCRIPT_URL bên dưới. */
const ADMIN_SCRIPT_URL="https://script.google.com/macros/s/AKfycbx9ZSsb2iZz7QvOIj7y5WGHmD4Qa0ljnz1gMQgb1ex8yHMbGAIxRRE9KKlqYLqjgbYKYw/exec";

const ADMIN_TAB_SCHEMAS={
  THUOC:{
    label:"Thuốc",
    fields:[
      {key:"TEN_THUOC",label:"Tên thuốc",required:true},
      {key:"HOAT_CHAT",label:"Hoạt chất"},
      {key:"NHOM_TAC_DUNG",label:"Nhóm tác dụng"},
      {key:"HAM_LUONG",label:"Hàm lượng"},
      {key:"TDKMM",label:"TDKMM (tác dụng không mong muốn)"},
      {key:"LINK_TOA",label:"Link ảnh toa (URL)"}
    ]
  },
  HOATCHAT:{
    label:"Hoạt chất",
    fields:[
      {key:"HOAT_CHAT",label:"Hoạt chất",required:true},
      {key:"NHOM_TAC_DUNG",label:"Nhóm tác dụng"},
      {key:"SO_TEN_THUONG_MAI",label:"Số tên thương mại"},
      {key:"TEN_THUONG_MAI_LIEN_QUAN",label:"Tên thương mại liên quan (cách nhau bằng ;)"}
    ]
  },
  ICD:{
    label:"ICD-10",
    fields:[
      {key:"MA_ICD",label:"Mã ICD",required:true},
      {key:"TEN_BENH",label:"Tên bệnh",required:true},
      {key:"LA_MA_NHOM",label:"Là mã nhóm?",type:"select",options:["Không","Có (mã nhóm, không dùng làm mã chính)"]}
    ]
  },
  TUONGTAC:{
    label:"Tương tác",
    fields:[
      {key:"CAP_THUOC",label:"Cặp thuốc",required:true},
      {key:"MUC_DO",label:"Mức độ"},
      {key:"MO_TA",label:"Mô tả"},
      {key:"XU_TRI",label:"Xử trí"}
    ]
  },
  VITRI_VIKHUAN:{
    label:"Vị trí↔Vi khuẩn",
    fields:[
      {key:"HE_CO_QUAN",label:"Vị trí / hệ cơ quan nhiễm khuẩn",required:true},
      {key:"VI_KHUAN",label:"Tên vi khuẩn",required:true},
      {key:"MUC_DO_THUONG_GAP",label:"Mức độ thường gặp",type:"select",options:["Cao","Trung bình","Thấp"]},
      {key:"GHI_CHU",label:"Ghi chú"}
    ]
  },
  VIKHUAN_KHANGSINH:{
    label:"Vi khuẩn↔Kháng sinh",
    fields:[
      {key:"VI_KHUAN",label:"Tên vi khuẩn",required:true},
      {key:"KHANG_SINH",label:"Kháng sinh phù hợp",required:true},
      {key:"UU_TIEN",label:"Mức ưu tiên",type:"select",options:["Ưu tiên 1","Thay thế"]},
      {key:"GHI_CHU_LIEU",label:"Ghi chú về liều / lưu ý khi dùng"}
    ]
  },
  TAILIEU_TINH:{
    label:"Tài liệu — 6 mục tĩnh",
    fields:[
      {key:"MUC",label:"Thuộc mục nào",required:true,type:"select",
        options:STATIC_DOC_SECTIONS.concat([ADR_SECTION]).map(s=>({value:s.id,label:s.label}))},
      {key:"TIEU_DE",label:"Tiêu đề hiển thị",required:true},
      {key:"ANH_DAI_DIEN",label:"Ảnh đại diện",type:"image"},
      {key:"NOI_DUNG",label:"Nội dung",type:"richtext"},
      {key:"LINK_CONG_CU",label:"Nút bên dưới dẫn tới đâu",type:"linkpicker"},
      {key:"LINK_NHAN",label:"Nhãn nút (tự gợi ý khi chọn ở trên, có thể sửa lại)"}
    ]
  },
  BAIVIET:{
    label:"Bài viết mới",
    fields:[
      {key:"TIEU_DE",label:"Tiêu đề bài viết",required:true},
      {key:"NGAY_DANG",label:"Ngày đăng",type:"date"},
      {key:"ANH_DAI_DIEN",label:"Ảnh đại diện",type:"image"},
      {key:"NOI_DUNG",label:"Nội dung",type:"richtext"},
      {key:"LINK_CONG_CU",label:"Nút bên dưới dẫn tới đâu",type:"linkpicker"},
      {key:"LINK_NHAN",label:"Nhãn nút (tự gợi ý khi chọn ở trên, có thể sửa lại)"},
      {key:"MA_BAIVIET",label:"Mã bài viết (tự tạo, dùng làm link riêng cho bài — không cần sửa)",type:"slug"},
      {key:"NOI_BAT",label:"★ Đánh dấu bài nổi bật (hiện xoay vòng ở Trang chủ)",type:"checkbox"}
    ]
  },
  TIN_CANHGIACDUOC:{
    label:"Tin tức Cảnh giác dược (tự động)",
    fields:[
      {key:"TIEU_DE",label:"Tiêu đề bài",required:true},
      {key:"LINK_GOC",label:"Link gốc (trang canhgiacduoc.org.vn)",required:true},
      {key:"NGUON",label:"Thuộc mục",type:"select",options:["Trong nước","Nước ngoài"]},
      {key:"MA_TIN",label:"Mã tin (id bài trên canhgiacduoc.org.vn — dùng để không lấy trùng)"},
      {key:"NGAY_LAY",label:"Lúc hệ thống lấy về",type:"date"}
    ]
  },
  PHACDO_BYT:{
    label:"Phác đồ BYT",
    fields:[
      {key:"TEN_PHAC_DO",label:"Tên phác đồ",required:true},
      {key:"LINK",label:"Link văn bản gốc",required:true}
    ]
  },
  QLCL_CS1:{
    label:"QLCL — Cơ sở 1",
    fields:[
      {key:"MA_TIEUCHI",label:"Mã tiêu chí (VD: C9.1)",required:true},
      {key:"TEN_TIEUCHI",label:"Tên tiêu chí (lặp lại giống nhau cho mọi dòng cùng mã)",required:true},
      {key:"MUC",label:"Mức",required:true,type:"select",options:["Mức 1","Mức 2","Mức 3","Mức 4","Mức 5","Ghi chú"]},
      {key:"NOI_DUNG",label:"Nội dung minh chứng",required:true,type:"textarea"},
      {key:"LINK_MINHCHUNG",label:"Link minh chứng (Google Drive...)"}
    ]
  },
  QLCL_CS2:{
    label:"QLCL — Cơ sở 2",
    fields:[
      {key:"MA_TIEUCHI",label:"Mã tiêu chí (VD: C9.1)",required:true},
      {key:"TEN_TIEUCHI",label:"Tên tiêu chí (lặp lại giống nhau cho mọi dòng cùng mã)",required:true},
      {key:"MUC",label:"Mức",required:true,type:"select",options:["Mức 1","Mức 2","Mức 3","Mức 4","Mức 5","Ghi chú"]},
      {key:"NOI_DUNG",label:"Nội dung minh chứng",required:true,type:"textarea"},
      {key:"LINK_MINHCHUNG",label:"Link minh chứng (Google Drive...)"}
    ]
  }
};

