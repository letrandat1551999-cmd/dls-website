/* ===== core.js =====
   Tiện ích DOM dùng chung ($, escapeHtml, numberValue, toast) và điều hướng
   app-shell (showPage/route, switchApp cho 3 app nhúng iframe). Mọi module
   khác đều có thể gọi các hàm ở đây; file này load trước các module tính
   năng (calculators/lookup/antibiotic/docs/admin). */

function $(id){return document.getElementById(id)}
function escapeHtml(str){
  return String(str==null?"":str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function numberValue(id){const value=parseFloat($(id)?.value);return Number.isFinite(value)?value:null}

/** Lọc HTML nội dung bài viết (soạn từ trình soạn thảo có thanh công cụ) theo danh sách thẻ/thuộc
    tính cho phép — dùng cả lúc LƯU (admin.js, trước khi gửi lên Sheet) lẫn lúc HIỂN THỊ (docs.js),
    để dù nội dung Sheet bị ai đó sửa tay dán mã lạ vào thì trang công khai vẫn không chạy được.
    Không dùng escapeHtml ở đây vì nội dung này CỐ Ý cho phép định dạng (in đậm, ảnh...), khác với
    mọi chỗ khác trong trang luôn escape tuyệt đối dữ liệu từ Sheet. */
const RICHTEXT_ALLOWED_TAGS=new Set(["P","BR","B","STRONG","I","EM","U","H3","H4","UL","OL","LI","A","IMG","BLOCKQUOTE","DIV","SPAN","TABLE","THEAD","TBODY","TR","TD","TH"]);
const RICHTEXT_ALLOWED_ATTR={A:["href","target","rel"],IMG:["src","alt"]};
function sanitizeRichHtml(html){
  const container=document.createElement("div");
  container.innerHTML=String(html||"");
  const walk=(node)=>{
    [...node.childNodes].forEach(child=>{
      if(child.nodeType===3) return; // text node — giữ nguyên
      if(child.nodeType!==1){ child.remove(); return; }
      if(!RICHTEXT_ALLOWED_TAGS.has(child.tagName)){
        // Thẻ không cho phép (vd script/style/iframe) → bỏ thẻ nhưng giữ lại nội dung con dạng text
        child.replaceWith(...child.childNodes);
        return;
      }
      [...child.attributes].forEach(attr=>{
        const allowed=RICHTEXT_ALLOWED_ATTR[child.tagName]||[];
        const isBadUrl=/^\s*javascript:/i.test(attr.value);
        if(!allowed.includes(attr.name) || isBadUrl) child.removeAttribute(attr.name);
      });
      if(child.tagName==="A") child.setAttribute("rel","noopener noreferrer");
      walk(child);
    });
  };
  walk(container);
  return container.innerHTML;
}
function toggleMenu(){$("nav").classList.toggle("open")}
function toast(message){
  const element=$("toast");
  element.textContent=message;
  element.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>element.classList.remove("show"),2600);
}

/** Tạo 1 mã ngắn, không dấu, không khoảng trắng từ tiêu đề — dùng làm "địa chỉ" cố định của 1 bài
    viết (VD "#baiviet-huong-dan-dung-khang-sinh-m3f2k1"). Luôn có thêm chuỗi ngẫu nhiên phía sau
    nên dù 2 bài trùng hệt tiêu đề vẫn ra 2 mã khác nhau, không đè lên nhau. */
function slugify(text){
  const base=stripDiacritics(String(text||"bai-viet"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/(^-+|-+$)/g,"")
    .slice(0,60) || "bai-viet";
  return base;
}

/** Bọc mọi bảng (<table>) bên trong 1 khung nội dung vào 1 div cuộn ngang riêng — để bảng nhiều
    cột không đẩy tràn layout trên màn hình nhỏ, chỉ cuộn trong phạm vi bảng đó. Gọi hàm này ngay
    sau khi gán innerHTML có thể chứa bảng (docs.js). */
function wrapContentTables(container){
  if(!container) return;
  container.querySelectorAll("table").forEach(table=>{
    if(table.parentElement.classList.contains("tableScroll")) return;
    const wrap=document.createElement("div");
    wrap.className="tableScroll";
    table.parentNode.insertBefore(wrap,table);
    wrap.appendChild(table);
  });
}

/** Ảnh tải lên qua Quản trị được lưu RIÊNG TƯ trên Drive (không bật "Anyone with the link" —
    tài khoản cá nhân bị Google từ chối thao tác này), nên <img src> không thể trỏ thẳng vào Drive
    được nữa. Thay vào đó src lưu dạng "ADMIN_SCRIPT_URL?img=<fileId>" — một tham chiếu tới Admin
    API, không phải ảnh thật. Hàm resolveApiImages() bên dưới quét 1 khối DOM vừa render, lấy ảnh
    thật về và ghép lại thành data: URI cho từng ảnh loại này. Gọi ngay sau khi gán innerHTML có
    thể chứa loại ảnh này.
    Lưu ý: giữ lại URL gốc ở data-api-ref trước khi thay src — nơi LƯU nội dung richtext (admin.js
    adminSaveRow) sẽ khôi phục lại đúng URL gốc này trước khi ghi vào Sheet, tránh lưu nhầm data:
    URI khổng lồ (vỡ giới hạn 50.000 ký tự/ô của Google Sheets).

    TỐI ƯU TỐC ĐỘ (so với bản trước gọi 1 request/1 ảnh, rất chậm vì mỗi lần gọi Apps Script có độ
    trễ khởi động riêng):
      1) Cache 2 lớp — Map trong bộ nhớ (dùng lại ngay trong cùng 1 lượt xem trang, VD cùng 1 ảnh
         xuất hiện ở nhiều khối) + IndexedDB (sống qua các lần tải lại trang/quay lại trang; ảnh
         trên Drive gần như không đổi sau khi đăng nên cache dài hạn là an toàn).
      2) Gộp nhiều ảnh còn thiếu (chưa có trong cache) thành 1 (hoặc vài, nếu quá nhiều) request
         DUY NHẤT lên Apps Script (action "getImages"), thay vì 1 request riêng cho từng ảnh. */

const API_IMG_BATCH_SIZE=12; // mỗi request "getImages" gộp tối đa từng này ảnh — đủ nhanh, không quá tải Apps Script
const apiImageMemCache=new Map(); // fileId -> data URI, sống trong lúc mở trang

function apiImageIdFromRef(ref){
  try{ return new URL(ref, location.href).searchParams.get("img"); }
  catch(err){ return null; }
}

const IMG_IDB_NAME="dls_img_cache", IMG_IDB_STORE="images";
function imgIdbOpen(){
  return new Promise((resolve,reject)=>{
    if(!("indexedDB" in window)) return reject(new Error("no-indexeddb"));
    const req=indexedDB.open(IMG_IDB_NAME,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(IMG_IDB_STORE);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function imgIdbGet(id){
  try{
    const db=await imgIdbOpen();
    return await new Promise((resolve,reject)=>{
      const req=db.transaction(IMG_IDB_STORE,"readonly").objectStore(IMG_IDB_STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });
  }catch(err){ return null; } // trình duyệt không hỗ trợ/lỗi -> coi như không có cache, vẫn tải qua mạng bình thường
}
async function imgIdbSet(id,dataUri){
  try{
    const db=await imgIdbOpen();
    db.transaction(IMG_IDB_STORE,"readwrite").objectStore(IMG_IDB_STORE).put(dataUri,id);
  }catch(err){ /* im lặng bỏ qua nếu đầy dung lượng hoặc trình duyệt không hỗ trợ */ }
}

async function fetchApiImagesBatch(ids){
  const out={};
  for(let i=0;i<ids.length;i+=API_IMG_BATCH_SIZE){
    const chunk=ids.slice(i,i+API_IMG_BATCH_SIZE);
    try{
      const res=await fetch(ADMIN_SCRIPT_URL,{
        method:"POST",
        headers:{"Content-Type":"text/plain;charset=utf-8"}, // tránh preflight OPTIONS, giống adminApiCall()
        body:JSON.stringify({action:"getImages",ids:chunk})
      });
      const data=await res.json();
      if(data.ok && data.images) Object.assign(out,data.images);
    }catch(err){
      console.error(err);
    }
  }
  return out;
}

async function resolveApiImages(container){
  if(!container || typeof ADMIN_SCRIPT_URL==="undefined" || !ADMIN_SCRIPT_URL) return;
  const imgs=[...container.querySelectorAll("img")].filter(img=>{
    const src=img.getAttribute("src")||"";
    return src.indexOf(ADMIN_SCRIPT_URL)===0 && !img.dataset.apiRef;
  });
  if(!imgs.length) return;

  const needIds=new Set();
  await Promise.all(imgs.map(async img=>{
    const ref=img.getAttribute("src");
    img.dataset.apiRef=ref; // lưu lại URL gốc trước khi đổi src, dùng khi lưu richtext (xem admin.js)
    const id=apiImageIdFromRef(ref);
    if(!id){ img.style.display="none"; return; }
    if(apiImageMemCache.has(id)){ img.src=apiImageMemCache.get(id); return; }
    const cached=await imgIdbGet(id);
    if(cached){ apiImageMemCache.set(id,cached); img.src=cached; return; }
    needIds.add(id);
  }));

  if(!needIds.size) return;
  const ids=[...needIds];
  const fetched=await fetchApiImagesBatch(ids);
  ids.forEach(id=>{
    const item=fetched[id];
    if(item && item.ok && item.base64){
      const dataUri=`data:${item.mimeType||"image/jpeg"};base64,${item.base64}`;
      apiImageMemCache.set(id,dataUri);
      imgIdbSet(id,dataUri);
    }
  });
  imgs.forEach(img=>{
    const id=apiImageIdFromRef(img.dataset.apiRef);
    if(id && apiImageMemCache.has(id)) img.src=apiImageMemCache.get(id);
    else if(id && needIds.has(id)) img.style.display="none";
  });
}

function showPage(name,updateHash=true){
  document.querySelectorAll(".page").forEach(page=>page.classList.remove("active"));
  const page=$("page-"+name);
  if(page) page.classList.add("active");
  document.querySelectorAll("[data-page]").forEach(item=>item.classList.toggle("active",item.dataset.page===name));
  $("nav").classList.remove("open");
  if(updateHash) history.replaceState(null,"","#"+name);
  window.scrollTo({top:0,behavior:"smooth"});
  if(name==="search") loadSearchIndex();
  if(name==="antibiotic") loadAntibioticData();
  if(name==="docs"){ loadStaticDocs(); loadPosts(); }
  if(name==="adr") loadAdrPage();
  if(name==="phacdo") loadPhacDoData();
  if(name==="qlcl") loadQlclData();
}

function switchApp(name,params={}){
  if(RESTRICTED_APPS.includes(name) && !adminToken){
    toast(`"${APP_LABELS[name]}" chỉ dành cho dược sĩ đã đăng nhập Quản trị — vui lòng đăng nhập trước.`);
    showPage("admin");
    return;
  }
  showPage("apps");
  document.querySelectorAll(".appTab").forEach(button=>button.classList.toggle("active",button.dataset.app===name));
  document.querySelectorAll(".appPanel").forEach(panel=>panel.classList.toggle("active",panel.id==="panel-"+name));
  const frame=$(name+"Frame");
  if(!frame) return;
  const effectiveParams=name==="renal" && pendingRenalData && !Object.keys(params).length ? pendingRenalData : params;
  const url=buildAppUrl(name,effectiveParams);
  if(params.forceReload || !frame.src || Object.keys(effectiveParams).length) frame.src=url;
  if(name==="renal" && pendingRenalData) setTimeout(()=>postRenalData(pendingRenalData),500);
}

function buildAppUrl(name,params={}){
  const url=new URL(APP_URLS[name]);
  Object.entries(params).forEach(([key,value])=>{
    if(value!==undefined && value!==null && value!=="" && key!=="forceReload") url.searchParams.set(key,value);
  });
  return url.toString();
}

function reloadApp(name){
  const frame=$(name+"Frame");
  if(frame){
    frame.src=buildAppUrl(name,{forceReload:true});
    toast(`Đã tải lại ${APP_LABELS[name]}.`);
  }
}

function fullscreen(id){
  const element=$(id);
  if(element?.requestFullscreen) element.requestFullscreen();
  else toast("Trình duyệt không hỗ trợ toàn màn hình.");
}

function route(){
  const raw=location.hash.replace("#","") || "home";
  // #baiviet-<mã> = trang riêng của 1 bài viết cụ thể (xem docs.js showPostDetail/renderPostDetail).
  // Dùng showPage("docs", false) để KHÔNG ghi đè hash hiện tại thành "#docs" — giữ nguyên link
  // #baiviet-... trên thanh địa chỉ để copy/dán gửi thẳng đúng bài, bấm Back cũng hoạt động đúng.
  if(raw.indexOf("baiviet-")===0){
    showPage("docs",false);
    showPostDetail(decodeURIComponent(raw.slice("baiviet-".length)));
    return;
  }
  hidePostDetail();
  const page=raw;
  const valid=["home","tools","search","antibiotic","adr","phacdo","qlcl","apps","docs","admin"];
  showPage(valid.includes(page)?page:"home");
}
