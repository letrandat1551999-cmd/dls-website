const APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzk2LUh-SeJfpfMlENiiqDb0Q3DK2dyrD6z3xSxFM-XtlQcn2KiXQa1Ce1eX1kIpVIZfg/exec";
const SGLT2_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzmrMFkvj35fryuGdzFT4ByH4PjYi6S6Peovm2xbajFds2nmK9KHUcm3TYX8KAFPnhe/exec";
function toggleMenu(){document.getElementById("nav").classList.toggle("open")}
document.querySelectorAll("#nav a").forEach(a=>a.addEventListener("click",()=>document.getElementById("nav").classList.remove("open")));
function toast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");clearTimeout(window._t);window._t=setTimeout(()=>t.classList.remove("show"),2400)}
function coming(n){toast(n+" sẽ được kết nối ở bước tiếp theo.")}
function loadReport(){document.getElementById("reportFrame").src=APPS_SCRIPT_URL}
function loadSglt2(){document.getElementById("sglt2Frame").src=SGLT2_SCRIPT_URL}
function reloadReport(){document.getElementById("reportFrame").src=APPS_SCRIPT_URL;toast("Đã tải lại báo cáo.")}
function reloadSglt2(){document.getElementById("sglt2Frame").src=SGLT2_SCRIPT_URL;toast("Đã tải lại ứng dụng SGLT2.")}
function fullscreen(id){const e=document.getElementById(id);if(e&&e.requestFullscreen)e.requestFullscreen();else toast("Trình duyệt không hỗ trợ toàn màn hình.")}
function doSearch(){const v=document.getElementById("keyword").value.trim();document.getElementById("result").textContent=v?`Đã nhận từ khóa “${v}”. Module tra cứu sẽ được kết nối tiếp theo.`:"Nhập từ khóa để bắt đầu."}
document.addEventListener("DOMContentLoaded",()=>{loadReport();loadSglt2()});