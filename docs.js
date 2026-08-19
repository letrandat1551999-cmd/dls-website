/* ===== docs.js =====
   Tab "Tài liệu" — 2 khu, đều lấy dữ liệu từ Google Sheet (không hardcode):
     A) 6 mục tĩnh (STATIC_DOC_SECTIONS trong config.js) hiển thị dạng 6 tab con,
        dữ liệu ở tab Sheet TAILIEU_TINH — mỗi dòng ứng với 1 mục (cột MUC khớp id).
     B) "Bài viết mới": feed nhiều bài, mới nhất lên đầu, có tìm kiếm, bấm "Xem thêm"
        để tải thêm bài cũ hơn — dữ liệu ở tab Sheet BAIVIET. Mỗi bài có 1 trang riêng
        (địa chỉ dạng #baiviet-<mã>, xem showPostDetail/renderPostDetail bên dưới) —
        bấm vào bài là chuyển hẳn sang trang đó, bấm Back quay lại đúng danh sách.
   Soạn/sửa cả 2 khu đều qua mục Quản trị dữ liệu (admin.js), dùng trình soạn thảo có
   thanh công cụ (richtext) + tải ảnh lên Drive. Nội dung HTML luôn được lọc qua
   sanitizeRichHtml() (core.js) trước khi chèn vào trang. */

let staticDocsIndex={}; // key = MUC id -> row
let staticDocsLoaded=false;
let staticDocsLoading=false;
let staticDocsActive=STATIC_DOC_SECTIONS[0]?.id;

let postsIndex=[];
let postsLoaded=false;
let postsLoading=false;
let postsRenderCount=6;
const POSTS_PAGE_SIZE=6;
let postDetailWanted=null; // mã bài đang chờ hiện (dùng khi vào thẳng link #baiviet-xxx trước lúc dữ liệu tải xong)

/* ---------------- Khu 1: 6 mục tĩnh ---------------- */

async function loadStaticDocs(){
  renderStaticDocsNav(); // hiện khung tab ngay, không chờ dữ liệu
  if(staticDocsLoaded || staticDocsLoading) return;
  if(!SEARCH_SHEET_ID || SEARCH_SHEET_ID==="PASTE_GOOGLE_SHEET_ID_HERE"){
    $("staticDocsContent").innerHTML="Chưa cấu hình SEARCH_SHEET_ID trong config.js.";
    return;
  }
  staticDocsLoading=true;
  try{
    const rows=await fetchSheetTab(STATIC_DOCS_TAB,["MUC","TIEU_DE","ANH_DAI_DIEN","NOI_DUNG","LINK_CONG_CU","LINK_NHAN"]);
    staticDocsIndex={};
    rows.forEach(r=>{ if(r.MUC) staticDocsIndex[String(r.MUC).trim()]=r; });
    staticDocsLoaded=true;
    renderStaticDocSection(staticDocsActive);
  }catch(err){
    console.error(err);
    $("staticDocsContent").innerHTML=`Không tải được dữ liệu — kiểm tra tab ${STATIC_DOCS_TAB} trên Google Sheet.`;
  }finally{
    staticDocsLoading=false;
    renderAdrPage();
  }
}

function renderStaticDocsNav(){
  const nav=$("staticDocsTabs");
  if(!nav || nav.dataset.built) { renderStaticDocSection(staticDocsActive); return; }
  nav.dataset.built="1";
  nav.innerHTML=STATIC_DOC_SECTIONS.map((s,i)=>`
    <button class="appTab${s.id===staticDocsActive?" active":""}" type="button" data-static-doc="${s.id}" onclick="renderStaticDocSection('${s.id}')">
      <span>0${i+1}</span><b>${escapeHtml(s.label)}</b>
    </button>
  `).join("");
}

