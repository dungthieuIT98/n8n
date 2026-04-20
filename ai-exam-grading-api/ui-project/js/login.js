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
    message.innerHTML = '<div class="message">Dang xac thuc tai khoan...</div>';

    try {
      const payload = await window.AppApi.login(identity, password);
      window.AppState.setSession(payload.token, payload.teacher);
      message.innerHTML = '<div class="message success">Dang nhap thanh cong. Dang chuyen sang dashboard.</div>';
      window.setTimeout(() => {
        window.location.href = "index.html";
      }, 400);
    } catch (error) {
      message.innerHTML = `<div class="message error">${error.message}</div>`;
    } finally {
      submitButton.disabled = false;
    }
  });
});