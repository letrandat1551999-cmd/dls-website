/* ===== admin.js =====
   Quản trị dữ liệu: đăng nhập + thêm/sửa/xoá dữ liệu 4 tab THUOC/HOATCHAT/
   ICD/TUONGTAC ngay trên trang, thông qua Apps Script Web App (ADMIN_SCRIPT_URL,
   ADMIN_TAB_SCHEMAS khai báo trong config.js). Tách riêng vì đây là phần duy
   nhất có thao tác ghi/xoá dữ liệu thật — dễ soát lại độc lập với phần tra cứu
   chỉ-đọc. */

let adminToken=localStorage.getItem("dls_admin_token")||"";
let adminName=localStorage.getItem("dls_admin_name")||"";
let adminActiveTab="THUOC";
let adminEditingRow=null; // số dòng đang sửa, null = đang thêm mới
let adminEditingValues=null; // toàn bộ giá trị gốc của dòng đang sửa (để giữ nguyên mã bài viết cũ khi Lưu)

async function adminApiCall(action,payload){
  if(!ADMIN_SCRIPT_URL || ADMIN_SCRIPT_URL==="PASTE_ADMIN_APPS_SCRIPT_URL_HERE"){
    throw new Error("Chưa cấu hình ADMIN_SCRIPT_URL trong config.js. Xem hướng dẫn trong AdminApi_CodeGs.txt.");
  }
  let res;
  try{
    res=await fetch(ADMIN_SCRIPT_URL,{
      method:"POST",
      // Dùng text/plain để trình duyệt không gửi preflight OPTIONS (tránh lỗi CORS với Apps Script Web App).
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(Object.assign({action,token:adminToken},payload||{}))
    });
  }catch(err){
    // fetch() tự throw: đúng nghĩa lỗi mạng/CORS (mất mạng, sai domain, bị chặn...), khác với lỗi ở dưới.
    throw new Error("Không kết nối được tới máy chủ quản trị (lỗi mạng/CORS) — kiểm tra Internet và ADMIN_SCRIPT_URL trong config.js.");
  }
  if(!res.ok) throw new Error("Máy chủ quản trị phản hồi lỗi HTTP "+res.status+" — kiểm tra lại Deploy của Apps Script.");
  let data;
  try{
    data=await res.json();
  }catch(err){
    // fetch thành công (có phản hồi) nhưng nội dung không phải JSON hợp lệ — thường do Apps Script
    // chưa Deploy đúng quyền truy cập, hoặc URL trỏ nhầm sang 1 trang khác không phải Web App JSON.
    throw new Error("Máy chủ trả về dữ liệu không đúng định dạng JSON — kiểm tra lại Deploy của Apps Script (Who has access: Anyone) hoặc thử mở thẳng ADMIN_SCRIPT_URL trên trình duyệt để xem phản hồi thật.");
  }
  if(!data.ok){
    if(data.error==="PHIEN_HET_HAN" || data.error==="CHUA_DANG_NHAP") adminForceLogout("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    throw new Error(data.error||"Lỗi không xác định");
  }
  return data;
}

function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(",")[1]);
    reader.onerror=()=>reject(new Error("Không đọc được file đã chọn."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement_(file){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>resolve({img,url});
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error("Không đọc được ảnh.")); };
    img.src=url;
  });
}

/** Tự giảm kích thước + nén ảnh ngay trên trình duyệt trước khi tải lên Drive — đỡ tốn dung lượng
    Drive về lâu dài mà không cần dược sĩ tự làm gì thêm. Giảm chiều lớn nhất về tối đa 1600px (đủ
    nét để xem trên web, ảnh gốc từ điện thoại/máy scan thường lớn hơn nhiều so với mức cần thiết)
    và nén lại ~82% chất lượng. Bỏ qua GIF (tránh mất hoạt ảnh) và SVG (ảnh vector, đã nhỏ sẵn).
    Nếu đọc ảnh lỗi hoặc nén ra lại to hơn bản gốc (hiếm) thì tự dùng lại file gốc, không chặn việc
    đăng bài vì lỗi nén ảnh. */
