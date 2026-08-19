/* ===== Kháng sinh — 2 công cụ độc lập =====
   A) Đề xuất kháng sinh theo chuỗi: Vị trí nhiễm khuẩn → Vi khuẩn thường gặp → Kháng sinh phù hợp → đối chiếu liều.
      Dữ liệu tách thành 2 bảng quan hệ, JOIN với nhau ở phía trình duyệt — linh hoạt hơn nhồi hết vào 1 dòng:
        - VITRI_VIKHUAN: Vị trí nhiễm khuẩn  <-->  Vi khuẩn thường gặp (1 vi khuẩn có thể thuộc nhiều vị trí)
        - VIKHUAN_KHANGSINH: Vi khuẩn  <-->  Kháng sinh phù hợp (sửa kháng sinh của 1 vi khuẩn 1 lần, áp dụng cho mọi vị trí có vi khuẩn đó)
   B) Phân tích nhanh kết quả kháng sinh đồ dán từ báo cáo — xử lý HOÀN TOÀN trên trình duyệt,
      KHÔNG gửi lên Sheet, KHÔNG lưu lại, chỉ hiện kết quả tức thời. */

let vitriVikhuanData=[];
let vikhuanKhangsinhData=[];
let antibioticLoaded=false;
let antibioticLoading=false;

async function loadAntibioticData(){
  if(antibioticLoaded || antibioticLoading) return;
  if(!SEARCH_SHEET_ID || SEARCH_SHEET_ID==="PASTE_GOOGLE_SHEET_ID_HERE"){
    $("antibioticGuide").innerHTML="Chưa cấu hình SEARCH_SHEET_ID trong config.js.";
    return;
  }
  antibioticLoading=true;
  try{
    const [vitri,vikhuan]=await Promise.all([
      fetchSheetTab("VITRI_VIKHUAN",["HE_CO_QUAN","VI_KHUAN","MUC_DO_THUONG_GAP","GHI_CHU"]),
      fetchSheetTab("VIKHUAN_KHANGSINH",["VI_KHUAN","KHANG_SINH","UU_TIEN","GHI_CHU_LIEU"])
    ]);
    vitriVikhuanData=vitri.filter(r=>r.HE_CO_QUAN && r.VI_KHUAN);
    vikhuanKhangsinhData=vikhuan.filter(r=>r.VI_KHUAN && r.KHANG_SINH);
    antibioticLoaded=true;
    renderOrganSystemSelect();
  }catch(err){
    console.error(err);
    $("antibioticGuide").innerHTML="Không tải được dữ liệu — kiểm tra 2 tab VITRI_VIKHUAN và VIKHUAN_KHANGSINH trên Google Sheet.";
  }finally{
    antibioticLoading=false;
  }
}

/** Vi khuẩn (không phân biệt hoa/thường, khoảng trắng thừa) → danh sách kháng sinh phù hợp từ bảng VIKHUAN_KHANGSINH. */
function antibioticsForOrganism(name){
  const key=String(name||"").trim().toLowerCase();
  return vikhuanKhangsinhData.filter(r=>String(r.VI_KHUAN||"").trim().toLowerCase()===key);
}

/** Sinh 1 thẻ kháng sinh. Nếu có GHI_CHU_LIEU (liều thường gặp) thì thẻ bấm được — nháy vào để
    mở/đóng khung liều ngay bên dưới, thay vì hiện luôn (đỡ rối) hoặc chỉ hiện khi hover (không dùng
    được trên mobile). Dùng lại đúng pattern span.tag.link + onclick đã có (giống nút Sửa/Xoá ở Quản trị),
    không thêm class/style lạ. */
function abxTag(a){
  const okCls=a.UU_TIEN==="Ưu tiên 1"?" ok":"";
  const label=`${escapeHtml(a.KHANG_SINH)}${a.UU_TIEN?` · ${escapeHtml(a.UU_TIEN)}`:""}`;
  if(!a.GHI_CHU_LIEU) return `<span class="tag${okCls}">${label}</span>`;
  return `<span class="tag${okCls} link" onclick="toggleDoseNote(this)">${label} ▾</span><div class="doseNote">${escapeHtml(a.GHI_CHU_LIEU)}</div>`;
}

/** Nháy vào thẻ kháng sinh (có liều) → mở/đóng khung liều nằm ngay sau nó trong tagRow. */
function toggleDoseNote(tagEl){
  const note=tagEl.nextElementSibling;
  if(!note || !note.classList.contains("doseNote")) return;
  note.classList.toggle("show");
}

