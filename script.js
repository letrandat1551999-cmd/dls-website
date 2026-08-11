// URL Web App Google Apps Script của bạn
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzk2LUh-SeJfpfMlENiiqDb0Q3DK2dyrD6z3xSxFM-XtlQcn2KiXQa1Ce1eX1kIpVIZfg/exec";

function toggleMenu(){
  document.getElementById("nav").classList.toggle("open");
}

document.querySelectorAll("#nav a").forEach(a=>{
  a.addEventListener("click",()=>{
    document.getElementById("nav").classList.remove("open");
  });
});

function toast(message){
  const t=document.getElementById("toast");
  t.textContent=message;
  t.classList.add("show");
  clearTimeout(window._toast);
  window._toast=setTimeout(()=>t.classList.remove("show"),2400);
}

function coming(name){
  toast(name+" sẽ được kết nối ở bước tiếp theo.");
}

function loadReport(){
  const frame=document.getElementById("reportFrame");
  const external=document.getElementById("openExternal");
  frame.src=APPS_SCRIPT_URL;
  external.href=APPS_SCRIPT_URL;
}

function reloadReport(){
  const frame=document.getElementById("reportFrame");
  frame.src=APPS_SCRIPT_URL;
  toast("Đã tải lại ứng dụng báo cáo.");
}

function fullscreenReport(){
  const box=document.getElementById("reportFrameWrap");
  if(box.requestFullscreen){
    box.requestFullscreen();
  }else{
    toast("Trình duyệt không hỗ trợ chế độ toàn màn hình.");
  }
}

function doSearch(){
  const v=document.getElementById("keyword").value.trim();
  document.getElementById("result").textContent=
    v ? `Đã nhận từ khóa “${v}”. Module tra cứu sẽ được kết nối tiếp theo.` :
    "Nhập từ khóa để bắt đầu.";
}

document.addEventListener("DOMContentLoaded",loadReport);
