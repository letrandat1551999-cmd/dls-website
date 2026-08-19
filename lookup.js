/* ===== lookup.js =====
   Tra cứu Thuốc / Hoạt chất / ICD-10 / Tương tác — lấy trực tiếp từ Google
   Sheet dùng chung (endpoint gviz công khai, không cần Apps Script riêng).
   Sửa dữ liệu trên Sheet là web cập nhật ngay khi tải lại trang. */

let searchIndex=[];
let searchLoaded=false;
let searchLoading=false;

/** Bỏ dấu tiếng Việt để so khớp không phân biệt có/không dấu — người dùng gõ nhanh
    thường không bật dấu ("viem phoi"), trong khi dữ liệu Sheet luôn có dấu đầy đủ. */
function stripDiacritics(str){
  return String(str||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/đ/g,"d").replace(/Đ/g,"D");
}
function normalizeSearch(str){
  return stripDiacritics(str).toLowerCase();
}

async function fetchSheetTab(sheetName,fields){
  const url=`https://docs.google.com/spreadsheets/d/${SEARCH_SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}`;
  const res=await fetch(url);
  if(!res.ok) throw new Error(`Không đọc được tab ${sheetName} (HTTP ${res.status})`);
  const text=await res.text();
  const start=text.indexOf("{");
  const end=text.lastIndexOf("}");
  const json=JSON.parse(text.substring(start,end+1));
  // Đọc theo VỊ TRÍ CỘT (A,B,C...) chứ không dựa vào tên cột Google tự nhận diện,
  // để không bị lỗi khi Google Sheets đoán sai/đổi tên tiêu đề (đặc biệt với tab dữ liệu lớn như ICD).
  return (json.table.rows||[]).map(row=>{
    const item={};
    fields.forEach((field,i)=>{item[field]=row.c[i]?.v ?? ""});
    return item;
  });
}

function mapThuoc(r){
  return {
    type:"thuoc",
    title:String(r.TEN_THUOC||"").trim(),
    hoatChat:r.HOAT_CHAT||"",
    nhomTacDung:r.NHOM_TAC_DUNG||"",
    hamLuong:r.HAM_LUONG||"",
    tdkmm:r.TDKMM||"",
    // subtitle/body chỉ dùng để gộp vào phạm vi tìm kiếm (doSearch), không dùng để hiển thị —
    // hiển thị dùng renderThuocFields() với từng trường có nhãn riêng, rõ ràng hơn.
    subtitle:[r.HOAT_CHAT,r.NHOM_TAC_DUNG].filter(Boolean).join(" · "),
    body:[r.HAM_LUONG,r.TDKMM].filter(Boolean).join(" "),
    tags:[],
    link:r.LINK_TOA||"",
    linkLabel:"Xem toa"
  };
}
function mapHoatchat(r){
  return {
    type:"hoatchat",
    title:String(r.HOAT_CHAT||"").trim(),
    // Ghi rõ "Nhóm tác dụng:" thay vì để trơ tên nhóm — tránh hiểu lầm đây là 1 phần tên hoạt chất
    // (vd. gõ "tăng huyết áp" khớp vì NHOM_TAC_DUNG là "Tăng huyết áp", không phải vì đó là tên hoạt chất).
    subtitle:r.NHOM_TAC_DUNG?`Nhóm tác dụng: ${r.NHOM_TAC_DUNG}`:"",
    body:`Có ${r.SO_TEN_THUONG_MAI||0} tên thương mại tại DLS: ${r.TEN_THUONG_MAI_LIEN_QUAN||"—"}`,
    tags:[r.NHOM_TAC_DUNG].filter(Boolean)
  };
}
function mapIcd(r){
  const isGroup=String(r.LA_MA_NHOM||"").startsWith("Có");
  return {
    type:"icd",
    title:String(r.MA_ICD||"").trim(),
    subtitle:r.TEN_BENH||"",
    body:isGroup?"Đây là mã nhóm (ICD-10 3 ký tự) — không dùng để làm mã chẩn đoán chính. Hãy chọn mã 4 ký tự chi tiết hơn bên dưới.":"",
    isGroup,
    statusTag:isGroup?{text:"Loại do có mã cụ thể hơn",cls:"danger"}:{text:"Dùng được mã chính",cls:"ok"},
    tags:[]
  };
}
function mapTuongtac(r){
  return {
    type:"tuongtac",
    title:String(r.CAP_THUOC||"").trim(),
    subtitle:r.MUC_DO||"",
    body:[r.MO_TA,r.XU_TRI?`Xử trí: ${r.XU_TRI}`:""].filter(Boolean).join(" "),
    tags:[r.MUC_DO].filter(Boolean)
  };
}

