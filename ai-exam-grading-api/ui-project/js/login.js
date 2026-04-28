document.addEventListener("DOMContentLoaded", () => {
  window.AppState.ensurePageAccess("login");

  const form = document.getElementById("login-form");
  const message = document.getElementById("login-message");

  document.getElementById("demo-login-btn").addEventListener("click", () => {
    form.elements.identity.value = "teacher01@school.edu.vn";
    form.elements.password.value = "Demo123";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const identity = form.elements.identity.value.trim().toLowerCase();
    const password = form.elements.password.value;

    submitButton.disabled = true;
    message.innerHTML = '<div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">Đang xác thực tài khoản...</div>';

    try {
      const payload = await window.AppApi.login(identity, password);
      window.AppState.setSession(payload.token, payload.teacher);
      message.innerHTML = '<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Đăng nhập thành công. Đang chuyển sang bảng điều khiển.</div>';
      window.setTimeout(() => {
        window.location.href = "index.html";
      }, 400);
    } catch (error) {
      message.innerHTML = `<div class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">${error.message}</div>`;
    } finally {
      submitButton.disabled = false;
    }
  });
});