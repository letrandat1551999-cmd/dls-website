const APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzk2LUh-SeJfpfMlENiiqDb0Q3DK2dyrD6z3xSxFM-XtlQcn2KiXQa1Ce1eX1kIpVIZfg/exec";
const RENAL_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzmrMFkvj35fryuGdzFT4ByH4PjYi6S6Peovm2xbajFds2nmK9KHUcm3TYX8KAFPnhe/exec";
const SGLT2_SCRIPT_URL="https://script.google.com/macros/s/AKfycbwAEZenu5dyxuzWSLth2esgN5S_bxbwmZhK5hZ63l-l-FK2xF5kDneL_XfZZdV5mGKc4A/exec";
const APP_URLS={report:APPS_SCRIPT_URL,renal:RENAL_SCRIPT_URL,sglt2:SGLT2_SCRIPT_URL};
const APP_LABELS={report:"Báo cáo thuốc ngoại trú",renal:"Hiệu chỉnh liều kháng sinh",sglt2:"Quản lý BN SGLT2"};

function toggleMenu(){document.getElementById("nav").classList.toggle("open")}
function toast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");clearTimeout(window._t);window._t=setTimeout(()=>t.classList.remove("show"),2300)}
function coming(n){toast(n+" sẽ được kết nối ở bước tiếp theo.")}

function showPage(name){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const page=document.getElementById("page-"+name);
  if(page) page.classList.add("active");
  document.querySelectorAll("[data-page]").forEach(a=>a.classList.toggle("active",a.dataset.page===name));
  document.getElementById("nav").classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
  if(name==="apps" && !document.querySelector(".appTab.active")) switchApp("report");
  history.replaceState(null,"","#"+name);
}

function switchApp(name){
  showPage("apps");
  document.querySelectorAll(".appTab").forEach(b=>b.classList.toggle("active",b.dataset.app===name));
  document.querySelectorAll(".appPanel").forEach(p=>p.classList.toggle("active",p.id==="panel-"+name));
  const frame=document.getElementById(name+"Frame");
  if(frame && !frame.src) frame.src=APP_URLS[name];
}

function reloadApp(name){
  const frame=document.getElementById(name+"Frame");
  if(frame){frame.src=APP_URLS[name];toast("Đã tải lại "+APP_LABELS[name]+".")}
}

function fullscreen(id){
  const e=document.getElementById(id);
  if(e && e.requestFullscreen)e.requestFullscreen();
  else toast("Trình duyệt không hỗ trợ toàn màn hình.");
}

function doSearch(){
  const v=document.getElementById("keyword").value.trim();
  document.getElementById("result").textContent=v?`Đã nhận từ khóa “${v}”. Module tra cứu sẽ được kết nối tiếp theo.`:"Nhập từ khóa để bắt đầu.";
}

function route(){
  const p=location.hash.replace("#","")||"home";
  const valid=["home","tools","search","antibiotic","apps","docs"];
  showPage(valid.includes(p)?p:"home");
}

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("#nav>a").forEach(a=>a.addEventListener("click",()=>document.getElementById("nav").classList.remove("open")));
  route();
  switchApp("report");
});
window.addEventListener("hashchange",route);