function attachIcdChildren(index){
  const byParent={};
  index.forEach(item=>{
    if(item.type!=="icd" || !item.title.includes(".")) return;
    const parent=item.title.split(".")[0];
    (byParent[parent] ||= []).push(item);
  });
  index.forEach(item=>{
    if(item.type==="icd" && item.isGroup){
      item.children=(byParent[item.title]||[]).sort((a,b)=>a.title.localeCompare(b.title)).slice(0,8);
    }
  });
}

async function loadSearchIndex(){
  if(searchLoaded || searchLoading) return;
  if(!SEARCH_SHEET_ID || SEARCH_SHEET_ID==="PASTE_GOOGLE_SHEET_ID_HERE"){
    $("searchResults").innerHTML=`<div class="resultItem"><b>Chưa cấu hình nguồn dữ liệu</b><small>Dán ID Google Sheet vào biến SEARCH_SHEET_ID trong config.js (xem hướng dẫn trong README.md).</small></div>`;
    return;
  }
  searchLoading=true;
  $("searchResults").innerHTML=`<div class="resultItem"><b>Đang tải dữ liệu…</b><small>Kết nối tới Google Sheet tra cứu.</small></div>`;
  try{
    const [thuoc,hoatchat,icd,tuongtac]=await Promise.all([
      fetchSheetTab(SEARCH_TABS.thuoc,["TEN_THUOC","HOAT_CHAT","NHOM_TAC_DUNG","HAM_LUONG","TDKMM","LINK_TOA"]),
      fetchSheetTab(SEARCH_TABS.hoatchat,["HOAT_CHAT","NHOM_TAC_DUNG","SO_TEN_THUONG_MAI","TEN_THUONG_MAI_LIEN_QUAN"]),
      fetchSheetTab(SEARCH_TABS.icd,["MA_ICD","TEN_BENH","LA_MA_NHOM"]),
      fetchSheetTab(SEARCH_TABS.tuongtac,["CAP_THUOC","MUC_DO","MO_TA","XU_TRI"])
    ]);
    searchIndex=[
      ...thuoc.map(mapThuoc),
      ...hoatchat.map(mapHoatchat),
      ...icd.map(mapIcd),
      ...tuongtac.map(mapTuongtac)
    ].filter(item=>item.title);
    attachIcdChildren(searchIndex);
    searchLoaded=true;
    console.info(`[DLS] Đã tải: thuoc=${thuoc.length}, hoatchat=${hoatchat.length}, icd=${icd.length}, tuongtac=${tuongtac.length}, tổng hợp lệ=${searchIndex.length}`);
    if(!icd.length) toast("Cảnh báo: tab ICD không tải được dữ liệu — kiểm tra tên tab và quyền chia sẻ Sheet.");
    renderSearchResults([],"",true);
  }catch(err){
    console.error(err);
    $("searchResults").innerHTML=`<div class="resultItem"><b>Không tải được dữ liệu từ Google Sheet</b><small>Kiểm tra quyền chia sẻ (Anyone with the link – Viewer) và SEARCH_SHEET_ID trong config.js.</small></div>`;
  }finally{
    searchLoading=false;
  }
}


const SEARCH_RESULT_LIMIT=60;

