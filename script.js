const APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzk2LUh-SeJfpfMlENiiqDb0Q3DK2dyrD6z3xSxFM-XtlQcn2KiXQa1Ce1eX1kIpVIZfg/exec";
const RENAL_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzmrMFkvj35fryuGdzFT4ByH4PjYi6S6Peovm2xbajFds2nmK9KHUcm3TYX8KAFPnhe/exec";
const SGLT2_SCRIPT_URL="https://script.google.com/macros/s/AKfycbwAEZenu5dyxuzWSLth2esgN5S_bxbwmZhK5hZ63l-l-FK2xF5kDneL_XfZZdV5mGKc4A/exec";
const APP_URLS={report:APPS_SCRIPT_URL,renal:RENAL_SCRIPT_URL,sglt2:SGLT2_SCRIPT_URL};
const APP_LABELS={report:"Báo cáo thuốc ngoại trú",renal:"Hiệu chỉnh liều kháng sinh",sglt2:"Quản lý BN SGLT2"};
let pendingRenalData=null;

/* ===== Tra cứu: nguồn dữ liệu Google Sheet (không hardcode) =====
   1) Tạo 1 Google Sheet với 4 tab tên đúng: THUOC, HOATCHAT, ICD, TUONGTAC
      (import file DLS_TraCuu.xlsx đã chuẩn hoá sẵn 4 tab này).
   2) Chia sẻ Sheet ở chế độ "Anyone with the link – Viewer".
   3) Copy ID Sheet trong URL: docs.google.com/spreadsheets/d/<ID>/edit → dán vào SEARCH_SHEET_ID.
   Sau đó chỉnh sửa trực tiếp trên Google Sheet sẽ tự cập nhật lên web (không cần sửa code, tải lại trang là thấy). */
const SEARCH_SHEET_ID="198BvFJQlXxOE3xpQGomim0QTQ1Bc7Lsl";
const SEARCH_TABS={thuoc:"THUOC",hoatchat:"HOATCHAT",icd:"ICD",tuongtac:"TUONGTAC"};
let searchIndex=[];
let searchLoaded=false;
let searchLoading=false;

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
    subtitle:[r.HOAT_CHAT,r.NHOM_TAC_DUNG].filter(Boolean).join(" · "),
    body:[r.HAM_LUONG?`Hàm lượng: ${r.HAM_LUONG}.`:"",r.TDKMM?`TDKMM: ${r.TDKMM}`:""].filter(Boolean).join(" "),
    tags:[r.NHOM_TAC_DUNG,r.HAM_LUONG].filter(Boolean),
    link:r.LINK_TOA||"",
    linkLabel:"Xem toa"
  };
}
function mapHoatchat(r){
  return {
    type:"hoatchat",
    title:String(r.HOAT_CHAT||"").trim(),
    subtitle:r.NHOM_TAC_DUNG||"",
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
    $("searchResults").innerHTML=`<div class="resultItem"><b>Chưa cấu hình nguồn dữ liệu</b><small>Dán ID Google Sheet vào biến SEARCH_SHEET_ID trong script.js (xem hướng dẫn trong README.md).</small></div>`;
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
    $("searchResults").innerHTML=`<div class="resultItem"><b>Không tải được dữ liệu từ Google Sheet</b><small>Kiểm tra quyền chia sẻ (Anyone with the link – Viewer) và SEARCH_SHEET_ID trong script.js.</small></div>`;
  }finally{
    searchLoading=false;
  }
}

