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

  function badgeClass(status) {
    const map = {
      published: "text-bg-success",
      graded: "text-bg-primary",
      approved: "text-bg-success",
      ready: "text-bg-success",
      processing: "text-bg-info",
      grading: "text-bg-info",
      uploaded: "text-bg-secondary",
      extracted: "text-bg-secondary",
      recheck: "text-bg-warning",
      warning: "text-bg-warning",
      failed: "text-bg-danger",
      rejected: "text-bg-danger"
    };

    return map[status] || "text-bg-secondary";
  }

  function renderBadge(status, fallback = "-") {
    if (!status) {
      return `<span class="badge text-bg-light text-secondary">${fallback}</span>`;
    }

    return `<span class="badge ${badgeClass(status)}">${status}</span>`;
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

    summaryCards.innerHTML = `
      <div class="col-12 col-md-6 col-xxl-3">
        <article class="card h-100 border-0 shadow-sm">
          <div class="card-body">
            <div class="text-secondary small text-uppercase fw-semibold mb-2">Tong bai nop</div>
            <div class="display-6 fw-bold text-dark">${total}</div>
            <p class="text-secondary small mb-0">So bai nop dang co trong tap du lieu hien tai.</p>
          </div>
        </article>
      </div>
      <div class="col-12 col-md-6 col-xxl-3">
        <article class="card h-100 border-0 shadow-sm">
          <div class="card-body">
            <div class="text-secondary small text-uppercase fw-semibold mb-2">Da cong bo</div>
            <div class="display-6 fw-bold text-dark">${published}</div>
            <p class="text-secondary small mb-0">San sang de sinh vien tra cuu ket qua.</p>
          </div>
        </article>
      </div>
      <div class="col-12 col-md-6 col-xxl-3">
        <article class="card h-100 border-0 shadow-sm">
          <div class="card-body">
            <div class="text-secondary small text-uppercase fw-semibold mb-2">Can xu ly</div>
            <div class="display-6 fw-bold text-dark">${needsAttention}</div>
            <p class="text-secondary small mb-0">Bai dang recheck, failed hoac can giao vien xem lai.</p>
          </div>
        </article>
      </div>
      <div class="col-12 col-md-6 col-xxl-3">
        <article class="card h-100 border-0 shadow-sm">
          <div class="card-body">
            <div class="text-secondary small text-uppercase fw-semibold mb-2">Do tin cay TB</div>
            <div class="display-6 fw-bold text-dark">${averageConfidence}%</div>
            <p class="text-secondary small mb-0">Trung binh confidence AI tren tap ket qua dang hien thi.</p>
          </div>
        </article>
      </div>
    `;
  }

  function renderFocusCard(submission) {
    if (!submission) {
      focusCard.innerHTML = '<div class="alert alert-light border mb-0">Chon mot bai nop trong bang de hien thong tin nhanh.</div>';
      return;
    }

    focusCard.innerHTML = `
      <div class="card bg-body-tertiary border-0 mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between gap-3 align-items-start mb-3">
            <div>
              <h4 class="h5 mb-1">${submission.student_name}</h4>
              <div class="text-secondary small">${submission.student_code} • ${submission.class_code}</div>
            </div>
            ${renderBadge(submission.status)}
          </div>
          <div class="row g-2 small">
            <div class="col-6"><span class="text-secondary d-block">Mon hoc</span><strong>${submission.subject_name || "-"}</strong></div>
            <div class="col-6"><span class="text-secondary d-block">Loai bai</span><strong>${submission.exam_type || "-"}</strong></div>
            <div class="col-6"><span class="text-secondary d-block">Tong diem</span><strong>${submission.total_score || 0}/${submission.max_score || "-"}</strong></div>
            <div class="col-6"><span class="text-secondary d-block">AI confidence</span><strong>${submission.ai_confidence ? `${submission.ai_confidence}%` : "-"}</strong></div>
          </div>
        </div>
      </div>
      <ul class="list-group list-group-flush border rounded-4 overflow-hidden mb-3">
        <li class="list-group-item d-flex justify-content-between gap-3"><span class="text-secondary">De thi</span><strong class="text-end">${submission.exam_title || submission.exam_code || "-"}</strong></li>
        <li class="list-group-item d-flex justify-content-between gap-3"><span class="text-secondary">Phe duyet</span><span>${renderBadge(submission.review_status, "chua co")}</span></li>
        <li class="list-group-item d-flex justify-content-between gap-3"><span class="text-secondary">Nop bai</span><strong class="text-end">${formatDateTime(submission.submitted_at)}</strong></li>
        <li class="list-group-item d-flex justify-content-between gap-3"><span class="text-secondary">Cham xong</span><strong class="text-end">${formatDateTime(submission.graded_at)}</strong></li>
      </ul>
      <div class="d-grid gap-2 d-sm-flex">
        <button class="btn btn-outline-primary" type="button" data-view-submission="${submission.id}">Xem chi tiet</button>
        <button class="btn btn-outline-secondary" type="button" data-download-submission="${submission.id}">Tai bai</button>
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
      <tr class="result-row ${String(submission.id) === String(selectedSubmissionId) ? "table-active" : ""}" data-select-submission="${submission.id}">
        <td>
          <div class="fw-semibold">${submission.student_code}</div>
          <div class="text-secondary small">${submission.exam_code || "-"}</div>
        </td>
        <td>
          <div class="fw-semibold">${submission.student_name}</div>
          <div class="text-secondary small">${submission.exam_title || "-"}</div>
        </td>
        <td>${submission.class_code}</td>
        <td>${submission.subject_name}</td>
        <td>${submission.exam_type}</td>
        <td><span class="fw-semibold">${submission.total_score}/${submission.max_score}</span></td>
        <td>
          <div class="d-flex flex-column gap-1">
            ${renderBadge(submission.status)}
            ${submission.review_status ? renderBadge(submission.review_status) : ""}
          </div>
        </td>
        <td>${submission.ai_confidence ? `${submission.ai_confidence}%` : "-"}</td>
        <td>${formatDateTime(submission.submitted_at)}</td>
        <td>${formatDateTime(submission.graded_at)}</td>
        <td>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-outline-primary" type="button" data-view-submission="${submission.id}">Xem</button>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-download-submission="${submission.id}">Tai bai</button>
            <button class="btn btn-sm btn-outline-warning" type="button" data-regrade-submission="${submission.id}">Cham lai</button>
            <button class="btn btn-sm btn-success" type="button" data-approve-submission="${submission.id}">Phe duyet</button>
          </div>
        </td>
      </tr>
    `).join("");

    document.getElementById("result-table-body").innerHTML = rows || '<tr><td colspan="11" class="text-center text-secondary py-4">Khong co ket qua phu hop bo loc.</td></tr>';

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