// Dán URL Web App Google Apps Script của bạn vào đây.
// Ví dụ: https://script.google.com/macros/s/XXXXXXXX/exec
const APPS_SCRIPT_URL = "";

const menuBtn = document.querySelector(".menu-btn");
const nav = document.querySelector(".nav");
menuBtn?.addEventListener("click", () => nav.classList.toggle("open"));
document.querySelectorAll(".nav a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));

function notice(message){
  const t=document.getElementById("toast");
  t.textContent=message;t.classList.add("show");
  clearTimeout(window.__timer);
  window.__timer=setTimeout(()=>t.classList.remove("show"),2600);
}
function openApp(){
  if(!APPS_SCRIPT_URL){notice("Chưa cấu hình URL Apps Script trong script.js.");return;}
  window.location.href=APPS_SCRIPT_URL;
}
function search(){
  const v=document.getElementById("search").value.trim();
  document.getElementById("search-result").textContent =
    v ? `Từ khóa “${v}” đã được nhận. Module tra cứu sẽ được kết nối ở bước tiếp theo.` :
        "Nhập từ khóa để bắt đầu tra cứu.";
}
