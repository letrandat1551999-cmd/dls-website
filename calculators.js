/* ===== calculators.js =====
   Công cụ tính CrCl (Cockcroft-Gault), eGFR (CKD-EPI 2021), Albumin cần bù.
   Đọc input từ trang "tools", hiển thị kết quả và (khi bấm) đẩy số liệu
   sang app "Hiệu chỉnh liều kháng sinh" qua switchApp() (core.js). */

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
  $("renalAdvice").textContent=`${doseText} ${ckdText} Cần phối đánh giá bối cảnh lâm sàng nếu đánh giá bệnh thận mạn.`;
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
