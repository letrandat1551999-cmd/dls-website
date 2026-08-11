const APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzk2LUh-SeJfpfMlENiiqDb0Q3DK2dyrD6z3xSxFM-XtlQcn2KiXQa1Ce1eX1kIpVIZfg/exec";
const RENAL_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzmrMFkvj35fryuGdzFT4ByH4PjYi6S6Peovm2xbajFds2nmK9KHUcm3TYX8KAFPnhe/exec";
const SGLT2_SCRIPT_URL="https://script.google.com/macros/s/AKfycbwAEZenu5dyxuzWSLth2esgN5S_bxbwmZhK5hZ63l-l-FK2xF5kDneL_XfZZdV5mGKc4A/exec";

const APP_URLS={report:APPS_SCRIPT_URL,renal:RENAL_SCRIPT_URL,sglt2:SGLT2_SCRIPT_URL};
const APP_LABELS={report:"Báo cáo thuốc ngoại trú",renal:"Hiệu chỉnh liều kháng sinh",sglt2:"Quản lý BN SGLT2"};

function toggleMenu(){document.getElementById("nav").classList.toggle("open")}
function toast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");clearTimeout(window._t);window._t=setTimeout(()=>t.classList.remove("show"),2400)}
function coming(n){toast(n+" sẽ được kết nối ở bước tiếp theo.")}

function switchApp(name){
  document.querySelectorAll(".appTab").forEach(b=>b.classList.toggle("active",b.dataset.app===name));
  document.querySelectorAll(".appPanel").forEach(p=>p.classList.toggle("active",p.id==="panel-"+name));
  const frame=document.getElementById(name+"Frame");
  if(frame && !frame.src) frame.src=APP_URLS[name];
  const apps=document.getElementById("apps");
  if(apps) setTimeout(()=>apps.scrollIntoView({behavior:"smooth",block:"start"}),30);
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

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("#nav a").forEach(a=>a.addEventListener("click",()=>document.getElementById("nav").classList.remove("open")));
  switchApp("report");
});