async function optimizeImageForUpload_(file,maxDim=1600,quality=0.82){
  if(/image\/(gif|svg\+xml)/i.test(file.type)) return file;
  let loaded;
  try{ loaded=await loadImageElement_(file); }
  catch(err){ console.error(err); return file; }
  try{
    const {img,url}=loaded;
    const scale=Math.min(1, maxDim/Math.max(img.naturalWidth,img.naturalHeight));
    const outW=Math.max(1,Math.round(img.naturalWidth*scale));
    const outH=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement("canvas");
    canvas.width=outW; canvas.height=outH;
    canvas.getContext("2d").drawImage(img,0,0,outW,outH);
    URL.revokeObjectURL(url);
    const outType=file.type==="image/png" ? "image/png" : "image/jpeg";
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,outType,quality));
    if(!blob) return file;
    return blob.size<file.size ? blob : file; // nén ra to hơn gốc thì thôi, giữ nguyên bản gốc
  }catch(err){
    console.error(err);
    return file;
  }
}

/** Gửi ảnh lên Apps Script để lưu vào 1 thư mục Google Drive riêng và trả về URL xem trực tiếp
    (dùng làm src cho <img>) — tự nén/giảm kích thước qua optimizeImageForUpload_() trước khi gửi.
    Yêu cầu Apps Script có thêm action "uploadImage" — xem hướng dẫn/mã nguồn trong README.md. */
async function adminUploadImage(file){
  const optimized=await optimizeImageForUpload_(file);
  const base64=await fileToBase64(optimized);
  const isPng=optimized.type==="image/png";
  const filename=(file.name||"anh").replace(/\.[a-z0-9]+$/i,"")+(isPng?".png":".jpg");
  const data=await adminApiCall("uploadImage",{filename,mimeType:optimized.type||"image/jpeg",base64});
  if(!data.url) throw new Error("Máy chủ không trả về URL ảnh.");
  return data.url;
}

function restoreAdminSession(){
  if(adminToken && adminName) adminShowWorkspace();
}

async function adminLogin(){
  const pw=$("adminPassword").value.trim();
  const msg=$("adminLoginMsg");
  msg.textContent="";
  if(!pw){msg.textContent="Nhập mật khẩu trước đã.";return}
  if(!ADMIN_SCRIPT_URL || ADMIN_SCRIPT_URL==="PASTE_ADMIN_APPS_SCRIPT_URL_HERE"){
    msg.textContent="Chưa cấu hình ADMIN_SCRIPT_URL trong config.js.";
    return;
  }

  let res;
  try{
    res=await fetch(ADMIN_SCRIPT_URL,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"login",password:pw})
    });
  }catch(err){
    // fetch() tự throw = lỗi mạng/CORS thật sự (mất mạng, domain sai, bị trình duyệt/extension chặn...)
    console.error(err);
    msg.textContent="Không kết nối được tới máy chủ quản trị (lỗi mạng/CORS). Kiểm tra: có Internet không, ADMIN_SCRIPT_URL trong config.js có đúng không, mở tab Network trong F12 xem request có bị chặn không.";
    return;
  }

  if(!res.ok){
    msg.textContent="Máy chủ quản trị phản hồi lỗi HTTP "+res.status+". Kiểm tra lại Deploy của Apps Script (Execute as: Me, Who has access: Anyone).";
    return;
  }

  let data;
  try{
    data=await res.json();
  }catch(err){
    // Có phản hồi nhưng không phải JSON — khác hẳn lỗi mạng, thường do Deploy sai quyền hoặc URL cũ/sai.
    console.error(err);
    msg.textContent="Máy chủ trả về dữ liệu không đúng định dạng — thường do Apps Script chưa Deploy đúng quyền (Who has access: Anyone) hoặc URL đã cũ. Thử mở thẳng ADMIN_SCRIPT_URL trên trình duyệt để xem phản hồi thật.";
    return;
  }

  if(!data.ok){
    msg.textContent=data.error==="SAI_MAT_KHAU"?"Sai mật khẩu.":data.error==="TAM_KHOA_DANG_NHAP"?"Sai quá nhiều lần, tạm khoá đăng nhập 15 phút để chống dò mật khẩu.":("Lỗi: "+data.error);
    return;
  }

  adminToken=data.token;
  adminName=data.name;
  localStorage.setItem("dls_admin_token",adminToken);
  localStorage.setItem("dls_admin_name",adminName);
  $("adminPassword").value="";
  adminShowWorkspace();
  const reportFrame=$("reportFrame"); // vừa đăng nhập -> mở khoá luôn "Báo cáo thuốc ngoại trú", khỏi phải bấm lại
  if(reportFrame && !reportFrame.src) reportFrame.src=APP_URLS.report;
  toast("Đăng nhập thành công, chào "+adminName+".");
}

