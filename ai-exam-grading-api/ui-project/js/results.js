document.addEventListener("DOMContentLoaded", async () => {
  window.AppLayout.init();

  let submissions = [];
  let currentFilteredRows = [];
  let selectedSubmissionId = null;

  const classFilter = document.getElementById("result-filter-class");
  const subjectFilter = document.getElementById("result-filter-subject");
  const typeFilter = document.getElementById("result-filter-type");
  const statusFilter = document.getElementById("result-filter-status");
  const keywordFilter = document.getElementById("result-filter-keyword");
  const summaryCards = document.getElementById("results-summary-cards");
  const focusCard = document.getElementById("result-focus-card");
  const countLabel = document.getElementById("results-count-label");
  const countCaption = document.getElementById("results-count-caption");
  const resetFiltersButton = document.getElementById("reset-result-filters");

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function renderBadge(status, fallback = "-") {
    if (!status) {
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold bg-slate-50 text-slate-700 border-slate-200">${fallback}</span>`;
    }
    return window.AppUI.renderStatus(status);
  }

  function renderSummary(items) {
    const total = items.length;
    const published = items.filter((item) => item.status === "published").length;
    const needsAttention = items.filter((item) => ["recheck", "failed", "warning"].includes(item.review_status) || ["recheck", "failed"].includes(item.status)).length;
    const confidenceValues = items
      .map((item) => Number(item.ai_confidence))
      .filter((value) => Number.isFinite(value));
    const averageConfidence = confidenceValues.length
      ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
      : 0;

    summaryCards.innerHTML = [
      { label: "Tong bai nop", value: total, hint: "So bai nop dang co trong tap du lieu hien tai." },
      { label: "Da cong bo", value: published, hint: "San sang de sinh vien tra cuu ket qua." },
      { label: "Can xu ly", value: needsAttention, hint: "Bai dang recheck, failed hoac can giao vien xem lai." },
      { label: "Do tin cay TB", value: `${averageConfidence}%`, hint: "Trung binh confidence AI tren tap ket qua dang hien thi." }
    ].map((card) => `
      <article class="rounded-2xl border border-slate-200 p-4 bg-white">
        <div class="text-xs font-semibold text-slate-500">${card.label}</div>
        <div class="text-3xl font-extrabold mt-2">${card.value}</div>
        <div class="text-sm text-slate-600 mt-1">${card.hint}</div>
      </article>
    `).join("");
  }

  function renderFocusCard(submission) {
    if (!submission) {
      focusCard.innerHTML = '<div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Chon mot bai nop trong bang de hien thong tin nhanh.</div>';
      return;
    }

    focusCard.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-3">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <div class="font-extrabold">${submission.student_name}</div>
            <div class="text-sm text-slate-600">${submission.student_code} • ${submission.class_code}</div>
          </div>
          ${renderBadge(submission.status)}
        </div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div><div class="text-xs font-semibold text-slate-500">Mon hoc</div><div class="font-semibold">${submission.subject_name || "-"}</div></div>
          <div><div class="text-xs font-semibold text-slate-500">Loai bai</div><div class="font-semibold">${submission.exam_type || "-"}</div></div>
          <div><div class="text-xs font-semibold text-slate-500">Tong diem</div><div class="font-semibold">${submission.total_score || 0}/${submission.max_score || "-"}</div></div>
          <div><div class="text-xs font-semibold text-slate-500">AI confidence</div><div class="font-semibold">${submission.ai_confidence ? `${submission.ai_confidence}%` : "-"}</div></div>
        </div>
      </div>
      <div class="rounded-2xl border border-slate-200 overflow-hidden mb-3 text-sm">
        <div class="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200"><span class="text-slate-600">De thi</span><span class="font-semibold text-right">${submission.exam_title || submission.exam_code || "-"}</span></div>
        <div class="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200"><span class="text-slate-600">Phe duyet</span><span>${renderBadge(submission.review_status, "chua co")}</span></div>
        <div class="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200"><span class="text-slate-600">Nop bai</span><span class="font-semibold text-right">${formatDateTime(submission.submitted_at)}</span></div>
        <div class="flex items-center justify-between gap-3 px-3 py-2"><span class="text-slate-600">Cham xong</span><span class="font-semibold text-right">${formatDateTime(submission.graded_at)}</span></div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm font-semibold" type="button" data-view-submission="${submission.id}">Xem chi tiet</button>
        <button class="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm font-semibold" type="button" data-download-submission="${submission.id}">Tai bai</button>
      </div>
    `;
  }

  function attachSharedActions(scope = document) {
    scope.querySelectorAll("[data-view-submission]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedSubmissionId = button.dataset.viewSubmission;
        renderPage();
        showSubmissionDetail(button.dataset.viewSubmission);
      });
    });

    scope.querySelectorAll("[data-download-submission]").forEach((button) => {
      button.addEventListener("click", () => {
        const submission = submissions.find((item) => String(item.id) === String(button.dataset.downloadSubmission));
        if (submission) {
          window.alert(`Tai file bai nop: ${submission.submission_file_path || "Chua co duong dan file"}`);
        }
      });
    });
  }

  window.AppUI.fillSelect(classFilter, window.AppUI.classOptions(), true);
  window.AppUI.fillSelect(subjectFilter, window.AppUI.subjectOptions(), true);
  window.AppUI.fillSelect(typeFilter, window.AppUI.examTypeOptions(), true);
  window.AppUI.fillSelect(statusFilter, window.AppUI.submissionStatusOptions(), true);

  ["result-filter-class", "result-filter-subject", "result-filter-type", "result-filter-status"].forEach((id) => {
    document.getElementById(id).addEventListener("change", renderPage);
  });
  keywordFilter.addEventListener("input", renderPage);
  resetFiltersButton.addEventListener("click", () => {
    classFilter.value = "";
    subjectFilter.value = "";
    typeFilter.value = "";
    statusFilter.value = "";
    keywordFilter.value = "";
    renderPage();
  });

  document.getElementById("export-results-btn").addEventListener("click", () => {
    const lines = [
      ["student_code", "student_name", "class_code", "subject_name", "exam_type", "total_score", "status"].join(","),
      ...currentFilteredRows.map((item) => [
        item.student_code,
        item.student_name,
        item.class_code,
        item.subject_name,
        item.exam_type,
        item.total_score,
        item.status
      ].join(","))
    ].join("\n");
    window.AppUI.downloadCsv("grading-results.csv", lines);
  });

  async function loadData() {
    const payload = await window.AppApi.list("submissions", { limit: 100 });
    submissions = payload.data;
    window.AppUI.fillSelect(classFilter, window.AppUI.classOptions(submissions), true);
    window.AppUI.fillSelect(subjectFilter, window.AppUI.subjectOptions(submissions), true);
    if (!selectedSubmissionId && submissions[0]) {
      selectedSubmissionId = submissions[0].id;
    }
  }

  async function showSubmissionDetail(submissionId) {
    try {
      document.getElementById("result-modal-title").textContent = "Chi tiet bai lam - Dang tai...";
      document.getElementById("result-detail-content").innerHTML = "<p>Dang tai du lieu...</p>";
      window.AppLayout.openModal("result-detail-modal");

      const result = await window.AppApi.detail("submissions", submissionId);
      const submission = result.data;

      if (!submission) {
        document.getElementById("result-detail-content").innerHTML = "<p>Khong tim thay bai nop.</p>";
        return;
      }

      document.getElementById("result-modal-title").textContent = `${submission.student_name} - ${submission.exam_title}`;
      document.getElementById("result-detail-content").innerHTML = window.AppUI.renderSubmissionDetail(submission);
    } catch (error) {
      document.getElementById("result-detail-content").innerHTML = `<p style="color: red;">Loi: ${error.message}</p>`;
    }
  }

  function renderPage() {
    const classCode = classFilter.value;
    const subjectCode = subjectFilter.value;
    const examType = typeFilter.value;
    const status = statusFilter.value;
    const keyword = keywordFilter.value.trim().toLowerCase();

    currentFilteredRows = submissions.filter((submission) => (
      (!classCode || submission.class_code === classCode)
      && (!subjectCode || submission.subject_code === subjectCode)
      && (!examType || submission.exam_type === examType)
      && (!status || submission.status === status)
      && (!keyword || [submission.student_code, submission.student_name, submission.exam_code, submission.exam_title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)))
    ));

    if (!currentFilteredRows.some((item) => String(item.id) === String(selectedSubmissionId))) {
      selectedSubmissionId = currentFilteredRows[0]?.id || null;
    }

    const selectedSubmission = currentFilteredRows.find((item) => String(item.id) === String(selectedSubmissionId)) || null;

    renderSummary(currentFilteredRows);
    renderFocusCard(selectedSubmission);
    attachSharedActions(focusCard);

    countLabel.textContent = `${currentFilteredRows.length} bai nop`;
    countCaption.textContent = selectedSubmission
      ? `Dang focus: ${selectedSubmission.student_name} - ${selectedSubmission.subject_name || "-"}`
      : "Khong co bai nop phu hop voi bo loc hien tai.";

    const rows = currentFilteredRows.map((submission) => `
      <tr class="${String(submission.id) === String(selectedSubmissionId) ? "bg-slate-50" : ""} cursor-pointer" data-select-submission="${submission.id}">
        <td>
          <div class="font-semibold">${submission.student_code}</div>
          <div class="text-slate-500 text-xs">${submission.exam_code || "-"}</div>
        </td>
        <td>
          <div class="font-semibold">${submission.student_name}</div>
          <div class="text-slate-500 text-xs">${submission.exam_title || "-"}</div>
        </td>
        <td>${submission.class_code}</td>
        <td>${submission.subject_name}</td>
        <td>${submission.exam_type}</td>
        <td><span class="font-semibold">${submission.total_score}/${submission.max_score}</span></td>
        <td>
          <div class="flex flex-col gap-1">
            ${renderBadge(submission.status)}
            ${submission.review_status ? renderBadge(submission.review_status) : ""}
          </div>
        </td>
        <td>${submission.ai_confidence ? `${submission.ai_confidence}%` : "-"}</td>
        <td>${formatDateTime(submission.submitted_at)}</td>
        <td>${formatDateTime(submission.graded_at)}</td>
        <td>
          <div class="flex flex-wrap gap-2">
            <button class="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold" type="button" data-view-submission="${submission.id}">Xem</button>
            <button class="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold" type="button" data-download-submission="${submission.id}">Tai bai</button>
            <button class="px-2 py-1 rounded-lg border border-amber-200 text-amber-800 hover:bg-amber-50 text-xs font-semibold" type="button" data-regrade-submission="${submission.id}">Cham lai</button>
            <button class="px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold" type="button" data-approve-submission="${submission.id}">Phe duyet</button>
          </div>
        </td>
      </tr>
    `).join("");

    document.getElementById("result-table-body").innerHTML = rows || '<tr><td colspan="11" class="py-4 px-3 text-center text-slate-600">Khong co ket qua phu hop bo loc.</td></tr>';

    document.querySelectorAll("[data-select-submission]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) {
          return;
        }

        selectedSubmissionId = row.dataset.selectSubmission;
        renderPage();
      });
    });

    attachSharedActions(document);

    document.querySelectorAll("[data-regrade-submission]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await window.AppApi.regradeSubmission(button.dataset.regradeSubmission);
          selectedSubmissionId = button.dataset.regradeSubmission;
          await loadData();
          renderPage();
        } catch (error) {
          window.alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
    });

    document.querySelectorAll("[data-approve-submission]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await window.AppApi.approveSubmission(button.dataset.approveSubmission);
          selectedSubmissionId = button.dataset.approveSubmission;
          await loadData();
          renderPage();
        } catch (error) {
          window.alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  try {
    await loadData();
    renderPage();
  } catch (error) {
    document.getElementById("result-table-body").innerHTML = `<tr><td colspan="11">${error.message}</td></tr>`;
  }
});