const APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbzk2LUh-SeJfpfMlENiiqDb0Q3DK2dyrD6z3xSxFM-XtlQcn2KiXQa1Ce1eX1kIpVIZfg/exec";
function toggleMenu(){document.getElementById("nav").classList.toggle("open")}
document.querySelectorAll("#nav a").forEach(a=>a.addEventListener("click",()=>document.getElementById("nav").classList.remove("open")));
function toast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");clearTimeout(window._t);window._t=setTimeout(()=>t.classList.remove("show"),2400)}
function coming(n){toast(n+" sẽ được kết nối ở bước tiếp theo.")}
function openReport(){if(!APPS_SCRIPT_URL){toast("Chưa cấu hình URL Apps Script trong script.js.");return}location.href=APPS_SCRIPT_URL}
function doSearch(){const v=document.getElementById("keyword").value.trim();document.getElementById("result").textContent=v?`Đã nhận từ khóa “${v}”. Module tra cứu sẽ được kết nối tiếp theo.`:"Nhập từ khóa để bắt đầu."}
