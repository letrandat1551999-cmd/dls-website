/* ===== qlcl.js =====
   Trang "QLCL Dược" (#qlcl): Bộ tiêu chí chất lượng Dược bệnh viện, mã C9.1–C9.6, mỗi tiêu chí
   chia Mức 1–5, mỗi mức có nhiều minh chứng (kèm link Drive nếu có) — cho 2 cơ sở riêng biệt.
   Dữ liệu lấy từ 2 tab Sheet QLCL_CS1/QLCL_CS2 (xem QLCL_TABS ở config.js), MỖI DÒNG đã là 1
   minh chứng "trải phẳng" sẵn, có cột MA_TIEUCHI/TEN_TIEUCHI/MUC lặp lại ở mọi dòng cùng nhóm
   — trình duyệt tự gom lại thành cây ở renderQlclTree(), không phụ thuộc thứ tự dòng liền kề
   trên Sheet nên thêm/sửa dòng ở bất kỳ đâu qua Quản trị vẫn tự xếp đúng chỗ. */

let qlclData={cs1:[],cs2:[]};
let qlclLoaded=false;
let qlclLoading=false;
let qlclActiveTab="cs1";

const QLCL_MUC_ORDER={"Mức 1":1,"Mức 2":2,"Mức 3":3,"Mức 4":4,"Mức 5":5,"Ghi chú":99};

async function loadQlclData(){
  if(qlclLoaded || qlclLoading) return;
  qlclLoading=true;
  try{
    const [cs1,cs2]=await Promise.all([
      fetchSheetTab(QLCL_TABS.cs1,["MA_TIEUCHI","TEN_TIEUCHI","MUC","NOI_DUNG","LINK_MINHCHUNG"]),
      fetchSheetTab(QLCL_TABS.cs2,["MA_TIEUCHI","TEN_TIEUCHI","MUC","NOI_DUNG","LINK_MINHCHUNG"])
    ]);
    qlclData.cs1=cs1.filter(r=>r.MA_TIEUCHI && r.NOI_DUNG);
    qlclData.cs2=cs2.filter(r=>r.MA_TIEUCHI && r.NOI_DUNG);
    qlclLoaded=true;
    renderQlclActiveTab();
  }catch(err){
    console.error(err);
    ["qlclCs1Box","qlclCs2Box"].forEach(id=>{
      const el=$(id);
      if(el) el.innerHTML=`Không tải được dữ liệu — kiểm tra 2 tab ${QLCL_TABS.cs1}/${QLCL_TABS.cs2} trên Google Sheet.`;
    });
  }finally{
    qlclLoading=false;
  }
}

/** Gom dữ liệu phẳng thành cây Tiêu chí → Mức → danh sách minh chứng, giữ nguyên thứ tự tiêu
    chí xuất hiện lần đầu trong Sheet; các Mức sắp theo 1→5 rồi tới "Ghi chú" bất kể thứ tự dòng. */
function buildQlclTree(rows){
  const order=[];
  const byTc={};
  rows.forEach(r=>{
    if(!byTc[r.MA_TIEUCHI]){ byTc[r.MA_TIEUCHI]={ten:r.TEN_TIEUCHI,mucs:{},mucOrder:[]}; order.push(r.MA_TIEUCHI); }
    const tc=byTc[r.MA_TIEUCHI];
    const mucKey=r.MUC||"Khác";
    if(!tc.mucs[mucKey]){ tc.mucs[mucKey]=[]; tc.mucOrder.push(mucKey); }
    tc.mucs[mucKey].push(r);
  });
  order.forEach(ma=>byTc[ma].mucOrder.sort((a,b)=>(QLCL_MUC_ORDER[a]||50)-(QLCL_MUC_ORDER[b]||50)));
  return {order,byTc};
}

/** Render cây cho 1 cơ sở. Không có từ khoá -> hiện đủ cây nhưng đóng gọn (bấm để mở từng phần).
    Có từ khoá -> chỉ giữ lại Mức/Tiêu chí có minh chứng khớp, tự mở sẵn (open) đúng nhánh đó. */
function renderQlclTree(rows,keyword){
  const tree=buildQlclTree(rows);
  const kw=normalizeSearch(keyword||"");
  let html="";
  tree.order.forEach(ma=>{
    const tc=tree.byTc[ma];
    let tcHtml="";
    let tcHasMatch=false;
    tc.mucOrder.forEach(mucKey=>{
      const items=tc.mucs[mucKey];
      const filtered=kw? items.filter(it=>normalizeSearch(it.NOI_DUNG).includes(kw)) : items;
      if(kw && !filtered.length) return;
      if(filtered.length) tcHasMatch=true;
      tcHtml+=`
        <details class="qlclMuc"${kw?" open":""}>
          <summary>${escapeHtml(mucKey)} <small>(${filtered.length})</small></summary>
          <ul class="qlclItems">
            ${filtered.map(it=>`<li>${escapeHtml(it.NOI_DUNG)}${it.LINK_MINHCHUNG?` <a href="${escapeHtml(it.LINK_MINHCHUNG)}" target="_blank" rel="noopener" class="tag link">Xem minh chứng ↗</a>`:""}</li>`).join("")}
          </ul>
        </details>`;
    });
    if(kw && !tcHasMatch) return;
    html+=`
      <details class="qlclTieuChi"${kw?" open":""}>
        <summary><b>${escapeHtml(ma)}</b> — ${escapeHtml(tc.ten)}</summary>
        ${tcHtml}
      </details>`;
  });
  if(!html){
    html=kw? `<p style="color:var(--muted);font-size:13px">Không tìm thấy minh chứng nào khớp "${escapeHtml(keyword)}".</p>`
            : `<p style="color:var(--muted);font-size:13px">Chưa có dữ liệu trong tab tương ứng.</p>`;
  }
  return html;
}

function renderQlclActiveTab(){
  const keyword=($("qlclKeyword")?.value||"").trim();
  const box=$(qlclActiveTab==="cs1"?"qlclCs1Box":"qlclCs2Box");
  if(!box) return;
  if(!qlclLoaded){ box.innerHTML="Đang tải dữ liệu…"; return; }
  box.innerHTML=renderQlclTree(qlclData[qlclActiveTab],keyword);
}

/** Chuyển giữa 2 tab Cơ sở 1 / Cơ sở 2 — cùng dùng chung ô tìm kiếm #qlclKeyword. */
function qlclSelectTab(name){
  qlclActiveTab=name;
  document.querySelectorAll("[data-qlcl-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.qlclTab===name));
  const cs1Box=$("qlclCs1Box"), cs2Box=$("qlclCs2Box");
  if(cs1Box) cs1Box.style.display=name==="cs1"?"block":"none";
  if(cs2Box) cs2Box.style.display=name==="cs2"?"block":"none";
  renderQlclActiveTab();
}

function doSearchQlcl(){
  renderQlclActiveTab();
}