function adminLogout(){
  // Thu hồi token ở server ngay lập tức (không chờ, không chặn luồng đăng xuất nếu lỗi mạng —
  // token vẫn tự hết hạn theo TOKEN_TTL_SECONDS dù bước này thất bại).
  if(adminToken){
    fetch(ADMIN_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"logout",token:adminToken})}).catch(()=>{});
  }
  adminToken="";adminName="";
  localStorage.removeItem("dls_admin_token");
  localStorage.removeItem("dls_admin_name");
  $("adminWorkspace").style.display="none";
  $("adminLoginCard").style.display="block";
}

function adminForceLogout(message){
  adminLogout();
  if(message) toast(message);
}

function adminShowWorkspace(){
  $("adminLoginCard").style.display="none";
  $("adminWorkspace").style.display="block";
  $("adminGreeting").textContent="Xin chào, "+adminName+" 👋";
  adminSelectTab(adminActiveTab);
}

function renderAdminTabs(){
  const container=$("adminTabs");
  if(!container) return;
  container.innerHTML=Object.keys(ADMIN_TAB_SCHEMAS).map((key,i)=>`
    <button class="appTab${key===adminActiveTab?" active":""}" type="button" data-admin-tab="${key}" onclick="adminSelectTab('${key}')">
      <span>0${i+1}</span><b>${ADMIN_TAB_SCHEMAS[key].label}</b><small>Tab: ${key}</small>
    </button>
  `).join("");
}

