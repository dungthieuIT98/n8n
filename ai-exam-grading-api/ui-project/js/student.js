document.addEventListener("DOMContentLoaded", () => {
  window.AppLayout.init();

  const form = document.getElementById("student-search-form");
  const tableBody = document.getElementById("student-table-body");
  let latestResults = [];

  async function showSubmissionDetail(submissionId) {
    try {
      document.getElementById("student-modal-title").textContent = "Chi tiet bai thi - Dang tai...";
      document.getElementById("student-detail-content").innerHTML = "<p>Dang tai du lieu...</p>";
      window.AppLayout.openModal("student-detail-modal");

      const result = await window.AppApi.detail("submissions", submissionId);
      const submission = result.data;

      if (!submission) {
        document.getElementById("student-detail-content").innerHTML = "<p>Khong tim thay bai thi.</p>";
        return;
      }

      document.getElementById("student-modal-title").textContent = `${submission.student_name} - ${submission.exam_title}`;
      document.getElementById("student-detail-content").innerHTML = window.AppUI.renderSubmissionDetail(submission);
    } catch (error) {
      document.getElementById("student-detail-content").innerHTML = `<p style="color: red;">Loi: ${error.message}</p>`;
    }
  }

  function renderResults(results) {
    latestResults = results;
    tableBody.innerHTML = results.map((submission) => `
      <tr>
        <td>${submission.exam_title}</td>
        <td>${submission.subject_name}</td>
        <td>${submission.exam_type}</td>
        <td>${submission.total_score}/${submission.max_score}</td>
        <td>${window.AppUI.renderStatus(submission.status)}</td>
        <td>${submission.graded_at || "-"}</td>
        <td><button class="secondary" data-student-detail="${submission.id}">Xem chi tiet</button></td>
      </tr>
    `).join("") || '<tr><td colspan="7">Khong tim thay ket qua da cong bo.</td></tr>';

    document.querySelectorAll("[data-student-detail]").forEach((button) => {
      button.addEventListener("click", () => {
        showSubmissionDetail(button.dataset.studentDetail);
      });
    });
  }

  document.getElementById("student-fill-demo-btn").addEventListener("click", () => {
    form.elements.student_code.value = "SV2026001";
    form.elements.student_name.value = "Nguyen Minh An";
    form.elements.class_code.value = "12A1";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const studentCode = form.elements.student_code.value.trim().toLowerCase();
    const studentName = form.elements.student_name.value.trim().toLowerCase();
    const classCode = form.elements.class_code.value.trim().toLowerCase();

    try {
      const payload = await window.AppApi.studentResults({
        student_code: studentCode,
        student_name: studentName,
        class_code: classCode
      });
      renderResults(payload.data);
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan="7">${error.message}</td></tr>`;
    }
  });
});