/** Dựng HTML nội dung 1 "mục" (dùng chung cho cả 6 tab con của Tài liệu lẫn trang ADR riêng ở
    thanh công cụ trên cùng): ảnh đại diện (nếu có) + tiêu đề + link nhanh cố định (quickLinks, nếu
    mục có khai báo) + nội dung tự soạn (nếu có) + nút bên dưới (nếu có). KHÔNG kèm khu tin tức tự
    động — chỗ gọi tự thêm riêng vì chỉ áp dụng cho đúng 1 mục (ADR). */
function buildSectionContentHtml(section,row){
  const hasContent=row && (row.TIEU_DE || row.NOI_DUNG);
  const quickLinksHtml=(section.quickLinks&&section.quickLinks.length)?`
    <div class="tagRow">
      ${section.quickLinks.map(l=>`<a class="tag" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)} ↗</a>`).join("")}
    </div>`:"";

  if(!hasContent){
    return `
      <b>${escapeHtml(section.label)}</b>
      ${quickLinksHtml}
      <p style="color:var(--muted);font-size:13px;margin-top:12px">Chưa có nội dung tự soạn cho mục này — thêm qua Quản trị dữ liệu, tab "${escapeHtml(ADMIN_TAB_SCHEMAS.TAILIEU_TINH.label)}", chọn mục "${escapeHtml(section.label)}" (không bắt buộc nếu chỉ cần các link nhanh ở trên).</p>`;
  }

  const linkHref=row.LINK_CONG_CU || section.defaultLink || "";
  const linkLabel=row.LINK_NHAN || section.defaultLinkLabel || "Mở liên kết";
  const isExternal=/^https?:\/\//i.test(linkHref);
  return `
    ${row.ANH_DAI_DIEN?`<img src="${escapeHtml(row.ANH_DAI_DIEN)}" alt="" style="width:100%;max-height:260px;object-fit:cover;border-radius:14px;margin-bottom:14px">`:""}
    <b style="font-size:18px">${escapeHtml(row.TIEU_DE||section.label)}</b>
    ${quickLinksHtml}
    <div style="margin-top:10px;font-size:14px;line-height:1.7">${sanitizeRichHtml(row.NOI_DUNG)}</div>
    ${linkHref?`<div class="formActions"><button class="primary" type="button" onclick="${isExternal?`window.open(${JSON.stringify(linkHref)},'_blank')`:`location.hash=${JSON.stringify(linkHref.replace('#',''))}`}">${escapeHtml(linkLabel)} →</button></div>`:""}
  `;
}

function renderStaticDocSection(id){
  staticDocsActive=id;
  document.querySelectorAll("[data-static-doc]").forEach(btn=>btn.classList.toggle("active",btn.dataset.staticDoc===id));
  const box=$("staticDocsContent");
  if(!box) return;
  if(!staticDocsLoaded){ box.innerHTML="Đang tải dữ liệu…"; return; }
  const section=STATIC_DOC_SECTIONS.find(s=>s.id===id);
  if(!section) return;
  box.innerHTML=buildSectionContentHtml(section,staticDocsIndex[id]);
  wrapContentTables(box);
}

/* ---------------- Trang ADR riêng (thanh công cụ trên cùng, #adr) ----------------
   Dùng lại đúng nguồn dữ liệu nội dung tự soạn của 6 mục tĩnh (ADR_SECTION trong config.js,
   khớp Sheet TAILIEU_TINH theo MUC="sop-adr") — chỉ khác chỗ hiển thị: có trang riêng thay vì
   nằm lồng trong tab Tài liệu, và có thêm khu tin tức tự động từ canhgiacduoc.org.vn. */

function loadAdrPage(){
  loadStaticDocs(); // dùng lại nguyên hàm tải 6 mục tĩnh — tự bỏ qua nếu đã tải/đang tải rồi
  renderAdrPage();
  adrSelectTab("content"); // luôn mở tab Hướng dẫn mỗi khi vào lại trang ADR qua thanh nav
}