const antibioticGuides={
  cap:{
    title:"Viêm phổi cộng đồng",
    bullets:["Đánh giá mức độ nặng, bệnh nền và nguy cơ vi khuẩn kháng thuốc.","Lựa chọn thường gặp: beta-lactam ± macrolid hoặc fluoroquinolon hô hấp tùy bối cảnh.","Rà soát sau 48–72 giờ để xuống thang khi có đáp ứng và dữ liệu vi sinh."],
    tags:["CAP","xuống thang","48–72 giờ"]
  },
  uti:{
    title:"Nhiễm khuẩn tiết niệu",
    bullets:["Phân biệt viêm bàng quang, viêm thận-bể thận, nhiễm khuẩn phức tạp hoặc liên quan catheter.","Ưu tiên kháng sinh theo kháng sinh đồ và khả năng đạt nồng độ nước tiểu.","Hiệu chỉnh liều theo CrCl với nhiều beta-lactam, quinolon, aminoglycosid."],
    tags:["UTI","CrCl","cấy nước tiểu"]
  },
  skin:{
    title:"Nhiễm khuẩn da mô mềm",
    bullets:["Đánh giá mủ/không mủ, hoại tử, nguy cơ MRSA và mức độ nặng.","Nguồn thường gặp: Streptococcus, Staphylococcus aureus; cân nhắc MRSA khi có yếu tố nguy cơ.","Can thiệp ngoại khoa/dẫn lưu khi có ổ mủ là phần quan trọng của điều trị."],
    tags:["SSTI","MRSA","dẫn lưu"]
  },
  intra:{
    title:"Nhiễm khuẩn ổ bụng",
    bullets:["Đánh giá nhiễm khuẩn cộng đồng hay bệnh viện và nhu cầu kiểm soát ổ nhiễm.","Cần bao phủ Gram âm đường ruột và kỵ khí; mở rộng phổ khi có nguy cơ ESBL/Pseudomonas.","Rút ngắn thời gian điều trị khi kiểm soát ổ nhiễm tốt và đáp ứng lâm sàng."],
    tags:["ổ bụng","kỵ khí","source control"]
  }
};

const susceptibilityAntibiotics=["Ampicillin","Ceftriaxone","Ceftazidime","Piperacillin/tazobactam","Meropenem","Ciprofloxacin","Amikacin","Vancomycin"];

const docs=[
  {type:"guide",title:"Hướng dẫn sử dụng kháng sinh an toàn",desc:"Khung tham khảo lựa chọn, đánh giá đáp ứng và xuống thang kháng sinh.",link:"#antibiotic"},
  {type:"guide",title:"Hướng dẫn hiệu chỉnh liều theo chức năng thận",desc:"Quy trình dùng CrCl/eGFR để rà soát liều thuốc cần chỉnh.",link:"#tools"},
  {type:"sop",title:"SOP cung cấp thông tin thuốc",desc:"Các bước tiếp nhận, xử lý, phản hồi và lưu vết yêu cầu thông tin thuốc.",link:"#docs"},
  {type:"sop",title:"SOP theo dõi phản ứng có hại của thuốc",desc:"Quy trình ghi nhận, đánh giá, báo cáo và phản hồi ADR.",link:"#docs"},
  {type:"form",title:"Phiếu tư vấn sử dụng thuốc",desc:"Biểu mẫu ghi nhận nội dung tư vấn và khuyến cáo cho người bệnh.",link:"#docs"},
  {type:"policy",title:"Văn bản quản lý sử dụng thuốc",desc:"Nhóm văn bản, quy định và hướng dẫn liên quan hoạt động Dược.",link:"#docs"}
];

function $(id){return document.getElementById(id)}
function numberValue(id){const value=parseFloat($(id)?.value);return Number.isFinite(value)?value:null}
function toggleMenu(){$("nav").classList.toggle("open")}
function toast(message){
  const element=$("toast");
  element.textContent=message;
  element.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>element.classList.remove("show"),2600);
}

function showPage(name){
  document.querySelectorAll(".page").forEach(page=>page.classList.remove("active"));
  const page=$("page-"+name);
  if(page) page.classList.add("active");
  document.querySelectorAll("[data-page]").forEach(item=>item.classList.toggle("active",item.dataset.page===name));
  $("nav").classList.remove("open");
  history.replaceState(null,"","#"+name);
  window.scrollTo({top:0,behavior:"smooth"});
  if(name==="search") loadSearchIndex();
}

