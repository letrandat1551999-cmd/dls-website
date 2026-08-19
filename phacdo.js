/* ===== phacdo.js =====
   Trang "Phác đồ BYT" (#phacdo): danh sách phẳng các phác đồ điều trị do Bộ Y tế ban hành,
   kèm link văn bản gốc — lấy trực tiếp từ tab Sheet PHACDO_BYT qua gviz (giống cơ chế
   fetchSheetTab() đã có ở lookup.js), sửa/thêm qua Quản trị dữ liệu là web tự cập nhật. */

let phacDoData=[];
let phacDoLoaded=false;
let phacDoLoading=false;

async function loadPhacDoData(){
  if(phacDoLoaded || phacDoLoading) return;
  phacDoLoading=true;
  $("phacDoResults").innerHTML=`<div class="resultItem"><b>Đang tải dữ liệu…</b></div>`;
  try{
    const rows=await fetchSheetTab(PHACDO_TAB,["TEN_PHAC_DO","LINK"]);
    phacDoData=rows.filter(r=>r.TEN_PHAC_DO);
    phacDoLoaded=true;
    renderPhacDoResults();
  }catch(err){
    console.error(err);
    $("phacDoResults").innerHTML=`<div class="resultItem"><b>Không tải được dữ liệu</b><small>Kiểm tra tab ${PHACDO_TAB} trên Google Sheet.</small></div>`;
  }finally{
    phacDoLoading=false;
  }
}

function doSearchPhacDo(){
  renderPhacDoResults();
}

function renderPhacDoResults(){
  const container=$("phacDoResults");
  if(!container) return;
  if(!phacDoLoaded){ container.innerHTML=`<div class="resultItem"><b>Đang tải dữ liệu…</b></div>`; return; }
  const kw=normalizeSearch(($("phacDoKeyword")?.value||"").trim());
  const filtered=kw? phacDoData.filter(r=>normalizeSearch(r.TEN_PHAC_DO).includes(kw)) : phacDoData;
  if(!filtered.length){
    container.innerHTML=`<div class="resultItem"><b>Không có kết quả phù hợp</b><small>Thử từ khoá khác.</small></div>`;
    return;
  }
  container.innerHTML=filtered.map(r=>`
    <article class="resultItem">
      <b>${escapeHtml(r.TEN_PHAC_DO)}</b>
      ${r.LINK?`<div class="tagRow"><a class="tag" href="${escapeHtml(r.LINK)}" target="_blank" rel="noopener">Xem văn bản gốc ↗</a></div>`:""}
    </article>`).join("");
}
