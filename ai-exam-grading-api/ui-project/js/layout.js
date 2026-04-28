(function () {
  const PRIVATE_NAV_ITEMS = [
    { id: "dashboard", href: "index.html", label: "Tổng quan" },
    { id: "upload", href: "upload.html", label: "Tải lên đề thi" },
    { id: "exams", href: "exams.html", label: "Quản lý đề thi" },
    { id: "results", href: "results.html", label: "Kết quả chấm" },
    { id: "logs", href: "logs.html", label: "Nhật ký hệ thống" },
    {
      id: "admin",
      label: "Quản lý danh mục",
      children: [
        { id: "admin-classes", href: "admin-classes.html", label: "Lớp học" },
        { id: "admin-subjects", href: "admin-subjects.html", label: "Môn học" },
        { id: "admin-periods", href: "admin-periods.html", label: "Đợt thi" }
      ]
    }
  ];

  const PUBLIC_NAV_ITEMS = [
    { id: "student", href: "student.html", label: "Tra cứu sinh viên" },
    { id: "submission", href: "submission.html", label: "Nộp bài làm" }
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

  function renderNavItem(item, page) {
    if (item.children) {
      const isChildActive = item.children.some((c) => c.id === page);
      const groupId = `nav-group-${item.id}`;
      const submenuId = `nav-submenu-${item.id}`;

      const children = item.children.map((c) => {
        const active = c.id === page;
        return `<a href="${c.href}" class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}">
          <span class="text-slate-400 text-xs">›</span>${c.label}
        </a>`;
      }).join("");

      return `
        <div id="${groupId}" class="select-none">
          <div
            class="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold cursor-default ${isChildActive ? "text-slate-900" : "text-slate-700 hover:bg-slate-100"}"
            id="${groupId}-trigger"
          >
            <span>${item.label}</span>
            <span class="text-slate-400 text-xs transition-transform" id="${submenuId}-arrow">▾</span>
          </div>
          <div id="${submenuId}" class="${isChildActive ? "" : "hidden"} pl-2 mt-0.5 space-y-0.5">
            ${children}
          </div>
        </div>
      `;
    }

    const isActive = item.id === page;
    return `<a href="${item.href}" class="block px-3 py-2 rounded-lg text-sm font-semibold ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}">${item.label}</a>`;
  }

  function renderNav(page) {
    const nav = document.getElementById("nav");
    if (!nav) return;

    const currentTeacher = window.AppState.getCurrentTeacher();
    const navItems = currentTeacher ? PRIVATE_NAV_ITEMS : PUBLIC_NAV_ITEMS;

    nav.innerHTML = navItems.map((item) => renderNavItem(item, page)).join("");

    // Bind hover toggle for group items
    navItems.forEach((item) => {
      if (!item.children) return;
      const groupEl = document.getElementById(`nav-group-${item.id}`);
      const submenuEl = document.getElementById(`nav-submenu-${item.id}`);
      if (!groupEl || !submenuEl) return;

      groupEl.addEventListener("mouseenter", () => {
        submenuEl.classList.remove("hidden");
      });
      groupEl.addEventListener("mouseleave", () => {
        const isChildActive = item.children.some((c) => c.id === page);
        if (!isChildActive) {
          submenuEl.classList.add("hidden");
        }
      });
    });
  }

  function init() {
    const page = document.body.dataset.page;
    window.AppState.ensurePageAccess(page);
    renderNav(page);

    const currentTeacher = window.AppState.getCurrentTeacher();
    const userLabel = document.getElementById("current-user-label");
    if (userLabel) {
      userLabel.textContent = currentTeacher
        ? `Đăng nhập: ${currentTeacher.full_name} (${currentTeacher.teacher_code})`
        : "Chưa đăng nhập";
    }

    document.querySelectorAll(".js-logout").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          if (window.AppState.getAuthToken()) await window.AppApi.logout();
        } catch (error) {
          console.error(error);
        } finally {
          window.AppState.clearSession();
          window.location.href = "login.html";
        }
      });
    });

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => closeModal(button.dataset.closeModal));
    });

    document.querySelectorAll("[data-modal-overlay]").forEach((overlay) => {
      overlay.addEventListener("click", () => {
        const modal = overlay.closest("[data-modal]");
        if (modal) closeModal(modal.id);
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const openModals = Array.from(document.querySelectorAll("[data-modal]")).filter((m) => !m.classList.contains("hidden"));
        if (openModals.length === 0) return;
        closeModal(openModals[openModals.length - 1].id);
      }
    });
  }

  window.AppLayout = { init, openModal, closeModal };
})();