function renderAdrPage(){
  const box=$("adrContent");
  if(!box) return;
  if(!staticDocsLoaded){
    box.innerHTML=staticDocsLoading?"Đang tải dữ liệu…":`Không tải được dữ liệu — kiểm tra tab ${STATIC_DOCS_TAB} trên Google Sheet.`;
    return;
  }
  const row=staticDocsIndex[ADR_SECTION.id];
  const formHtml=ADR_SECTION.embedFormUrl?`
    <div style="margin-top:22px;padding-top:18px;border-top:1px dashed var(--line)">
      <b style="font-size:16px">Báo cáo ADR trực tuyến</b>
      <div class="formEmbedWrap"><iframe src="${escapeHtml(ADR_SECTION.embedFormUrl)}" loading="lazy" title="Form báo cáo ADR">Đang tải biểu mẫu…</iframe></div>
    </div>`:"";
  box.innerHTML=buildSectionContentHtml(ADR_SECTION,row)+formHtml;
  wrapContentTables(box);
  loadExternalNews();
}

/** Chuyển giữa 2 tab của trang ADR: "content" (hướng dẫn + form báo cáo) và "news" (tin tức tự
    động từ canhgiacduoc.org.vn) — tách riêng để tin tức không bị chìm xuống cuối trang như trước. */