function switchApp(name,params={}){
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

function scrMgDl(){
  const scr=numberValue("scr");
  if(!scr) return null;
  return $("scrUnit").value==="umol"?scr/88.4:scr;
}

function calculateAll(){
  const age=numberValue("age");
  const weight=numberValue("weight");
  const sex=$("sex")?.value || "male";
  const scr=scrMgDl();
  const crcl=calculateCrCl(age,weight,sex,scr);
  const egfr=calculateEgfr(age,sex,scr);
  const albumin=calculateAlbumin();
  $("crclResult").textContent=crcl?`${round(crcl,1)}`:"—";
  $("egfrResult").textContent=egfr?`${round(egfr,1)}`:"—";
  $("albuminResult").textContent=albumin?`${round(albumin,1)} g`:"—";
  renderRenalAssessment(crcl,egfr);
  updateRenalLink(crcl,egfr);
}

function calculateCrCl(age,weight,sex,scr){
  if(!age || !weight || !scr) return null;
  const result=((140-age)*weight)/(72*scr);
  return sex==="female"?result*.85:result;
}

function calculateEgfr(age,sex,scr){
  if(!age || !scr) return null;
  const isFemale=sex==="female";
  const k=isFemale ? .7 : .9;
  const alpha=isFemale?-.241:-.302;
  let result=142*Math.pow(Math.min(scr/k,1),alpha)*Math.pow(Math.max(scr/k,1),-1.2)*Math.pow(.9938,age);
  if(isFemale) result*=1.012;
  return result;
}

function calculateAlbumin(){
  const current=numberValue("albuminCurrent");
  const target=numberValue("albuminTarget");
  const weight=numberValue("weight");
  if(current===null || target===null || !weight || target<=current) return null;
  const diffGdl=$("albuminUnit").value==="gl"?(target-current)/10:target-current;
  return diffGdl*weight*.8;
}

function round(value,digits=1){return Math.round(value*Math.pow(10,digits))/Math.pow(10,digits)}

function renalDoseGroup(crcl){
  if(!crcl) return {label:"Chưa đủ dữ liệu",level:""};
  if(crcl>=90) return {label:"CrCl ≥90: chức năng thận bảo tồn",level:""};
  if(crcl>=60) return {label:"CrCl 60–89: giảm nhẹ",level:""};
  if(crcl>=30) return {label:"CrCl 30–59: giảm trung bình",level:"warn"};
  if(crcl>=15) return {label:"CrCl 15–29: giảm nặng",level:"danger"};
  return {label:"CrCl <15: rất nặng/lọc máu?",level:"danger"};
}

function egfrStage(egfr){
  if(!egfr) return {label:"Chưa đủ dữ liệu",level:""};
  if(egfr>=90) return {label:"G1: bình thường/cao",level:""};
  if(egfr>=60) return {label:"G2: giảm nhẹ",level:""};
  if(egfr>=45) return {label:"G3a: giảm nhẹ-vừa",level:"warn"};
  if(egfr>=30) return {label:"G3b: giảm vừa-nặng",level:"warn"};
  if(egfr>=15) return {label:"G4: giảm nặng",level:"danger"};
  return {label:"G5: suy thận giai đoạn cuối",level:"danger"};
}

function setStage(id,stage){
  const element=$(id);
  element.textContent=stage.label;
  element.classList.toggle("warn",stage.level==="warn");
  element.classList.toggle("danger",stage.level==="danger");
}

function renderRenalAssessment(crcl,egfr){
  const crclGroup=renalDoseGroup(crcl);
  const egfrGroup=egfrStage(egfr);
  setStage("crclStage",crclGroup);
  setStage("egfrStage",egfrGroup);
  if(!crcl && !egfr){
    $("renalAdvice").textContent="Nhập đủ tuổi, giới, cân nặng và creatinin để xem đánh giá chức năng thận.";
    return;
  }
  const doseText=crcl?`CrCl ${round(crcl,1)} mL/phút dùng ưu tiên cho hiệu chỉnh liều thuốc theo thận.`:"Chưa đủ dữ liệu CrCl để hiệu chỉnh liều thuốc.";
  const ckdText=egfr?`eGFR ${round(egfr,1)} mL/phút/1,73 m² tương ứng ${egfrGroup.label}.`:"Chưa đủ dữ liệu eGFR để phân tầng G.";
  $("renalAdvice").textContent=`${doseText} ${ckdText} Cần phối hợp albumin niệu, thời gian kéo dài ≥3 tháng và bối cảnh lâm sàng nếu đánh giá bệnh thận mạn.`;
}

function resetCalculators(){
  ["age","weight","scr","albuminCurrent","albuminTarget"].forEach(id=>$(id).value="");
  calculateAll();
  toast("Đã xóa dữ liệu công cụ tính toán.");
}

function updateRenalLink(crcl,egfr){
  const link=$("renalOpenLink");
  if(!link) return;
  const params={
    crcl:crcl?round(crcl,1):"",
    egfr:egfr?round(egfr,1):"",
    age:numberValue("age") || "",
    sex:$("sex")?.value || "",
    weight:numberValue("weight") || "",
    scr:numberValue("scr") || "",
    scrUnit:$("scrUnit")?.value || "",
    scrMgdl:scrMgDl()?round(scrMgDl(),2):"",
    source:"dls-portal"
  };
  link.href=buildAppUrl("renal",params);
}

function sendRenalData(){
  const age=numberValue("age");
  const weight=numberValue("weight");
  const sex=$("sex").value;
  const scr=scrMgDl();
  const crcl=calculateCrCl(age,weight,sex,scr);
  const egfr=calculateEgfr(age,sex,scr);
  if(!crcl){
    toast("Nhập tuổi, cân nặng và creatinin để truyền CrCl sang app hiệu chỉnh liều.");
    return;
  }
  const params={
    crcl:round(crcl,1),
    egfr:egfr?round(egfr,1):"",
    age:age || "",
    sex,
    weight:weight || "",
    scr:numberValue("scr") || "",
    scrUnit:$("scrUnit").value,
    scrMgdl:scr?round(scr,2):"",
    source:"dls-portal"
  };
  pendingRenalData=params;
  switchApp("renal",params);
  $("renalDataHint").textContent=`Đã nhận CrCl ${params.crcl} mL/phút${params.egfr?`, eGFR ${params.egfr} mL/phút/1,73 m²`:""}`;
  setTimeout(()=>postRenalData(params),900);
  toast("Đã chuyển sang app hiệu chỉnh liều và truyền số liệu qua URL/postMessage.");
}

function postRenalData(params){
  const frame=$("renalFrame");
  if(frame?.contentWindow) frame.contentWindow.postMessage({type:"DLS_RENAL_DATA",payload:params},"*");
}

const SEARCH_RESULT_LIMIT=60;

async function doSearch(){
  await loadSearchIndex();
  if(!searchLoaded) return;
  const keyword=($("keyword").value || "").trim().toLowerCase();
  const type=$("searchType").value;
  if(!keyword && type==="all"){
    renderSearchResults([],keyword,true);
    return;
  }
  const filtered=searchIndex.filter(item=>{
    const inType=type==="all" || item.type===type;
    if(!inType) return false;
    if(!keyword) return true;
    const haystack=[item.title,item.subtitle,item.body,...item.tags].join(" ").toLowerCase();
    return haystack.includes(keyword);
  });
  renderSearchResults(filtered.slice(0,SEARCH_RESULT_LIMIT),keyword);
  if(filtered.length>SEARCH_RESULT_LIMIT) toast(`Tìm thấy ${filtered.length} kết quả, hiển thị ${SEARCH_RESULT_LIMIT} kết quả đầu tiên.`);
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
  container.innerHTML=results.map(item=>`
    <article class="resultItem">
      <b>${item.title}</b>
      <small>${labelType(item.type)}${item.subtitle?` · ${item.subtitle}`:""}</small>
      ${item.body?`<p>${item.body}</p>`:""}
      ${(item.tags.length || item.link || item.statusTag)?`<div class="tagRow">${item.statusTag?`<span class="tag ${item.statusTag.cls}">${item.statusTag.text}</span>`:""}${item.tags.map(tag=>`<span class="tag">${tag}</span>`).join("")}${item.link?`<a class="tag" href="${item.link}" target="_blank" rel="noopener">${item.linkLabel||"Xem thêm"} ↗</a>`:""}</div>`:""}
      ${item.children && item.children.length?`
        <div class="icdChildren">
          <b>Mã chi tiết hơn thuộc nhóm ${item.title}:</b>
          <div class="icdChildRow">
            ${item.children.map(child=>`<span class="tag link" title="${child.subtitle.replace(/"/g,"&quot;")}" onclick="searchExact('${child.title}')">${child.title}</span>`).join("")}
          </div>
        </div>
      `:""}
    </article>
  `).join("");
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

function renderAntibioticGuide(){
  const data=antibioticGuides[$("infectionSite").value];
  $("antibioticGuide").innerHTML=`
    <b>${data.title}</b>
    <small>Gợi ý hỗ trợ lựa chọn ban đầu</small>
    <ul>${data.bullets.map(item=>`<li>${item}</li>`).join("")}</ul>
    <div class="tagRow">${data.tags.map(tag=>`<span class="tag">${tag}</span>`).join("")}</div>
    <div class="formActions"><button class="primary" type="button" onclick="showPage('tools')">Tính CrCl trước khi chỉnh liều</button><button type="button" onclick="switchApp('renal')">Mở app hiệu chỉnh liều</button></div>
  `;
}

function renderSusceptibilityGrid(){
  $("susGrid").innerHTML=susceptibilityAntibiotics.map(name=>`
    <label>
      <span>${name}</span>
      <select data-sus onchange="summarizeSusceptibility()">
        <option value="">—</option>
        <option value="S">S</option>
        <option value="I">I</option>
        <option value="R">R</option>
      </select>
    </label>
  `).join("");
  summarizeSusceptibility();
}

function summarizeSusceptibility(){
  const rows=[...document.querySelectorAll("[data-sus]")].map((select,index)=>({name:susceptibilityAntibiotics[index],value:select.value}));
  const susceptible=rows.filter(row=>row.value==="S").map(row=>row.name);
  const increased=rows.filter(row=>row.value==="I").map(row=>row.name);
  const resistant=rows.filter(row=>row.value==="R").map(row=>row.name);
  $("susSummary").innerHTML=`
    <b>Tóm tắt kháng sinh đồ</b>
    <small>Ưu tiên cân nhắc nhóm S, xem I theo liều/phơi nhiễm phù hợp, tránh nhóm R nếu không có lý do đặc biệt.</small>
    <div class="tagRow">
      <span class="tag">S: ${susceptible.length? susceptible.join(", "):"chưa nhập"}</span>
      <span class="tag">I: ${increased.length? increased.join(", "):"chưa nhập"}</span>
      <span class="tag">R: ${resistant.length? resistant.join(", "):"chưa nhập"}</span>
    </div>
  `;
}

function renderDocs(){
  const keyword=($("docKeyword").value || "").trim().toLowerCase();
  const type=$("docType").value;
  const filtered=docs.filter(doc=>{
    const inType=type==="all" || doc.type===type;
    const haystack=`${doc.title} ${doc.desc} ${doc.type}`.toLowerCase();
    return inType && (!keyword || haystack.includes(keyword));
  });
  $("docsGrid").innerHTML=filtered.map(doc=>`
    <article>
      <span class="tag">${docTypeLabel(doc.type)}</span>
      <b>${doc.title}</b>
      <p>${doc.desc}</p>
      <a href="${doc.link}">Mở nhóm liên quan →</a>
    </article>
  `).join("") || `<article><b>Chưa có tài liệu phù hợp</b><p>Thử đổi từ khóa hoặc nhóm tài liệu.</p></article>`;
}

function docTypeLabel(type){
  return {guide:"Hướng dẫn",sop:"Quy trình",form:"Biểu mẫu",policy:"Văn bản"}[type] || "Tài liệu";
}

function route(){
  const page=location.hash.replace("#","") || "home";
  const valid=["home","tools","search","antibiotic","apps","docs"];
  showPage(valid.includes(page)?page:"home");
}

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("[data-route]").forEach(link=>link.addEventListener("click",event=>{
    event.preventDefault();
    showPage(link.dataset.route);
  }));
  ["age","sex","weight","scr","scrUnit","albuminCurrent","albuminTarget","albuminUnit"].forEach(id=>$(id)?.addEventListener("input",calculateAll));
  let searchDebounce;
  $("keyword")?.addEventListener("input",()=>{clearTimeout(searchDebounce);searchDebounce=setTimeout(doSearch,220)});
  $("searchType")?.addEventListener("change",doSearch);
  $("docKeyword")?.addEventListener("input",renderDocs);
  $("docType")?.addEventListener("change",renderDocs);
  renderSearchResults([],"",true);
  if(location.hash.replace("#","")==="search") loadSearchIndex();
  renderAntibioticGuide();
  renderSusceptibilityGrid();
  renderDocs();
  route();
  const reportFrame=$("reportFrame");
  if(reportFrame && !reportFrame.src) reportFrame.src=APP_URLS.report;
  $("renalFrame")?.addEventListener("load",()=> {
    if(pendingRenalData) postRenalData(pendingRenalData);
  });
});

window.addEventListener("hashchange",route);