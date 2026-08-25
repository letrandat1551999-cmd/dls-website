/* ===== app-init.js =====
   Khởi tạo trang: gắn sự kiện, load dữ liệu lần đầu theo route hiện tại.
   File này PHẢI load sau cùng (sau config/core/calculators/lookup/
   antibiotic/docs/admin) vì nó gọi hàm từ tất cả các module trên. */


document.addEventListener("DOMContentLoaded",()=>{
  // Gán href cho nút "Mở riêng" bằng JS (thay vì in cứng URL trong index.html) — URL chỉ nằm trong
  // config.js dưới dạng base64, đỡ lộ trực tiếp khi ai đó View Source/F12 xem thẳng index.html.
  // (Link "renal" đã tự động qua updateRenalLink() ở calculators.js, không cần gán ở đây.)
  const reportLink=$("reportOpenLink"); if(reportLink) reportLink.href=APP_URLS.report;
  const sglt2Link=$("sglt2OpenLink"); if(sglt2Link) sglt2Link.href=APP_URLS.sglt2;
  document.querySelectorAll("[data-route]").forEach(link=>link.addEventListener("click",event=>{
    event.preventDefault();
    showPage(link.dataset.route);
  }));
  ["age","sex","weight","scr","scrUnit","albuminCurrent","albuminTarget","albuminUnit"].forEach(id=>$(id)?.addEventListener("input",calculateAll));
  let searchDebounce;
  $("keyword")?.addEventListener("input",()=>{clearTimeout(searchDebounce);searchDebounce=setTimeout(doSearch,220)});
  $("searchType")?.addEventListener("change",doSearch);
  let postsDebounce;
  $("postKeyword")?.addEventListener("input",()=>{clearTimeout(postsDebounce);postsDebounce=setTimeout(doSearchPosts,220)});
  renderSearchResults([],"",true);
  if(location.hash.replace("#","")==="search") loadSearchIndex();
  if(location.hash.replace("#","")==="antibiotic") loadAntibioticData();
  loadPosts(); // tải sẵn để Trang chủ hiện được carousel "Bài viết nổi bật" dù chưa vào tab Tài liệu
  loadExternalNews(); // tải sẵn để Trang chủ hiện được khối tin tức Cảnh giác dược dù chưa vào tab ADR
  route();
  const reportFrame=$("reportFrame");
  if(reportFrame && !reportFrame.src && adminToken) reportFrame.src=APP_URLS.report; // báo cáo ngoại trú chỉ tải khi đã đăng nhập
  $("renalFrame")?.addEventListener("load",()=> {
    if(pendingRenalData) postRenalData(pendingRenalData);
  });
  renderAdminTabs();
  $("adminPassword")?.addEventListener("keydown",e=>{if(e.key==="Enter")adminLogin()});
  $("adminSearchKeyword")?.addEventListener("keydown",e=>{if(e.key==="Enter")adminSearch()});
  $("organismKeyword")?.addEventListener("keydown",e=>{if(e.key==="Enter")searchByOrganism();else if(e.key==="Escape")hideOrganismSuggestions()});
  let organismDebounce;
  $("organismKeyword")?.addEventListener("input",e=>{clearTimeout(organismDebounce);organismDebounce=setTimeout(()=>renderOrganismSuggestions(e.target.value),180)});
  // Trễ 150ms trước khi ẩn dropdown khi rời ô input, để kịp nhận click chọn gợi ý (click cũng kích hoạt blur).
  $("organismKeyword")?.addEventListener("blur",()=>setTimeout(hideOrganismSuggestions,150));
  restoreAdminSession();
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeGlobalSearch(); });
  document.addEventListener("click",e=>{
    const panel=$("globalSearchPanel");
    if(panel && panel.classList.contains("open") && !panel.contains(e.target) && !e.target.closest(".searchToggleBtn")) closeGlobalSearch();
  });

  // Hiệu ứng "xuất hiện dần" khi cuộn tới hoặc khi chuyển sang trang chứa khối .reveal (moduleHero,
  // các khối lớn ở Trang chủ...) — tắt class khi khối rời khỏi màn hình (display:none lúc đổi trang)
  // để lần sau quay lại trang đó vẫn thấy hiệu ứng chạy lại, không bị "học lỳ" đứng yên luôn.
  if("IntersectionObserver" in window){
    const revealObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>entry.target.classList.toggle("inView",entry.isIntersecting));
    },{threshold:0.12});
    document.querySelectorAll(".reveal").forEach(el=>revealObserver.observe(el));
  }else{
    document.querySelectorAll(".reveal").forEach(el=>el.classList.add("inView")); // trình duyệt cũ -> hiện luôn, khỏi ẩn mất nội dung
  }
});

window.addEventListener("hashchange",route);
