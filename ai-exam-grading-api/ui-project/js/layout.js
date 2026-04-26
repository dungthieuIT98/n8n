(function () {
  const PRIVATE_NAV_ITEMS = [
    { id: "dashboard", href: "index.html", label: "Tong quan" },
    { id: "upload", href: "upload.html", label: "Upload de thi" },
    { id: "exams", href: "exams.html", label: "Quan ly de thi" },
    { id: "results", href: "results.html", label: "Ket qua cham" },
    { id: "logs", href: "logs.html", label: "Log he thong" },
    { id: "admin", href: "admin.html", label: "Admin (Lop/Mon/Dot)" }
  ];

  const PUBLIC_NAV_ITEMS = [
    { id: "student", href: "student.html", label: "Tra cuu sinh vien" },
    { id: "submission", href: "submission.html", label: "Nop bai lam" }
  ];

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }

  function renderNav(page) {
    const nav = document.getElementById("nav");
    if (!nav) return;

    const currentTeacher = window.AppState.getCurrentTeacher();
    const navItems = currentTeacher ? PRIVATE_NAV_ITEMS : PUBLIC_NAV_ITEMS;

    nav.innerHTML = navItems.map((item) => {
      const isActive = item.id === page;
      return `
        <a
          href="${item.href}"
          class="block px-3 py-2 rounded-lg text-sm font-semibold ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}"
        >
          ${item.label}
        </a>
      `;
    }).join("");
  }

  function init() {
    const page = document.body.dataset.page;
    window.AppState.ensurePageAccess(page);
    renderNav(page);

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

    // Modal close handlers
    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        const modalId = button.dataset.closeModal;
        closeModal(modalId);
      });
    });

    // Close modal when clicking overlay
    document.querySelectorAll("[data-modal-overlay]").forEach((overlay) => {
      overlay.addEventListener("click", () => {
        const modal = overlay.closest("[data-modal]");
        if (modal) {
          closeModal(modal.id);
        }
      });
    });

    // Close modal on ESC key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const openModals = Array.from(document.querySelectorAll("[data-modal]")).filter((m) => !m.classList.contains("hidden"));
        if (openModals.length === 0) return;
        const lastModal = openModals[openModals.length - 1];
        closeModal(lastModal.id);
      }
    });
  }

  window.AppLayout = { init, openModal, closeModal };
})();