function renderOrganSystemSelect(){
  const select=$("infectionSite");
  const sites=[...new Set(vitriVikhuanData.map(r=>r.HE_CO_QUAN))];
  if(!sites.length){
    select.innerHTML=`<option>Chưa có dữ liệu</option>`;
    $("antibioticGuide").innerHTML="Chưa có dữ liệu trong tab VITRI_VIKHUAN. Thêm dữ liệu qua Quản trị.";
    return;
  }
  select.innerHTML=sites.map((s,i)=>`<option value="${i}">${escapeHtml(s)}</option>`).join("");
  select.dataset.sites=JSON.stringify(sites);
  renderAntibioticGuide();
}

function renderAntibioticGuide(){
  const sites=JSON.parse($("infectionSite").dataset.sites||"[]");
  const site=sites[Number($("infectionSite").value||0)];
  if(!site) return;

  // Bước 1: JOIN vị trí -> danh sách vi khuẩn (kèm mức độ thường gặp)
  const organisms=vitriVikhuanData.filter(r=>r.HE_CO_QUAN===site);

  // Bước 2: với mỗi vi khuẩn, JOIN tiếp -> kháng sinh phù hợp
  const blocks=organisms.map(o=>{
    const abx=antibioticsForOrganism(o.VI_KHUAN);
    const freqTag=o.MUC_DO_THUONG_GAP?`<span class="tag">${escapeHtml(o.MUC_DO_THUONG_GAP)}</span>`:"";
    return `
      <div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)">
        <b style="font-size:13px">${escapeHtml(o.VI_KHUAN)}</b> ${freqTag}
        ${o.GHI_CHU?`<div style="font-size:11px;color:var(--muted);margin-top:2px">${escapeHtml(o.GHI_CHU)}</div>`:""}
        <div class="tagRow" style="margin-top:6px">
          ${abx.length? abx.map(abxTag).join("") : `<span class="tag">Chưa có kháng sinh khớp trong VIKHUAN_KHANGSINH</span>`}
        </div>
      </div>`;
  }).join("");

  $("antibioticGuide").innerHTML=`
    <b>${escapeHtml(site)}</b>
    <small>Bước 1 → Vi khuẩn thường gặp · Bước 2 → Kháng sinh phù hợp theo từng vi khuẩn (nháy vào tên để xem liều thường gặp)</small>
    ${blocks || "<p>Chưa có vi khuẩn nào gắn với vị trí này trong tab VITRI_VIKHUAN.</p>"}
    <div class="formActions" style="margin-top:14px"><button class="primary" type="button" onclick="showPage('tools')">Bước 3 → Đối chiếu liều (CrCl/eGFR)</button><button type="button" onclick="switchApp('renal')">Mở app hiệu chỉnh liều</button></div>
    <p style="font-size:11px;color:var(--muted);margin-top:8px">Chỉ là gợi ý tham khảo ban đầu — quyết định cuối cùng cần đối chiếu phác đồ bệnh viện, kháng sinh đồ thực tế của người bệnh và đánh giá lâm sàng.</p>
  `;
}

/** Gợi ý tên vi khuẩn khi gõ vào ô "Tra theo vi khuẩn đã định danh" — lấy đúng tên thật có trong
    tab VIKHUAN_KHANGSINH, để người dùng chọn thay vì phải gõ chính xác tuyệt đối (tránh trường hợp
    gõ tắt như "E.coli" hoặc gõ sai chính tả không khớp được với "Escherichia coli" trong Sheet). */
function renderOrganismSuggestions(query){
  const box=$("organismSuggestions");
  if(!box) return;
  if(!antibioticLoaded){
    loadAntibioticData().then(()=>renderOrganismSuggestions($("organismKeyword").value));
    return;
  }
  const q=String(query||"").trim().toLowerCase();
  if(!q){ box.innerHTML=""; box.classList.remove("show"); return; }

  const names=[...new Set(vikhuanKhangsinhData.map(r=>r.VI_KHUAN))].filter(Boolean);
  const matched=names
    .filter(n=>n.toLowerCase().includes(q))
    .sort((a,b)=>{
      const al=a.toLowerCase(),bl=b.toLowerCase();
      const aStarts=al.startsWith(q),bStarts=bl.startsWith(q);
      if(aStarts!==bStarts) return aStarts?-1:1;
      return al.localeCompare(bl);
    })
    .slice(0,8);

  if(!matched.length){
    box.innerHTML=`<div class="orgSuggestEmpty">Không tìm thấy tên khớp trong dữ liệu tham khảo — vẫn có thể bấm "Tra" để thử tìm chuỗi con.</div>`;
    box.classList.add("show");
    return;
  }
  box.innerHTML=matched.map(n=>`<div class="orgSuggestItem" onclick='selectOrganismSuggestion(${JSON.stringify(n).replace(/'/g,"&#39;")})'>${escapeHtml(n)}</div>`).join("");
  box.classList.add("show");
}

