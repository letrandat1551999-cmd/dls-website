/* ===== globalsearch.js =====
   Thanh tìm kiếm tổng ở header (mọi trang đều thấy) — gộp kết quả từ MỌI nguồn dữ liệu đã có
   sẵn trên trang (Thuốc/Hoạt chất/ICD/Tương tác, Kháng sinh theo vi khuẩn, Phác đồ BYT, QLCL 2
   cơ sở, Bài viết), bấm vào 1 kết quả sẽ tự chuyển đúng trang và tự điền/lọc sẵn cho người dùng.
   Chỉ tải dữ liệu các nguồn khi người dùng thực sự mở ô tìm kiếm lần đầu, tránh tải hết mọi thứ
   ngay khi vừa vào trang chủ (mỗi nguồn vẫn tự nhớ đã tải hay chưa qua các biến *Loaded riêng). */

let globalSearchDataReady=false;
let globalSearchLoading=false;

function toggleGlobalSearch(){
  const panel=$("globalSearchPanel");
  if(!panel) return;
  const opening=!panel.classList.contains("open");
  panel.classList.toggle("open",opening);
  if(opening){
    $("globalSearchInput")?.focus();
    ensureGlobalSearchData();
  }
}
function closeGlobalSearch(){
  $("globalSearchPanel")?.classList.remove("open");
}

async function ensureGlobalSearchData(){
  if(globalSearchDataReady || globalSearchLoading) return;
  globalSearchLoading=true;
  const box=$("globalSearchResults");
  if(box && !box.innerHTML) box.innerHTML=`<p style="color:var(--muted);font-size:13px;padding:6px 0">Đang tải dữ liệu lần đầu, vui lòng chờ giây lát…</p>`;
  await Promise.allSettled([
    loadSearchIndex(),
    loadAntibioticData(),
    loadPhacDoData(),
    loadQlclData(),
    loadPosts()
  ]);
  globalSearchDataReady=true;
  globalSearchLoading=false;
  onGlobalSearchInput($("globalSearchInput")?.value||"");
}

/** Danh sách kết quả hiện đang hiển thị, lưu tạm để runGlobalSearchAction() gọi đúng action —
    tránh phải nhét cả hàm JS vào chuỗi HTML onclick (dễ vỡ với ký tự đặc biệt trong dữ liệu). */
let globalSearchGroups=[];

function onGlobalSearchInput(value){
  const box=$("globalSearchResults");
  if(!box) return;
  const kw=normalizeSearch((value||"").trim());
  if(!kw){ box.innerHTML=""; globalSearchGroups=[]; return; }
  if(!globalSearchDataReady){ box.innerHTML=`<p style="color:var(--muted);font-size:13px;padding:6px 0">Đang tải dữ liệu…</p>`; return; }

  const groups=[];

  const lookupHits=(typeof searchIndex!=="undefined"?searchIndex:[])
    .filter(it=>normalizeSearch([it.title,it.subtitle].join(" ")).includes(kw)).slice(0,6);
  if(lookupHits.length) groups.push({label:"Tra cứu chuyên môn",items:lookupHits.map(it=>({
    title:it.title,sub:labelType(it.type)+(it.subtitle?` · ${it.subtitle}`:""),
    action:()=>{ showPage("search"); $("keyword").value=it.title; $("searchType").value=it.type; doSearch(); }
  }))});

  const vkNames=[...new Set((typeof vikhuanKhangsinhData!=="undefined"?vikhuanKhangsinhData:[]).map(r=>r.VI_KHUAN))]
    .filter(n=>normalizeSearch(n).includes(kw)).slice(0,5);
  if(vkNames.length) groups.push({label:"Kháng sinh — theo vi khuẩn",items:vkNames.map(name=>({
    title:name,sub:"Tra kháng sinh phù hợp",
    action:()=>{ showPage("antibiotic"); searchByOrganism(name); }
  }))});

  const phacDoHits=(typeof phacDoData!=="undefined"?phacDoData:[])
    .filter(r=>normalizeSearch(r.TEN_PHAC_DO).includes(kw)).slice(0,5);
  if(phacDoHits.length) groups.push({label:"Phác đồ BYT",items:phacDoHits.map(r=>({
    title:r.TEN_PHAC_DO,sub:"Phác đồ Bộ Y tế",
    action:()=>{ showPage("phacdo"); $("phacDoKeyword").value=r.TEN_PHAC_DO; doSearchPhacDo(); }
  }))});

  ["cs1","cs2"].forEach(cs=>{
    const rows=(typeof qlclData!=="undefined"?qlclData[cs]:[])||[];
    const hits=rows.filter(r=>normalizeSearch(r.NOI_DUNG).includes(kw)).slice(0,4);
    if(hits.length) groups.push({label:`QLCL Dược — ${cs==="cs1"?"Cơ sở 1":"Cơ sở 2"}`,items:hits.map(r=>({
      title:`${r.MA_TIEUCHI} · ${r.MUC}`,sub:r.NOI_DUNG,
      action:()=>{ showPage("qlcl"); qlclSelectTab(cs); $("qlclKeyword").value=r.NOI_DUNG.slice(0,40); doSearchQlcl(); }
    }))});
  });

  const posts=typeof postsIndex!=="undefined"?postsIndex:[];
  const postHits=posts.filter(p=>normalizeSearch(p.TIEU_DE).includes(kw)).slice(0,5);
  if(postHits.length) groups.push({label:"Bài viết",items:postHits.map(p=>({
    title:p.TIEU_DE,sub:formatPostDate(p.NGAY_DANG)||"Bài viết",
    action:()=>{ location.hash="baiviet-"+encodeURIComponent(postSlug(p,posts.indexOf(p))); }
  }))});

  globalSearchGroups=groups;

  if(!groups.length){
    box.innerHTML=`<p style="color:var(--muted);font-size:13px;padding:6px 0">Không tìm thấy kết quả nào khớp "${escapeHtml(value)}".</p>`;
    return;
  }

  box.innerHTML=groups.map((g,gi)=>`
    <div class="gsGroup">
      <small>${escapeHtml(g.label)}</small>
      ${g.items.map((it,ii)=>`
        <div class="globalSearchResultItem" onclick="runGlobalSearchAction(${gi},${ii})">
          <b>${escapeHtml(it.title)}</b>
          <small>${escapeHtml((it.sub||"").slice(0,100))}</small>
        </div>`).join("")}
    </div>
  `).join("");
}

function runGlobalSearchAction(gi,ii){
  const action=globalSearchGroups[gi]?.items[ii]?.action;
  if(action) action();
  closeGlobalSearch();
}
