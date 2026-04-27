(function () {
  const USER_KEY = "ai-exam-grading-current-teacher";
  const TOKEN_KEY = "ai-exam-grading-auth-token";
  const PROTECTED_PAGES = new Set(["dashboard", "upload", "exams", "results", "logs", "admin", "grading-result"]);

  function getCurrentTeacher() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setSession(token, teacher) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(teacher));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function ensurePageAccess(page) {
    const currentTeacher = getCurrentTeacher();

    if (page === "login" && currentTeacher) {
      window.location.href = "index.html";
      return;
    }

    if (PROTECTED_PAGES.has(page) && !currentTeacher) {
      window.location.href = "login.html";
    }
  }

  window.AppState = {
    getCurrentTeacher,
    getAuthToken,
    setSession,
    clearSession,
    ensurePageAccess
  };
})();