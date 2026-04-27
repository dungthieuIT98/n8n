document.addEventListener("DOMContentLoaded", async () => {
  window.AppLayout.init();

  const PAGE_SIZE = 10;
  let currentPage = 1;
  let allExams = [];
  let filteredExams = [];
  let subjectsByCode = new Map();
  let masterDataLoaded = false;

  const classFilter = document.getElementById("exam-filter-class");
  const subjectFilter = document.getElementById("exam-filter-subject");
  const typeFilter = document.getElementById("exam-filter-type");
  const statusFilter = document.getElementById("exam-filter-status");

  window.AppUI.fillSelect(classFilter, window.AppUI.classOptions(), true);
  window.AppUI.fillSelect(subjectFilter, window.AppUI.subjectOptions(), true);
  window.AppUI.fillSelect(typeFilter, window.AppUI.examTypeOptions(), true);
  window.AppUI.fillSelect(statusFilter, window.AppUI.examStatusOptions(), true);

  ["exam-filter-class", "exam-filter-subject", "exam-filter-type", "exam-filter-status"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      currentPage = 1;
      applyFilters();
    });
  });

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function applyFilters() {
    const classCode = classFilter.value;
    const subjectCode = subjectFilter.value;
    const examType = typeFilter.value;
    const status = statusFilter.value;

    filteredExams = allExams.filter((exam) => (
      (!classCode || exam.class_code === classCode)
      && (!subjectCode || exam.subject_code === subjectCode)
      && (!examType || exam.exam_type === examType)
      && (!status || exam.status === status)
    ));

    renderTable();
    renderPagination();
  }

  function renderTable() {
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageExams = filteredExams.slice(start, start + PAGE_SIZE);

    if (!pageExams.length) {
      document.getElementById("exam-table-body").innerHTML = `
        <tr><td colspan="5" class="py-8 px-3 text-center text-slate-400 text-sm">Khong co de thi phu hop bo loc.</td></tr>
      `;
      return;
    }

    document.getElementById("exam-table-body").innerHTML = pageExams.map((exam) => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="py-2.5 px-3" style="max-width:220px">
          <div class="font-semibold text-sm truncate overflow-hidden whitespace-nowrap" title="${exam.title}">${exam.title}</div>
          <div class="text-xs text-slate-400 whitespace-nowrap">${exam.exam_code} &middot; v${exam.version}</div>
        </td>
        <td class="py-2.5 px-3 whitespace-nowrap">
          <div class="text-sm font-medium">${exam.class_code}</div>
          <div class="text-xs text-slate-500 max-w-[120px] truncate overflow-hidden" title="${exam.subject_name || exam.subject_code}">${exam.subject_name || exam.subject_code}</div>
        </td>
        <td class="py-2.5 px-3 whitespace-nowrap text-sm text-slate-600">${formatDate(exam.created_at)}</td>
        <td class="py-2.5 px-3 whitespace-nowrap">${window.AppUI.renderStatus(exam.status)}</td>
        <td class="py-2.5 px-3 whitespace-nowrap">
          <div class="flex items-center gap-1.5">
            <button class="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-semibold transition-colors" data-view-exam="${exam.id}">Xem</button>
            <button class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors" data-edit-exam="${exam.id}">Sua</button>
            <button class="px-2.5 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold transition-colors" data-delete-exam="${exam.id}">Xoa</button>
          </div>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll("[data-view-exam]").forEach((btn) => {
      btn.addEventListener("click", () => showDetail(btn.dataset.viewExam));
    });
    document.querySelectorAll("[data-edit-exam]").forEach((btn) => {
      btn.addEventListener("click", () => openUpdateModal(btn.dataset.editExam));
    });
    document.querySelectorAll("[data-delete-exam]").forEach((btn) => {
      btn.addEventListener("click", () => deleteExam(btn.dataset.deleteExam));
    });
  }

  function renderPagination() {
    const totalPages = Math.ceil(filteredExams.length / PAGE_SIZE);
    const pag = document.getElementById("exam-pagination");

    if (totalPages <= 1) {
      pag.innerHTML = `<span class="text-xs text-slate-500">${filteredExams.length} de thi</span>`;
      return;
    }

    // Build page range with ellipsis
    const range = [];
    const delta = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }
    const withEllipsis = [];
    let prev = null;
    for (const p of range) {
      if (prev !== null && p - prev > 1) withEllipsis.push("...");
      withEllipsis.push(p);
      prev = p;
    }

    pag.innerHTML = `
      <span class="text-xs text-slate-500">${filteredExams.length} de thi &middot; Trang ${currentPage}/${totalPages}</span>
      <div class="flex items-center gap-1 flex-wrap">
        <button ${currentPage === 1 ? "disabled" : ""} id="pag-prev" class="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">&#8249; Truoc</button>
        ${withEllipsis.map((p) => p === "..." ? `<span class="px-1 text-xs text-slate-400">...</span>` : `
          <button class="px-2.5 py-1 rounded-lg border text-xs font-semibold ${p === currentPage ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 hover:bg-slate-50"}" data-page="${p}">${p}</button>
        `).join("")}
        <button ${currentPage === totalPages ? "disabled" : ""} id="pag-next" class="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Sau &#8250;</button>
      </div>
    `;

    document.getElementById("pag-prev")?.addEventListener("click", () => {
      if (currentPage > 1) { currentPage--; renderTable(); renderPagination(); }
    });
    document.getElementById("pag-next")?.addEventListener("click", () => {
      if (currentPage < totalPages) { currentPage++; renderTable(); renderPagination(); }
    });
    pag.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentPage = Number(btn.dataset.page);
        renderTable();
        renderPagination();
      });
    });
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────
  function openModal(id) {
    const el = document.getElementById(id);
    el.classList.remove("hidden");
    el.classList.add("flex");
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    el.classList.add("hidden");
    el.classList.remove("flex");
  }

  document.getElementById("exam-modal-close").addEventListener("click", () => closeModal("exam-detail-modal"));
  document.getElementById("exam-detail-overlay").addEventListener("click", () => closeModal("exam-detail-modal"));
  document.getElementById("exam-update-close").addEventListener("click", () => closeModal("exam-update-modal"));
  document.getElementById("exam-update-cancel").addEventListener("click", () => closeModal("exam-update-modal"));
  document.getElementById("exam-update-overlay").addEventListener("click", () => closeModal("exam-update-modal"));

  // ── Detail Modal ───────────────────────────────────────────────────────────
  async function showDetail(examId) {
    document.getElementById("exam-modal-title").textContent = "Dang tai...";
    document.getElementById("exam-detail-content").innerHTML = `<p class="text-sm text-slate-400">Dang tai du lieu...</p>`;
    openModal("exam-detail-modal");

    try {
      const result = await window.AppApi.detail("exams", examId);
      const exam = result.data;

      document.getElementById("exam-modal-title").textContent = exam.title;
      document.getElementById("exam-detail-content").innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Ma de thi</div>
              <div class="font-bold text-sm mt-0.5">${exam.exam_code}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Phien ban</div>
              <div class="font-bold text-sm mt-0.5">v${exam.version}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Trang thai</div>
              <div class="mt-0.5">${window.AppUI.renderStatus(exam.status)}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Lop / Mon</div>
              <div class="font-bold text-sm mt-0.5 truncate" title="${exam.class_code} / ${exam.subject_name || exam.subject_code}">${exam.class_code} / ${exam.subject_name || exam.subject_code}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Loai / Dot</div>
              <div class="font-bold text-sm mt-0.5">${exam.exam_type} / ${exam.exam_round}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Nguoi tao</div>
              <div class="font-bold text-sm mt-0.5 truncate" title="${exam.teacher_name}">${exam.teacher_name}</div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 p-3 text-sm">
            <div class="font-semibold mb-1">Mo ta</div>
            <div class="text-slate-600">${exam.description || "Chua co mo ta"}</div>
          </div>

          <div class="rounded-xl border border-slate-200 p-3 text-sm">
            <div class="font-semibold mb-2">File</div>
            <div class="space-y-1 text-slate-600 text-xs">
              <div><span class="font-semibold text-slate-800">De thi:</span> ${exam.question_file_path || "-"}</div>
              <div><span class="font-semibold text-slate-800">Dap an:</span> ${exam.answer_file_path || "-"}</div>
            </div>
          </div>

          ${exam.answer_extract ? `
          <div class="rounded-xl border border-slate-200 p-3 text-sm">
            <div class="font-semibold mb-2">Ket qua extract</div>
            <pre class="text-xs text-slate-600 overflow-auto bg-slate-50 rounded-lg p-3" style="max-height:240px">${JSON.stringify(exam.answer_extract, null, 2)}</pre>
          </div>` : ""}
        </div>
      `;
    } catch (error) {
      document.getElementById("exam-detail-content").innerHTML = `<div class="text-sm text-red-600">Loi: ${error.message}</div>`;
    }
  }

  // ── Update Modal ───────────────────────────────────────────────────────────
  async function loadMasterDataForUpdate() {
    if (masterDataLoaded) return;
    try {
      const [classesPayload, subjectsPayload, periodsPayload] = await Promise.all([
        window.AppApi.list("classes"),
        window.AppApi.list("subjects"),
        window.AppApi.list("exam-periods")
      ]);

      const classes = (classesPayload.data || []).filter((x) => !x.status || x.status === "active");
      const subjects = (subjectsPayload.data || []).filter((x) => !x.status || x.status === "active");
      const periods = (periodsPayload.data || []).filter((x) => !x.status || x.status === "active");

      subjectsByCode = new Map(subjects.map((x) => [String(x.subject_code || ""), String(x.subject_name || "")]));

      window.AppUI.fillSelect(
        document.getElementById("update-class-code"),
        classes.map((x) => ({ value: x.class_code, label: x.class_name ? `${x.class_code} - ${x.class_name}` : x.class_code })),
        false
      );
      window.AppUI.fillSelect(
        document.getElementById("update-subject-code"),
        subjects.map((x) => ({ value: x.subject_code, label: x.subject_name ? `${x.subject_code} - ${x.subject_name}` : x.subject_code })),
        false
      );
      window.AppUI.fillSelect(
        document.getElementById("update-exam-round"),
        periods.map((x) => ({ value: x.period_code, label: x.period_name ? `${x.period_code} - ${x.period_name}` : x.period_code })),
        false
      );

      masterDataLoaded = true;
    } catch (error) {
      console.error("Failed to load master data for update form:", error);
    }
  }

  async function openUpdateModal(examId) {
    openModal("exam-update-modal");
    renderUpdateMessage("", "");
    document.getElementById("update-exam-id").value = examId;
    document.getElementById("update-submit-btn").disabled = false;

    await loadMasterDataForUpdate();

    const exam = allExams.find((e) => String(e.id) === String(examId));
    if (exam) {
      document.getElementById("update-title").value = exam.title || "";
      document.getElementById("update-class-code").value = exam.class_code || "";
      document.getElementById("update-subject-code").value = exam.subject_code || "";
      document.getElementById("update-exam-type").value = exam.exam_type || "";
      document.getElementById("update-exam-round").value = exam.exam_round || "";
      document.getElementById("update-description").value = exam.description || "";
    }

    document.getElementById("update-question-file").value = "";
    document.getElementById("update-answer-file").value = "";
  }

  function renderUpdateMessage(type, text) {
    const map = {
      success: "border-emerald-200 bg-emerald-50 text-emerald-800",
      error: "border-red-200 bg-red-50 text-red-800",
      info: "border-slate-200 bg-slate-50 text-slate-700"
    };
    document.getElementById("update-message").innerHTML = text
      ? `<div class="rounded-xl border p-3 text-sm ${map[type] || map.info}">${text}</div>`
      : "";
  }

  document.getElementById("exam-update-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const examId = document.getElementById("update-exam-id").value;
    const questionFile = document.getElementById("update-question-file").files[0];
    const answerFile = document.getElementById("update-answer-file").files[0];
    const hasFiles = Boolean(questionFile && answerFile);
    const submitBtn = document.getElementById("update-submit-btn");

    submitBtn.disabled = true;
    renderUpdateMessage("info", "Dang luu thay doi...");

    try {
      const formData = new FormData();
      formData.set("title", document.getElementById("update-title").value.trim());
      formData.set("description", document.getElementById("update-description").value.trim());
      formData.set("class_code", document.getElementById("update-class-code").value);

      const subjectCode = document.getElementById("update-subject-code").value;
      formData.set("subject_code", subjectCode);
      formData.set("subject_name", subjectsByCode.get(subjectCode) || subjectCode);
      formData.set("exam_type", document.getElementById("update-exam-type").value);
      formData.set("exam_round", document.getElementById("update-exam-round").value);

      if (hasFiles) {
        formData.set("question_file", questionFile);
        formData.set("answer_file", answerFile);
      }

      await window.AppApi.updateExam(examId, formData);

      renderUpdateMessage(
        "success",
        hasFiles
          ? "Da cap nhat de thi va kich hoat extract lai tu n8n workflow."
          : "Da cap nhat thong tin de thi thanh cong."
      );

      await loadData();
      applyFilters();
    } catch (error) {
      renderUpdateMessage("error", error.message);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function deleteExam(examId) {
    const exam = allExams.find((e) => String(e.id) === String(examId));
    const title = exam?.title || `#${examId}`;
    if (!confirm(`Xac nhan luu tru (archive) de thi:\n"${title}"?`)) return;

    try {
      await window.AppApi.deleteExam(examId);
      await loadData();
      applyFilters();
    } catch (error) {
      alert(`Loi: ${error.message}`);
    }
  }

  // ── Data loading ───────────────────────────────────────────────────────────
  async function loadData() {
    const payload = await window.AppApi.list("exams", { limit: 500 });
    allExams = payload.data || [];

    window.AppUI.fillSelect(classFilter, window.AppUI.classOptions(allExams), true);
    window.AppUI.fillSelect(subjectFilter, window.AppUI.subjectOptions(allExams), true);
  }

  try {
    await loadData();
    applyFilters();
  } catch (error) {
    document.getElementById("exam-table-body").innerHTML = `
      <tr><td colspan="5" class="py-6 px-3 text-center text-sm text-red-600">${error.message}</td></tr>
    `;
  }
});
