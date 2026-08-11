// Dán URL Web App Google Apps Script của bạn vào đây.
// Phải là URL dạng: https://script.google.com/macros/s/XXXXX/exec
const APPS_SCRIPT_URL = "";

const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");

menuToggle?.addEventListener("click", () => {
  nav.classList.toggle("open");
});

document.querySelectorAll(".nav a").forEach(link => {
  link.addEventListener("click", () => nav.classList.remove("open"));
});

function showNotice(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function openAppsScript() {
  if (!APPS_SCRIPT_URL) {
    showNotice("Bạn chưa cấu hình URL Apps Script trong file script.js.");
    return;
  }
  window.location.href = APPS_SCRIPT_URL;
}

function quickSearch() {
  const value = document.getElementById("searchInput").value.trim();
  const message = document.getElementById("searchMessage");

  if (!value) {
    message.textContent = "Hãy nhập nội dung cần tìm.";
    return;
  }

  message.textContent = `Đã nhận từ khóa “${value}”. Module tra cứu sẽ được kết nối ở bước tiếp theo.`;
}
