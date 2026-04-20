document.addEventListener("DOMContentLoaded", async () => {
  window.AppLayout.init();

  let submissions = [];
  let currentFilteredRows = [];

  const classFilter = document.getElementById("result-filter-class");
  const subjectFilter = document.getElementById("result-filter-subject");
  const typeFilter = document.getElementById("result-filter-type");
  const statusFilter = document.getElementById("result-filter-status");

  window.AppUI.fillSelect(classFilter, window.AppUI.classOptions(), true);
  window.AppUI.fillSelect(subjectFilter, window.AppUI.subjectOptions(), true);
  window.AppUI.fillSelect(typeFilter, window.AppUI.examTypeOptions(), true);
  window.AppUI.fillSelect(statusFilter, window.AppUI.submissionStatusOptions(), true);

  ["result-filter-class", "result-filter-subject", "result-filter-type", "result-filter-status"].forEach((id) => {
    document.getElementById(id).addEventListener("change", renderPage);
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

    currentFilteredRows = submissions.filter((submission) => (
      (!classCode || submission.class_code === classCode)
      && (!subjectCode || submission.subject_code === subjectCode)
      && (!examType || submission.exam_type === examType)
      && (!status || submission.status === status)
    ));

    const rows = currentFilteredRows.map((submission) => `
      <tr>
        <td>${submission.student_code}</td>
        <td>${submission.student_name}</td>
        <td>${submission.class_code}</td>
        <td>${submission.subject_name}</td>
        <td>${submission.exam_type}</td>
        <td>${submission.total_score}/${submission.max_score}</td>
        <td>${window.AppUI.renderStatus(submission.status)}</td>
        <td>${submission.ai_confidence ? `${submission.ai_confidence}%` : "-"}</td>
        <td>${submission.submitted_at}</td>
        <td>${submission.graded_at || "-"}</td>
        <td>
          <div class="table-actions">
            <button class="secondary" data-view-submission="${submission.id}">Xem</button>
            <button class="ghost" data-download-submission="${submission.id}">Tai bai</button>
            <button class="warning" data-regrade-submission="${submission.id}">Cham lai</button>
            <button data-approve-submission="${submission.id}">Phe duyet</button>
          </div>
        </td>
      </tr>
    `).join("");

    document.getElementById("result-table-body").innerHTML = rows || '<tr><td colspan="11">Khong co ket qua phu hop bo loc.</td></tr>';

    document.querySelectorAll("[data-view-submission]").forEach((button) => {
      button.addEventListener("click", () => {
        showSubmissionDetail(button.dataset.viewSubmission);
      });
    });

    document.querySelectorAll("[data-download-submission]").forEach((button) => {
      button.addEventListener("click", () => {
        const submission = submissions.find((item) => String(item.id) === String(button.dataset.downloadSubmission));
        if (submission) {
          window.alert(`Tai file bai nop: ${submission.submission_file_path || "Chua co duong dan file"}`);
        }
      });
    });

    document.querySelectorAll("[data-regrade-submission]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await window.AppApi.regradeSubmission(button.dataset.regradeSubmission);
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