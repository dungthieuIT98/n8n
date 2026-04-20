(function () {
  const PRIVATE_NAV_ITEMS = [
    { id: "dashboard", href: "index.html", label: "Tong quan" },
    { id: "upload", href: "upload.html", label: "Upload de thi" },
    { id: "exams", href: "exams.html", label: "Quan ly de thi" },
    { id: "results", href: "results.html", label: "Ket qua cham" },
    { id: "logs", href: "logs.html", label: "Log he thong" }
  ];

  const PUBLIC_NAV_ITEMS = [
    { id: "student", href: "student.html", label: "Tra cuu sinh vien" },
    { id: "submission", href: "submission.html", label: "Nop bai lam" }
  ];

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("open");
      document.body.style.overflow = "";
    }
  }

  function decorateButtons(root) {
    root.querySelectorAll("button, .button-link").forEach((element) => {
      element.classList.add("btn");

      if (element.classList.contains("secondary")) {
        element.classList.add("btn-outline-secondary");
        return;
      }

      if (element.classList.contains("warning")) {
        element.classList.add("btn-warning");
        return;
      }

      if (element.classList.contains("danger")) {
        element.classList.add("btn-danger");
        return;
      }

      if (element.classList.contains("ghost")) {
        element.classList.add("btn-light");
        return;
      }

      element.classList.add("btn-primary");
    });
  }

  function decorateForms(root) {
    root.querySelectorAll("input:not([type='file']):not([type='checkbox']):not([type='radio']), textarea").forEach((element) => {
      element.classList.add("form-control");
    });

    root.querySelectorAll("select").forEach((element) => {
      element.classList.add("form-select");
    });

    root.querySelectorAll("input[type='file']").forEach((element) => {
      element.classList.add("form-control");
    });
  }

  function decorateTables(root) {
    root.querySelectorAll("table").forEach((table) => {
      table.classList.add("table", "table-hover", "align-middle", "mb-0");
    });

    root.querySelectorAll(".table-wrapper").forEach((wrapper) => {
      wrapper.classList.add("table-responsive");
    });
  }

  function decorateCards(root) {
    root.querySelectorAll(".panel, .detail-card, .summary-card, .login-card, .auth-side-card, .auth-card, .section, .hero").forEach((element) => {
      element.classList.add("card", "border-0");
    });
  }

  function applyBootstrapClasses() {
    const root = document.body;
    decorateButtons(root);
    decorateForms(root);
    decorateTables(root);
    decorateCards(root);
  }

  function init() {
    const page = document.body.dataset.page;
    window.AppState.ensurePageAccess(page);
    const nav = document.getElementById("nav");
    if (nav) {
      const currentTeacher = window.AppState.getCurrentTeacher();
      const navItems = currentTeacher ? PRIVATE_NAV_ITEMS : PUBLIC_NAV_ITEMS;

      nav.innerHTML = navItems.map((item) => (
        `<a href="${item.href}" class="nav-link ${item.id === page ? "active" : ""}">${item.label}</a>`
      )).join("");
    }

    nav?.classList.add("nav-pills", "flex-column");

    const currentTeacher = window.AppState.getCurrentTeacher();
    const userLabel = document.getElementById("current-user-label");
    if (userLabel) {
      userLabel.textContent = currentTeacher
        ? `Dang nhap: ${currentTeacher.full_name} (${currentTeacher.teacher_code})`
        : "Chua dang nhap";
    }

    document.querySelectorAll(".js-logout").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          if (window.AppState.getAuthToken()) {
            await window.AppApi.logout();
          }
        } catch (error) {
          console.error(error);
        } finally {
          window.AppState.clearSession();
          window.location.href = "login.html";
        }
      });
    });

    applyBootstrapClasses();

    // Modal close handlers
    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        const modalId = button.dataset.closeModal;
        closeModal(modalId);
      });
    });

    // Close modal when clicking overlay
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", () => {
        const modal = overlay.closest(".modal");
        if (modal) {
          closeModal(modal.id);
        }
      });
    });

    // Close modal on ESC key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const openModals = document.querySelectorAll(".modal.open");
        if (openModals.length > 0) {
          const lastModal = openModals[openModals.length - 1];
          closeModal(lastModal.id);
        }
      }
    });
  }

  window.AppLayout = { init, openModal, closeModal };
})();