/** Bấm chọn 1 gợi ý → điền đúng tên chuẩn vào ô input, đóng dropdown, và tra luôn. */
function selectOrganismSuggestion(name){
  hideOrganismSuggestions();
  searchByOrganism(name);
}

function hideOrganismSuggestions(){
  const box=$("organismSuggestions");
  if(box){ box.innerHTML=""; box.classList.remove("show"); }
}

/** Tra ngược: gõ tên vi khuẩn đã định danh (từ kết quả kháng sinh đồ) → JOIN thẳng sang VIKHUAN_KHANGSINH,
    đồng thời cho biết vi khuẩn này thường gặp ở (những) vị trí nào theo VITRI_VIKHUAN. */
function searchByOrganism(nameFromParser){
  hideOrganismSuggestions();
  const q=(nameFromParser!==undefined? nameFromParser : $("organismKeyword").value).trim().toLowerCase();
  if(nameFromParser!==undefined) $("organismKeyword").value=nameFromParser;
  const container=$("organismResults");
  if(!antibioticLoaded){ loadAntibioticData().then(()=>searchByOrganism(q)); container.innerHTML="Đang tải dữ liệu…"; return; }
  if(!q){ container.innerHTML=""; return; }

  const matchedOrganisms=[...new Set(vikhuanKhangsinhData.filter(r=>String(r.VI_KHUAN||"").toLowerCase().includes(q)).map(r=>r.VI_KHUAN))];
  if(!matchedOrganisms.length){
    container.innerHTML=`<div class="resultItem"><b>Không thấy trong dữ liệu tham khảo</b><small>Chưa có vi khuẩn này trong tab VIKHUAN_KHANGSINH — vẫn ưu tiên đọc trực tiếp kết quả kháng sinh đồ (mục bên dưới).</small></div>`;
    return;
  }
  container.innerHTML=matchedOrganisms.map(name=>{
    const abx=antibioticsForOrganism(name);
    const sites=[...new Set(vitriVikhuanData.filter(r=>String(r.VI_KHUAN||"").toLowerCase()===name.toLowerCase()).map(r=>r.HE_CO_QUAN))];
    return `<article class="resultItem">
      <b>${escapeHtml(name)}</b>
      <small>${sites.length?"Thường gặp ở: "+sites.map(escapeHtml).join(", "):"Chưa gắn với vị trí nào trong VITRI_VIKHUAN"}${abx.length?" · Nháy vào tên kháng sinh để xem liều thường gặp":""}</small>
      <div class="tagRow">${abx.map(abxTag).join("")}</div>
    </article>`;
  }).join("");
}

/* ---------------- Phân tích nhanh kháng sinh đồ (client-side, không lưu) ----------------
   Dữ liệu dán vào thường KHÔNG "mỗi kháng sinh 1 dòng" như bảng gốc — khi copy từ phần mềm
   xét nghiệm/PDF, nhiều kháng sinh hay bị dồn chung 1 dòng, mất dấu cách, hoặc toán tử so
   sánh bị lặp lỗi (<<=, <<<=). Vì vậy khâu phân tích gồm 2 bước tách biệt:
     1) extractOrganism() — chỉ đọc riêng dòng "Vi khuẩn định danh: ..." và cắt trước các nhãn
        trường tiếp theo (Số lượng, Loại bệnh phẩm...) để không dính rác vào tên vi khuẩn.
     2) parseAntibiogramEntries() — gộp toàn văn bản thành 1 chuỗi, cắt đúng vùng bảng kết quả
        (từ sau "Phiên giải" đến trước "Ghi chú"), rồi quét theo mẫu
        (nhóm) (tên kháng sinh) (toán tử tùy chọn) (giá trị tùy chọn) (S/I/R) — không phụ thuộc
        ranh giới dòng hay khoảng trắng có/không giữa các phần. */

function extractOrganism(raw){
  const orgLine=raw.split(/\r?\n/).find(l=>/vi\s*khu[aẩ]n[^:]*:/i.test(l));
  if(!orgLine) return "";
  const m=orgLine.match(/vi\s*khu[aẩ]n[^:]*:\s*(.+)/i);
  if(!m) return "";
  let cap=m[1];
  const stopMarkers=/số\s*lượng|loại\s*bệnh\s*phẩm|kết\s*quả\s*kháng\s*sinh|kết\s*quả\s*nuôi/i;
  const sm=cap.match(stopMarkers);
  if(sm) cap=cap.slice(0,sm.index);
  return cap.trim().replace(/[.,;:]+$/,"");
}