function adrSelectTab(name){
  document.querySelectorAll("[data-adr-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.adrTab===name));
  const contentBox=$("adrContent");
  const newsBox=$("adrNewsContent");
  if(contentBox) contentBox.style.display=name==="content"?"block":"none";
  if(newsBox) newsBox.style.display=name==="news"?"block":"none";
}

/** Nút "Xem tất cả tin tức →" ở Trang chủ: chuyển sang trang ADR rồi tự mở đúng tab "Tin tức mới". */
function goToAdrNews(){
  location.hash="adr";
  setTimeout(()=>adrSelectTab("news"),60);
}

/* ---------------- Khu 2: Bài viết mới (feed, tìm kiếm, xem thêm, trang riêng từng bài) ---------------- */

function parsePostDate(v){
  const t=Date.parse(v);
  return Number.isFinite(t)? t : 0; // không có ngày hợp lệ -> coi như cũ nhất, bị đẩy xuống cuối
}

async function loadPosts(){
  if(postsLoaded || postsLoading) return;
  if(!SEARCH_SHEET_ID || SEARCH_SHEET_ID==="PASTE_GOOGLE_SHEET_ID_HERE"){
    $("postsGrid").innerHTML=`<article><b>Chưa cấu hình nguồn dữ liệu</b><p>Dán ID Google Sheet vào SEARCH_SHEET_ID trong config.js.</p></article>`;
    return;
  }
  postsLoading=true;
  $("postsGrid").innerHTML=`<article><b>Đang tải bài viết…</b></article>`;
  try{
    const rows=await fetchSheetTab(POSTS_TAB,["TIEU_DE","NGAY_DANG","ANH_DAI_DIEN","NOI_DUNG","LINK_CONG_CU","LINK_NHAN","MA_BAIVIET","NOI_BAT"]);
    postsIndex=rows.filter(r=>r.TIEU_DE).sort((a,b)=>parsePostDate(b.NGAY_DANG)-parsePostDate(a.NGAY_DANG));
    postsLoaded=true;
    renderPosts();
    renderFeaturedPosts();
    if(postDetailWanted) renderPostDetail(postDetailWanted);
  }catch(err){
    console.error(err);
    $("postsGrid").innerHTML=`<article><b>Không tải được dữ liệu</b><p>Kiểm tra tab ${POSTS_TAB} trên Google Sheet.</p></article>`;
  }finally{
    postsLoading=false;
  }
}

function formatPostDate(v){
  const t=parsePostDate(v);
  if(!t) return "";
  const d=new Date(t);
  return d.toLocaleDateString("vi-VN");
}

function postExcerpt(html,maxLen=160){
  const text=String(html||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  return text.length>maxLen? text.slice(0,maxLen).trim()+"…" : text;
}

/** Link riêng của 1 bài (dùng cho cả thẻ trong feed lẫn nút "Về danh sách"). Bài cũ đăng từ trước
    khi có tính năng này có thể chưa có MA_BAIVIET (cột trống) — dùng tạm mã dựng từ tiêu đề + vị
    trí trong danh sách để vẫn bấm mở được, nhưng KHÔNG cố định (đổi khi có bài mới chen vào trước).
    Khuyên mở lại bài đó trong Quản trị rồi bấm Lưu 1 lần để được cấp mã cố định thật sự. */
function postSlug(post,fallbackIndex){
  return post.MA_BAIVIET || (slugify(post.TIEU_DE)+"-tam-"+fallbackIndex);
}

function doSearchPosts(){
  postsRenderCount=POSTS_PAGE_SIZE; // gõ tìm kiếm mới -> reset về trang đầu
  if(!postsLoaded){ loadPosts(); return; }
  renderPosts();
}

function loadMorePosts(){
  postsRenderCount+=POSTS_PAGE_SIZE;
  renderPosts();
}

function renderPosts(){
  const grid=$("postsGrid");
  const moreBtn=$("loadMorePostsBtn");
  if(!grid) return;
  if(!postsLoaded){ grid.innerHTML=`<article><b>Đang tải bài viết…</b></article>`; if(moreBtn) moreBtn.style.display="none"; return; }

  const kwNorm=normalizeSearch(($("postKeyword")?.value||"").trim());
  const filtered=kwNorm
    ? postsIndex.filter(p=>normalizeSearch(`${p.TIEU_DE} ${postExcerpt(p.NOI_DUNG,10000)}`).includes(kwNorm))
    : postsIndex;

  if(!filtered.length){
    grid.innerHTML=`<article><b>Chưa có bài viết phù hợp</b><p>Thử từ khoá khác, hoặc thêm bài viết mới qua Quản trị dữ liệu.</p></article>`;
    if(moreBtn) moreBtn.style.display="none";
    return;
  }

  const visible=filtered.slice(0,postsRenderCount);
  grid.innerHTML=visible.map((p,i)=>{
    const date=formatPostDate(p.NGAY_DANG);
    const href=`#baiviet-${encodeURIComponent(postSlug(p,i))}`;
    return `
    <article>
      ${p.ANH_DAI_DIEN?`<a href="${href}"><img src="${escapeHtml(p.ANH_DAI_DIEN)}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:12px;margin-bottom:10px"></a>`:""}
      ${date?`<span class="tag">${escapeHtml(date)}</span>`:""}
      <b><a href="${href}" style="color:inherit">${escapeHtml(p.TIEU_DE)}</a></b>
      <p class="postExcerpt">${escapeHtml(postExcerpt(p.NOI_DUNG))}</p>
      <a href="${href}">Đọc tiếp →</a>
      ${p.LINK_CONG_CU?`<div class="tagRow"><a class="tag" href="${escapeHtml(p.LINK_CONG_CU)}" target="_blank" rel="noopener">${escapeHtml(p.LINK_NHAN||"Xem thêm")} ↗</a></div>`:""}
    </article>`;
  }).join("");

  if(moreBtn) moreBtn.style.display = visible.length<filtered.length? "inline-flex":"none";
}

/** Vào trang riêng của 1 bài viết (gọi từ core.js route() khi hash là #baiviet-<mã>). Nếu dữ liệu
    bài viết chưa tải xong (VD người khác bấm thẳng link mà chưa từng mở web trước đó) thì chờ
    loadPosts() tải xong rồi tự hiện tiếp — xem chỗ gọi renderPostDetail trong loadPosts() ở trên. */
function showPostDetail(slug){
  postDetailWanted=slug;
  if(!postsLoaded){ loadPosts(); return; }
  renderPostDetail(slug);
}

function renderPostDetail(slug){
  if(postDetailWanted!==slug) return; // đã điều hướng sang chỗ khác trong lúc chờ tải, bỏ qua
  const feedEl=$("postsFeedView");
  const detailEl=$("postDetailView");
  if(!feedEl||!detailEl) return;

  const post=postsIndex.find((p,i)=>postSlug(p,i)===slug);
  if(!post){
    detailEl.innerHTML=`<article><b>Không tìm thấy bài viết</b><p>Bài viết có thể đã bị xoá, hoặc link đã cũ. <a class="tag link" href="#docs">← Về danh sách bài viết</a></p></article>`;
  }else{
    const date=formatPostDate(post.NGAY_DANG);
    detailEl.innerHTML=`
      <a href="#docs" class="tag link" style="margin-bottom:14px;display:inline-flex">← Về danh sách bài viết</a>
      ${post.ANH_DAI_DIEN?`<img src="${escapeHtml(post.ANH_DAI_DIEN)}" alt="" style="width:100%;max-height:320px;object-fit:cover;border-radius:16px;margin:12px 0">`:""}
      ${date?`<span class="tag">${escapeHtml(date)}</span>`:""}
      <h1 style="font-size:26px;line-height:1.2;color:var(--green-dark);margin:10px 0 4px">${escapeHtml(post.TIEU_DE)}</h1>
      <div class="postBody" style="font-size:15px;line-height:1.8;margin-top:12px">${sanitizeRichHtml(post.NOI_DUNG)}</div>
      ${post.LINK_CONG_CU?`<div class="formActions"><a class="tag" style="min-height:40px;padding:0 16px" href="${escapeHtml(post.LINK_CONG_CU)}" target="_blank" rel="noopener">${escapeHtml(post.LINK_NHAN||"Xem thêm")} ↗</a></div>`:""}
    `;
    wrapContentTables(detailEl);
  }
  feedEl.style.display="none";
  detailEl.style.display="block";
  window.scrollTo({top:0,behavior:"smooth"});
}

/** Đóng trang chi tiết bài viết, quay về xem danh sách (6 tab tĩnh + feed bài viết) — gọi từ
    core.js route() mỗi khi hash KHÔNG phải dạng #baiviet-..., để tránh việc rời trang Tài liệu
    rồi quay lại vẫn còn kẹt ở màn hình chi tiết bài cũ. */
function hidePostDetail(){
  postDetailWanted=null;
  const feedEl=$("postsFeedView");
  const detailEl=$("postDetailView");
  if(detailEl) detailEl.style.display="none";
  if(feedEl) feedEl.style.display="block";
}

/* ---------------- Tin tức tự động từ Trung tâm DI & ADR Quốc gia (mục SOP theo dõi ADR) ----------------
   Dữ liệu do Apps Script tự kiểm tra định kỳ và ghi vào tab Sheet EXTERNAL_NEWS_TAB (xem
   syncExternalNews_ trong AdminApi_CodeGs.txt) — trang web CHỈ ĐỌC tab này qua gviz công khai,
   không tự cào trực tiếp từ trình duyệt (bị chặn CORS nếu làm vậy). Bấm vào 1 tin sẽ mở THẲNG
   trang gốc trên canhgiacduoc.org.vn (không phải trang riêng nội bộ như bài viết tự đăng). */

let externalNewsIndex=[];
let externalNewsLoaded=false;
let externalNewsLoading=false;

async function loadExternalNews(){
  if(externalNewsLoaded){ renderExternalNews(); return; }
  if(externalNewsLoading) return;
  externalNewsLoading=true;
  try{
    const rows=await fetchSheetTab(EXTERNAL_NEWS_TAB,["TIEU_DE","LINK_GOC","NGUON","MA_TIN","NGAY_LAY"]);
    externalNewsIndex=rows.filter(r=>r.TIEU_DE && r.LINK_GOC)
      .sort((a,b)=>(parseInt(b.MA_TIN,10)||0)-(parseInt(a.MA_TIN,10)||0)); // mã tin lớn hơn = mới hơn
    externalNewsLoaded=true;
  }catch(err){
    console.error(err);
    externalNewsIndex=[];
  }finally{
    externalNewsLoading=false;
    renderExternalNews();
  }
}

function renderExternalNews(){
  renderAdrNewsBox();
  renderHomeNews();
}

/** Khối tin tức đầy đủ trong tab "Tin tức mới" của trang ADR (#externalNewsBox). */
function renderAdrNewsBox(){
  const box=$("externalNewsBox");
  if(!box) return;
  if(!externalNewsLoaded){ box.innerHTML="Đang tải tin tức…"; return; }
  if(!externalNewsIndex.length){
    box.innerHTML=`<p style="color:var(--muted);font-size:13px">Chưa có tin tức nào được lấy về — hệ thống tự kiểm tra định kỳ, hoặc bấm "Đồng bộ tin tức ngay" trong Quản trị dữ liệu (tab "${escapeHtml(ADMIN_TAB_SCHEMAS.TIN_CANHGIACDUOC.label)}") để lấy ngay.</p>`;
    return;
  }
  const groups=[
    {label:"Tin trong nước",items:externalNewsIndex.filter(n=>n.NGUON==="Trong nước").slice(0,3)},
    {label:"Tin nước ngoài",items:externalNewsIndex.filter(n=>n.NGUON==="Nước ngoài").slice(0,3)}
  ];
  box.innerHTML=`
    <b style="font-size:16px">Tin tức mới — Trung tâm DI & ADR Quốc gia</b>
    <small>Nguồn: ${escapeHtml(EXTERNAL_NEWS_SOURCE_LABEL)} (canhgiacduoc.org.vn) — bấm vào tin để mở đúng trang gốc</small>
    <div class="twoCol" style="margin-top:12px">
      ${groups.map(g=>`
        <div>
          <div class="tag">${escapeHtml(g.label)}</div>
          <div style="margin-top:8px;display:grid;gap:8px">
            ${g.items.length? g.items.map(n=>`<a class="resultItem" style="display:block" href="${escapeHtml(n.LINK_GOC)}" target="_blank" rel="noopener">${escapeHtml(n.TIEU_DE)}</a>`).join("")
              : `<p style="color:var(--muted);font-size:13px">Chưa có tin.</p>`}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

/** Khối tóm tắt tin tức trên Trang chủ (#homeNewsBox) — dùng chung dữ liệu đã tải ở
    loadExternalNews(), chỉ hiện tối đa 3 tin mỗi nguồn, tự ẩn cả khối nếu chưa có tin nào. */
function renderHomeNews(){
  const wrap=$("homeNewsWrap");
  const box=$("homeNewsBox");
  if(!wrap||!box) return;
  if(!externalNewsLoaded || !externalNewsIndex.length){ wrap.style.display="none"; box.innerHTML=""; return; }
  const items=[
    ...externalNewsIndex.filter(n=>n.NGUON==="Trong nước").slice(0,3).map(n=>({...n,foreign:false})),
    ...externalNewsIndex.filter(n=>n.NGUON==="Nước ngoài").slice(0,3).map(n=>({...n,foreign:true}))
  ];
  wrap.style.display="block";
  box.className="newsCardGrid";
  box.innerHTML=items.map(n=>`
    <a class="newsCard${n.foreign?" foreign":""}" href="${escapeHtml(n.LINK_GOC)}" target="_blank" rel="noopener">
      <div class="newsCardIcon">${n.foreign?"🌐":"📰"}</div>
      <div class="newsCardBody"><b>${escapeHtml(n.TIEU_DE)}</b></div>
    </a>
  `).join("");
}

/* ---------------- "Bài viết nổi bật" — carousel tự chạy vòng ở Trang chủ ----------------
   Chỉ lấy các bài có tick "Đánh dấu bài nổi bật" trong Quản trị (cột NOI_BAT trên Sheet BAIVIET).
   Không có bài nào được đánh dấu -> tự ẩn cả khu này, không hiện khung trống trên Trang chủ. */

let featuredIndex=0;
let featuredTimer=null;

function renderFeaturedPosts(){
  const wrap=$("featuredPostsWrap");
  const carousel=$("featuredCarousel");
  if(!wrap||!carousel) return;

  const featured=postsIndex.filter(p=>p.NOI_BAT==="Có"||p.NOI_BAT===true||p.NOI_BAT==="TRUE");
  clearInterval(featuredTimer);
  if(!featured.length){ wrap.classList.remove("show"); carousel.innerHTML=""; return; }

  wrap.classList.add("show");
  featuredIndex=0;
  carousel.dataset.count=featured.length;
  carousel.innerHTML=`
    <div class="featuredTrack">
      ${featured.map((p,i)=>{
        const href=`#baiviet-${encodeURIComponent(postSlug(p,i))}`;
        const date=formatPostDate(p.NGAY_DANG);
        return `
        <a class="featuredSlide" href="${href}">
          ${p.ANH_DAI_DIEN?`<img src="${escapeHtml(p.ANH_DAI_DIEN)}" alt="">`:`<div class="featuredSlideNoImg"></div>`}
          <div class="featuredSlideBody">
            <div class="tagRow"><span class="tag ok">★ Nổi bật</span>${date?`<span class="tag">${escapeHtml(date)}</span>`:""}</div>
            <b>${escapeHtml(p.TIEU_DE)}</b>
            <p>${escapeHtml(postExcerpt(p.NOI_DUNG,140))}</p>
          </div>
        </a>`;
      }).join("")}
    </div>
    ${featured.length>1?`
      <button type="button" class="featuredNav prev" onclick="featuredGo(-1)" aria-label="Bài trước">‹</button>
      <button type="button" class="featuredNav next" onclick="featuredGo(1)" aria-label="Bài sau">›</button>
      <div class="featuredDots">${featured.map((_,i)=>`<button type="button" class="featuredDot${i===0?" active":""}" onclick="featuredGoTo(${i})" aria-label="Bài ${i+1}"></button>`).join("")}</div>
    `:""}
  `;
  featuredApplyPosition();
  if(featured.length>1){
    featuredStartAuto();
    carousel.onmouseenter=()=>clearInterval(featuredTimer);
    carousel.onmouseleave=()=>featuredStartAuto();
  }
}

function featuredApplyPosition(){
  const track=$("featuredCarousel")?.querySelector(".featuredTrack");
  if(!track) return;
  track.style.transform=`translateX(-${featuredIndex*100}%)`;
  document.querySelectorAll(".featuredDot").forEach((d,i)=>d.classList.toggle("active",i===featuredIndex));
}

/** delta = +1/-1 để lùi/tiến 1 bài. resetTimer=false khi tự chạy vòng (khỏi tự đá giờ liên tục),
    true khi người dùng tự bấm nút/chấm (để đợi đủ 5s tiếp mới tự chạy tiếp, đỡ giật). */
function featuredGo(delta,resetTimer=true){
  const count=Number($("featuredCarousel")?.dataset.count||0);
  if(!count) return;
  featuredIndex=(featuredIndex+delta+count)%count;
  featuredApplyPosition();
  if(resetTimer) featuredStartAuto();
}

function featuredGoTo(i){
  featuredIndex=i;
  featuredApplyPosition();
  featuredStartAuto();
}

function featuredStartAuto(){
  clearInterval(featuredTimer);
  const count=Number($("featuredCarousel")?.dataset.count||0);
  if(count<=1) return;
  featuredTimer=setInterval(()=>featuredGo(1,false),5000);
}