async function doSearch(){
  await loadSearchIndex();
  if(!searchLoaded) return;
  const keyword=($("keyword").value || "").trim();
  const kwNorm=normalizeSearch(keyword);
  const type=$("searchType").value;
  if(!keyword && type==="all"){
    renderSearchResults([],keyword,true);
    return;
  }
  const filtered=searchIndex.filter(item=>{
    const inType=type==="all" || item.type===type;
    if(!inType) return false;
    if(!kwNorm) return true;
    const haystack=normalizeSearch([item.title,item.subtitle,item.body,...item.tags].join(" "));
    return haystack.includes(kwNorm);
  });
  renderSearchResults(filtered.slice(0,SEARCH_RESULT_LIMIT),keyword);
  if(filtered.length>SEARCH_RESULT_LIMIT) toast(`Tìm thấy ${filtered.length} kết quả, hiển thị ${SEARCH_RESULT_LIMIT} kết quả đầu tiên.`);
}

function renderThuocItem(item){
  const rows=[
    ["Hoạt chất",item.hoatChat],
    ["Nhóm tác dụng",item.nhomTacDung],
    ["Hàm lượng",item.hamLuong],
    ["TDKMM",item.tdkmm]
  ].filter(([,value])=>value);
  return `
    <article class="resultItem">
      <b>${escapeHtml(item.title)}</b>
      <small>${labelType(item.type)}</small>
      ${rows.length?`<div class="fieldList">${rows.map(([label,value])=>`<div class="fieldRow"><span class="fieldLabel">${escapeHtml(label)}</span>${escapeHtml(value)}</div>`).join("")}</div>`:""}
      ${item.link?`<div class="tagRow"><a class="tag" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${escapeHtml(item.linkLabel||"Xem thêm")} ↗</a></div>`:""}
    </article>`;
}

function renderSearchResults(results,keyword,isHint){
  const container=$("searchResults");
  if(!container) return;
  if(isHint){
    container.innerHTML=`<div class="resultItem"><b>Nhập từ khóa hoặc chọn nhóm dữ liệu</b><small>Ví dụ: tên thuốc, hoạt chất, mã ICD (vd. J18.9) hoặc cặp thuốc tương tác.</small></div>`;
    return;
  }
  if(!results.length){
    container.innerHTML=`<div class="resultItem"><b>Chưa có kết quả phù hợp</b><small>Thử từ khóa khác hoặc chọn “Tất cả”.</small></div>`;
    return;
  }
  container.innerHTML=results.map(item=>{
    if(item.type==="thuoc") return renderThuocItem(item);
    return `
    <article class="resultItem">
      <b>${escapeHtml(item.title)}</b>
      <small>${labelType(item.type)}${item.subtitle?` · ${escapeHtml(item.subtitle)}`:""}</small>
      ${item.body?`<p>${escapeHtml(item.body)}</p>`:""}
      ${(item.tags.length || item.link || item.statusTag)?`<div class="tagRow">${item.statusTag?`<span class="tag ${item.statusTag.cls}">${escapeHtml(item.statusTag.text)}</span>`:""}${item.tags.map(tag=>`<span class="tag">${escapeHtml(tag)}</span>`).join("")}${item.link?`<a class="tag" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${escapeHtml(item.linkLabel||"Xem thêm")} ↗</a>`:""}</div>`:""}
      ${item.children && item.children.length?`
        <div class="icdChildren">
          <b>Mã chi tiết hơn thuộc nhóm ${escapeHtml(item.title)}:</b>
          <div class="icdChildRow">
            ${item.children.map(child=>`<span class="tag link" title="${escapeHtml(child.subtitle)}" onclick="searchExact('${escapeHtml(child.title).replace(/'/g,"\\'")}')">${escapeHtml(child.title)}</span>`).join("")}
          </div>
        </div>
      `:""}
    </article>`;
  }).join("");
  if(keyword) toast(`Tìm thấy ${results.length} kết quả phù hợp.`);
}

function labelType(type){
  return {thuoc:"Thuốc",hoatchat:"Hoạt chất",icd:"ICD-10",tuongtac:"Tương tác"}[type] || "Dữ liệu";
}

function searchExact(code){
  $("keyword").value=code;
  $("searchType").value="icd";
  doSearch();
  $("keyword").scrollIntoView({behavior:"smooth",block:"center"});
}