function adminSelectTab(key){
  adminActiveTab=key;
  document.querySelectorAll("[data-admin-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.adminTab===key));
  $("adminTabHint").textContent=`Đang thao tác trên tab ${key} (${ADMIN_TAB_SCHEMAS[key].label}).`;
  $("adminResults").innerHTML="";
  $("adminSearchKeyword").value="";
  adminResetForm();
  renderAdminExtraActions();
  if(adminToken) adminSearch();
}

/** Khu nút hành động riêng theo từng tab — hiện tại chỉ có "Đồng bộ tin tức ngay" cho tab
    TIN_CANHGIACDUOC (thay vì chờ Apps Script tự kiểm tra theo lịch đã đặt). */
function renderAdminExtraActions(){
  const box=$("adminExtraActions");
  if(!box) return;
  if(adminActiveTab==="TIN_CANHGIACDUOC"){
    box.innerHTML=`<div class="formActions" style="margin:0 0 16px">
      <button type="button" onclick="adminSyncNews(this)">🔄 Đồng bộ tin tức ngay</button>
    </div>`;
  }else{
    box.innerHTML="";
  }
}

/** Gọi Apps Script kiểm tra ngay lập tức xem canhgiacduoc.org.vn có bài mới không (thay vì chờ tới
    lịch tự động đã đặt) — dùng khi cần thấy tin mới ngay để test, hoặc muốn cập nhật gấp. */
async function adminSyncNews(btn){
  if(btn){ btn.disabled=true; btn.textContent="Đang đồng bộ…"; }
  try{
    const data=await adminApiCall("syncNews",{});
    console.log("Chi tiết đồng bộ tin:",data.debug);
    toast(`Thêm ${data.added||0} tin mới (TN: ${data.addedTrongNuoc||0}, NN: ${data.addedNuocNgoai||0}). Xem chi tiết trong Console (F12).`);
    adminSearch();
  }catch(err){
    console.error(err);
    toast("Lỗi đồng bộ: "+err.message);
  }finally{
    if(btn){ btn.disabled=false; btn.textContent="🔄 Đồng bộ tin tức ngay"; }
  }
}

async function adminSearch(){
  const q=$("adminSearchKeyword").value.trim();
  $("adminResults").innerHTML=`<div class="resultItem"><b>Đang tìm…</b></div>`;
  try{
    const data=await adminApiCall("search",{sheet:adminActiveTab,q});
    renderAdminResults(data.rows||[]);
  }catch(err){
    console.error(err);
    $("adminResults").innerHTML=`<div class="resultItem"><b>Lỗi tìm kiếm</b><small>${err.message}</small></div>`;
  }
}

function renderAdminResults(rows){
  const schema=ADMIN_TAB_SCHEMAS[adminActiveTab];
  const container=$("adminResults");
  if(!rows.length){
    container.innerHTML=`<div class="resultItem"><b>Không có dữ liệu</b><small>Thử từ khoá khác.</small></div>`;
    return;
  }
  container.innerHTML=rows.map(r=>{
    const v=r.values;
    const title=v[0]||"(trống)";
    const sub=v[1]||"";
    return `<article class="resultItem">
      <b>${escapeHtml(title)}</b>
      <small>${escapeHtml(sub)}</small>
      <div class="tagRow">
        <span class="tag link" onclick='adminEditRow(${r.row},${JSON.stringify(v).replace(/'/g,"&#39;")})'>Sửa</span>
        <span class="tag danger link" onclick="adminConfirmDelete(${r.row},${JSON.stringify(String(title)).replace(/'/g,"&#39;")})">Xoá</span>
      </div>
    </article>`;
  }).join("");
}

function adminBuildForm(values){
  const schema=ADMIN_TAB_SCHEMAS[adminActiveTab];
  const form=$("adminForm");
  form.innerHTML=schema.fields.map((f,i)=>{
    if(f.type==="slug") return ""; // mã bài viết: tự sinh khi lưu, không hiện trong form
    const isNew=!values;
    const val=(values && values[i]!==undefined)? values[i]
      : (isNew && f.type==="date"? new Date().toISOString().slice(0,10) : "");

    if(f.type==="select"){
      // options có thể là mảng chuỗi ("A") hoặc mảng {value,label} khi giá trị lưu (vd id mục)
      // khác với nhãn hiển thị (vd tên mục dễ đọc) — xem STATIC_DOC_SECTIONS trong config.js.
      return `<label>${escapeHtml(f.label)}
        <select data-field="${f.key}">
          ${f.options.map(opt=>{
            const ov=(opt && typeof opt==="object")? opt.value : opt;
            const ol=(opt && typeof opt==="object")? opt.label : opt;
            return `<option value="${escapeHtml(ov)}" ${String(ov)===String(val)?"selected":""}>${escapeHtml(ol)}</option>`;
          }).join("")}
        </select>
      </label>`;
    }
    if(f.type==="textarea"){
      return `<label style="grid-column:1/-1">${escapeHtml(f.label)}${f.required?" *":""}
        <textarea data-field="${f.key}" rows="6" placeholder="${escapeHtml(f.label)}" style="width:100%;min-height:120px;border:1px solid #cfe2df;border-radius:10px;padding:10px 12px;background:var(--surface-2);color:var(--text);font:inherit;resize:vertical">${escapeHtml(val)}</textarea>
      </label>`;
    }
    if(f.type==="date"){
      return `<label>${escapeHtml(f.label)}
        <input data-field="${f.key}" type="date" value="${escapeHtml(val)}">
      </label>`;
    }
    if(f.type==="checkbox"){
      const checked=val==="Có"||val===true||val==="TRUE"||val==="true"||val==="1";
      return `<label style="flex-direction:row;align-items:center;gap:10px;grid-column:1/-1">
        <input data-field="${f.key}" type="checkbox" style="width:18px;height:18px;min-height:0" ${checked?"checked":""}>
        ${escapeHtml(f.label)}
      </label>`;
    }
    if(f.type==="linkpicker"){
      const isCustom=!!val && !PAGE_LINK_OPTIONS.some(o=>o.value===val);
      return `<label>${escapeHtml(f.label)}
        <select onchange="adminLinkPickerChange(this)">
          ${PAGE_LINK_OPTIONS.map(o=>`<option value="${escapeHtml(o.value)}" ${(o.value===val)||(o.value==="__custom__"&&isCustom)?"selected":""}>${escapeHtml(o.label)}</option>`).join("")}
        </select>
        <input type="text" class="linkPickerCustom" value="${escapeHtml(isCustom?val:"")}" placeholder="Dán URL đầy đủ ở đây (VD: https://...)" oninput="adminLinkPickerCustomInput(this)" style="margin-top:8px;${isCustom?"":"display:none"}">
        <input data-field="${f.key}" type="hidden" value="${escapeHtml(val)}">
      </label>`;
    }
    if(f.type==="image"){
      // Ô text giữ URL ảnh + nút "Tải ảnh lên" đẩy file trực tiếp lên Drive qua adminUploadImage().
      // Vẫn có thể dán tay 1 URL ảnh có sẵn nếu không muốn tải file mới.
      return `<label style="grid-column:1/-1">${escapeHtml(f.label)}
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input data-field="${f.key}" type="text" value="${escapeHtml(val)}" placeholder="URL ảnh, hoặc bấm Tải ảnh lên" style="flex:1;min-width:220px">
          <button type="button" onclick="adminPickImage(this)">Tải ảnh lên</button>
        </div>
        <div class="imgPreviewRow">${val?`<img src="${escapeHtml(val)}" alt="">`:""}</div>
      </label>`;
    }
    if(f.type==="richtext"){
      return `<label style="grid-column:1/-1">${escapeHtml(f.label)}
        <div class="richToolbar">
          <button type="button" title="Đậm" onclick="richExec('bold')"><b>B</b></button>
          <button type="button" title="Nghiêng" onclick="richExec('italic')"><i>I</i></button>
          <button type="button" title="Gạch chân" onclick="richExec('underline')"><u>U</u></button>
          <button type="button" title="Tiêu đề" onclick="richExec('formatBlock','H3')">Tiêu đề</button>
          <button type="button" title="Đoạn văn thường" onclick="richExec('formatBlock','P')">Đoạn văn</button>
          <button type="button" title="Danh sách" onclick="richExec('insertUnorderedList')">• Danh sách</button>
          <button type="button" title="Chèn ảnh" onclick="richInsertImage()">🖼 Chèn ảnh</button>
          <button type="button" title="Chèn bảng" onclick="richInsertTable()">📊 Chèn bảng</button>
          <button type="button" title="Gắn link cho đoạn chữ đang bôi đen" onclick="richInsertLink()">🔗 Chèn link</button>
          <button type="button" title="Bỏ link khỏi đoạn chữ đang bôi đen" onclick="richExec('unlink')">Bỏ link</button>
          <button type="button" title="Xoá định dạng" onclick="richExec('removeFormat')">Xoá định dạng</button>
        </div>
        <div class="richEditable" contenteditable="true" data-field="${f.key}" onfocus="richActiveEditable=this">${val||""}</div>
      </label>`;
    }
    return `<label>${escapeHtml(f.label)}${f.required?" *":""}
      <input data-field="${f.key}" type="text" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.label)}">
    </label>`;
  }).join("");
}

/** Đổi lựa chọn ở khung "Nút bên dưới dẫn tới đâu": nếu chọn 1 trang có sẵn thì lấy đúng mã trang
    làm giá trị lưu; chọn "Link khác" thì hiện thêm ô dán URL và dùng giá trị ô đó. Đồng thời tự gợi
    ý luôn Nhãn nút nếu ô đó đang để trống, đỡ phải tự nghĩ chữ (vẫn sửa lại được bình thường). */
function adminLinkPickerChange(selectEl){
  const wrapper=selectEl.parentElement;
  const customInput=wrapper.querySelector(".linkPickerCustom");
  const hiddenInput=wrapper.querySelector("[data-field]");
  const opt=PAGE_LINK_OPTIONS.find(o=>o.value===selectEl.value);
  if(selectEl.value==="__custom__"){
    customInput.style.display="block";
    hiddenInput.value=customInput.value.trim();
  }else{
    customInput.style.display="none";
    hiddenInput.value=selectEl.value;
  }
  const labelInput=$("adminForm")?.querySelector('[data-field="LINK_NHAN"]');
  if(labelInput && !labelInput.value.trim() && opt && opt.defaultLabel) labelInput.value=opt.defaultLabel;
}

/** Gõ tay URL vào ô "Link khác" (chỉ hiện khi chọn "Link khác" ở trên) → đồng bộ vào ô ẩn thật sự
    được lưu (ô data-field mà adminSaveRow() đọc giá trị). */
function adminLinkPickerCustomInput(inputEl){
  const hiddenInput=inputEl.parentElement.querySelector("[data-field]");
  if(hiddenInput) hiddenInput.value=inputEl.value.trim();
}

/* ---- Trình soạn thảo có thanh công cụ (contenteditable + execCommand) ----
   Đơn giản, đủ dùng cho soạn nội dung tài liệu/bài viết nội bộ: Đậm/Nghiêng/Gạch chân/
   Tiêu đề/Danh sách/Chèn ảnh. Nội dung luôn được lọc qua sanitizeRichHtml() (core.js)
   trước khi lưu, đề phòng dán mã lạ từ nơi khác vào. */
let richActiveEditable=null;
function richGetEditable(){
  if(richActiveEditable && document.body.contains(richActiveEditable)) return richActiveEditable;
  return $("adminForm")?.querySelector(".richEditable")||null;
}
function richExec(cmd,val){
  const el=richGetEditable();
  if(!el) return;
  el.focus();
  document.execCommand(cmd,false,val||null);
}
function richInsertImage(){
  const el=richGetEditable();
  if(!el){ toast("Bấm vào khung nội dung trước khi chèn ảnh."); return; }
  const input=document.createElement("input");
  input.type="file"; input.accept="image/*";
  input.onchange=async()=>{
    const file=input.files[0];
    if(!file) return;
    if(file.size>15*1024*1024){ toast("Ảnh gốc tối đa 15MB (hệ thống tự nén nhỏ lại trước khi tải lên, chỉ chặn file quá khổ)."); return; }
    toast("Đang nén & tải ảnh lên…");
    try{
      const url=await adminUploadImage(file);
      el.focus();
      document.execCommand("insertImage",false,url);
    }catch(err){
      console.error(err);
      toast("Lỗi tải ảnh: "+err.message);
    }
  };
  input.click();
}

/** Chèn 1 khung bảng vào đúng vị trí con trỏ đang đứng trong khung soạn thảo. Chỉ tạo khung
    (hàng tiêu đề + các ô trống) — bấm vào từng ô để gõ nội dung như bảng bình thường. Không hỗ
    trợ gộp ô (colspan/rowspan) để giữ đơn giản: nếu cần 1 cột kiểu "Mức 1/Mức 2" áp dụng cho
    nhiều hàng như ảnh mẫu, cách dễ nhất là lặp lại đúng chữ đó ở mỗi hàng thuộc mức đó. */
function richInsertTable(){
  const el=richGetEditable();
  if(!el){ toast("Bấm vào khung nội dung trước khi chèn bảng."); return; }
  const rowsStr=window.prompt("Số hàng dữ liệu (không tính hàng tiêu đề):","3");
  if(rowsStr===null) return;
  const colsStr=window.prompt("Số cột:","3");
  if(colsStr===null) return;
  const rows=Math.max(1,Math.min(40,parseInt(rowsStr,10)||3));
  const cols=Math.max(1,Math.min(8,parseInt(colsStr,10)||3));

  let html="<table><tbody><tr>";
  for(let c=0;c<cols;c++) html+=`<th>Cột ${c+1}</th>`;
  html+="</tr>";
  for(let r=0;r<rows;r++){
    html+="<tr>";
    for(let c=0;c<cols;c++) html+="<td>&nbsp;</td>";
    html+="</tr>";
  }
  html+="</tbody></table><p><br></p>";

  el.focus();
  document.execCommand("insertHTML",false,html);
}

/** Gắn link cho đoạn chữ đang bôi đen trong khung soạn thảo — dùng để gắn NHIỀU link rải rác
    trong bài (khác với ô "Nút bên dưới dẫn tới đâu" ở form, đó chỉ là 1 nút to duy nhất ở cuối bài).
    Link ngoài (http...) tự mở tab mới; link nội bộ trong web (VD #tools) mở ngay trong trang hiện tại. */
function richInsertLink(){
  const el=richGetEditable();
  if(!el){ toast("Bấm vào khung nội dung trước."); return; }
  const sel=window.getSelection();
  if(!sel || sel.isCollapsed || !el.contains(sel.anchorNode)){
    toast("Bôi đen (chọn) đoạn chữ muốn gắn link trước, rồi mới bấm Chèn link.");
    return;
  }
  const url=window.prompt("Dán URL cần gắn (VD: https://... hoặc #tools để trỏ về 1 trang trong web):","https://");
  if(!url) return;
  el.focus();
  document.execCommand("createLink",false,url);
  // execCommand không tự set target/rel — tìm đúng thẻ <a> vừa tạo quanh vị trí con trỏ để gán thêm.
  let node=window.getSelection().anchorNode;
  while(node && node!==el){
    if(node.nodeType===1 && node.tagName==="A"){
      if(/^https?:\/\//i.test(url)){ node.setAttribute("target","_blank"); node.setAttribute("rel","noopener noreferrer"); }
      else { node.removeAttribute("target"); node.removeAttribute("rel"); }
      break;
    }
    node=node.parentNode;
  }
}

/** Nút "Tải ảnh lên" cạnh ô URL của field type="image" (ảnh đại diện, không phải ảnh chèn trong nội dung). */
function adminPickImage(buttonEl){
  const label=buttonEl.closest("label");
  const targetInput=label?.querySelector("[data-field]");
  const previewRow=label?.querySelector(".imgPreviewRow");
  const input=document.createElement("input");
  input.type="file"; input.accept="image/*";
  input.onchange=async()=>{
    const file=input.files[0];
    if(!file || !targetInput) return;
    if(file.size>15*1024*1024){ toast("Ảnh gốc tối đa 15MB (hệ thống tự nén nhỏ lại trước khi tải lên, chỉ chặn file quá khổ)."); return; }
    buttonEl.disabled=true; buttonEl.textContent="Đang nén…";
    try{
      const url=await adminUploadImage(file);
      targetInput.value=url;
      if(previewRow) previewRow.innerHTML=`<img src="${escapeHtml(url)}" alt="">`;
      toast("Đã tải ảnh lên.");
    }catch(err){
      console.error(err);
      toast("Lỗi tải ảnh: "+err.message);
    }finally{
      buttonEl.disabled=false; buttonEl.textContent="Tải ảnh lên";
    }
  };
  input.click();
}

function adminResetForm(){
  adminEditingRow=null;
  adminEditingValues=null;
  $("adminFormTitle").textContent="Thêm dòng mới";
  $("adminDeleteBtn").style.display="none";
  $("adminFormMsg").textContent="";
  adminBuildForm(null);
}

function adminEditRow(row,values){
  adminEditingRow=row;
  adminEditingValues=values;
  $("adminFormTitle").textContent="Sửa dòng #"+row;
  $("adminDeleteBtn").style.display="inline-flex";
  $("adminFormMsg").textContent="";
  adminBuildForm(values);
  $("adminForm").scrollIntoView({behavior:"smooth",block:"center"});
}

async function adminSaveRow(){
  const schema=ADMIN_TAB_SCHEMAS[adminActiveTab];
  const inputs=$("adminForm").querySelectorAll("[data-field]");
  const titleFieldIndex=schema.fields.findIndex(f=>f.key==="TIEU_DE");
  const values=schema.fields.map((f,i)=>{
    if(f.type==="slug"){
      const existing=adminEditingValues && adminEditingValues[i] ? String(adminEditingValues[i]).trim() : "";
      if(existing) return existing; // đang sửa bài đã có mã -> giữ nguyên, không đổi link cũ
      const titleVal=(Array.from(inputs).find(x=>x.dataset.field===schema.fields[titleFieldIndex]?.key)||{}).value || "";
      return slugify(titleVal)+"-"+Date.now().toString(36); // bài mới, hoặc bài cũ chưa có mã -> tự cấp mã mới
    }
    const el=Array.from(inputs).find(i2=>i2.dataset.field===f.key);
    if(!el) return "";
    if(f.type==="richtext") return sanitizeRichHtml(el.innerHTML).trim();
    if(f.type==="checkbox") return el.checked ? "Có" : "";
    return el.value.trim();
  });
  const missing=schema.fields.find((f,i)=>f.required && !values[i]);
  if(missing){$("adminFormMsg").textContent="Thiếu trường bắt buộc: "+missing.label;$("adminFormMsg").style.color="#b42318";return}
  $("adminFormMsg").textContent="Đang lưu…";$("adminFormMsg").style.color="var(--muted)";
  try{
    const data=await adminApiCall("upsert",{sheet:adminActiveTab,row:adminEditingRow,values});
    toast(adminEditingRow?"Đã lưu thay đổi.":"Đã thêm dòng mới.");
    adminResetForm();
    adminSearch();
  }catch(err){
    console.error(err);
    $("adminFormMsg").textContent="Lỗi: "+err.message;
    $("adminFormMsg").style.color="#b42318";
  }
}

function adminConfirmDelete(row,title){
  if(!confirm(`Xoá dòng “${title}” (dòng #${row})? Không thể hoàn tác.`)) return;
  adminDeleteRowByNumber(row);
}

async function adminDeleteRow(){
  if(!adminEditingRow) return;
  const title=$("adminForm").querySelector("[data-field]")?.value||"";
  if(!confirm(`Xoá dòng “${title}” (dòng #${adminEditingRow})? Không thể hoàn tác.`)) return;
  adminDeleteRowByNumber(adminEditingRow);
}

async function adminDeleteRowByNumber(row){
  try{
    await adminApiCall("delete",{sheet:adminActiveTab,row});
    toast("Đã xoá dòng #"+row+".");
    if(adminEditingRow===row) adminResetForm();
    adminSearch();
  }catch(err){
    console.error(err);
    toast("Lỗi khi xoá: "+err.message);
  }

}