function parseAntibiogramEntries(raw){
  const norm=raw.replace(/\r?\n/g," ").replace(/\s+/g," ").trim();
  const lower=norm.toLowerCase();
  const headerIdx=lower.indexOf("phiên giải");
  const footerIdx=lower.indexOf("ghi chú",headerIdx>=0?headerIdx:0);
  const tableText=norm.slice(headerIdx>=0?headerIdx+"phiên giải".length:0,footerIdx>=0?footerIdx:norm.length);
  const entryRe=/(?:^|\s)(\d|U)\s+([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ\/\-\.]*(?:\s+[A-Za-zÀ-ỹ][A-Za-zÀ-ỹ\/\-\.]*)*?)\s*([<>=]{1,4})?\s*(\d+(?:\.\d+)?)?\s*(SDD|S|I|R)(?=\s|$)/gi;
  const rows=[];
  let m;
  while((m=entryRe.exec(tableText))!==null){
    rows.push({group:m[1].toUpperCase(),name:m[2].trim(),op:m[3]||"",mic:m[4]||"",result:m[5].toUpperCase()});
  }
  return rows;
}

function analyzeAntibiogram(){
  const raw=$("ksdoText").value;
  const out=$("ksdoAnalysis");
  if(!raw.trim()){
    out.innerHTML=`<div class="resultItem"><b>Chưa có nội dung</b><small>Dán đoạn kết quả kháng sinh đồ vào ô phía trên rồi bấm Phân tích.</small></div>`;
    return;
  }

  const organism=extractOrganism(raw);
  const rows=parseAntibiogramEntries(raw);

  if(!rows.length){
    out.innerHTML=`<div class="resultItem"><b>Không nhận diện được kết quả nào</b><small>Cần có: nhóm ưu tiên (1/2/3/4/U), tên kháng sinh và kết quả S/I/R trong đoạn dán — không bắt buộc đúng định dạng từng dòng. Vẫn có thể đọc thủ công phần bạn dán ở trên.</small></div>`;
    return;
  }

  const S=rows.filter(r=>r.result==="S");
  const I=rows.filter(r=>r.result==="I");
  const R=rows.filter(r=>r.result==="R");

  const pill=(r)=>{
    const micLabel=r.mic?`${r.op}${r.mic}`:"";
    return `<span class="tag ${r.result==="S"?"ok":r.result==="R"?"danger":""}">${escapeHtml(r.name)}${micLabel?` (${escapeHtml(micLabel)})`:""}</span>`;
  };

  out.innerHTML=`
    ${organism?`<div class="resultItem"><b>Vi khuẩn định danh: ${escapeHtml(organism)}</b><small>Tự nhận diện từ đoạn text dán vào — kiểm tra lại cho chắc.</small>
      <div class="formActions"><button type="button" onclick='searchByOrganism(${JSON.stringify(organism).replace(/'/g,"&#39;")})'>Tra kháng sinh đề xuất theo vi khuẩn này</button></div>
    </div>`:""}
    <div class="resultItem">
      <b>Nhạy (S) — ${S.length} kháng sinh</b>
      <small>Ưu tiên cân nhắc trong nhóm này</small>
      <div class="tagRow">${S.length?S.map(pill).join(""):"<span class=\"tag\">Không có</span>"}</div>
    </div>
    <div class="resultItem">
      <b>Trung gian (I) — ${I.length} kháng sinh</b>
      <small>Cân nhắc theo liều/phơi nhiễm phù hợp nếu cần dùng</small>
      <div class="tagRow">${I.length?I.map(pill).join(""):"<span class=\"tag\">Không có</span>"}</div>
    </div>
    <div class="resultItem">
      <b>Kháng (R) — ${R.length} kháng sinh</b>
      <small>Tránh sử dụng nếu không có lý do đặc biệt</small>
      <div class="tagRow">${R.length?R.map(pill).join(""):"<span class=\"tag\">Không có</span>"}</div>
    </div>
    <p style="font-size:11px;color:var(--muted)">Kết quả chỉ hiển thị tạm thời trên trình duyệt của bạn, không được lưu lại hay gửi đi bất kỳ đâu. Tải lại trang là mất, không ảnh hưởng dữ liệu chung.</p>
  `;
}
