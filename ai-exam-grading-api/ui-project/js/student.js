document.addEventListener("DOMContentLoaded", () => {
  window.AppLayout.init();

  const PAGE_SIZE = 10;
  let currentPage = 1;
  let allResults = [];

  const form = document.getElementById("student-search-form");
  const tableBody = document.getElementById("student-table-body");
  let latestResults = [];

  async function showSubmissionDetail(submissionId) {
    try {
      document.getElementById("student-modal-title").textContent = "Chi tiết bài thi - Đang tải...";
      document.getElementById("student-detail-content").innerHTML = "<p>Đang tải dữ liệu...</p>";
      window.AppLayout.openModal("student-detail-modal");

      const result = await window.AppApi.detail("submissions", submissionId);
      const submission = result.data;

      if (!submission) {
        document.getElementById("student-detail-content").innerHTML = "<p>Không tìm thấy bài thi.</p>";
        return;
      }

      document.getElementById("student-modal-title").textContent = `${submission.student_name} - ${submission.exam_title}`;
      document.getElementById("student-detail-content").innerHTML = window.AppUI.renderSubmissionDetail(submission);
    } catch (error) {
      document.getElementById("student-detail-content").innerHTML = `<p style="color: red;">Lỗi: ${error.message}</p>`;
    }
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  function renderPage() {
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = allResults.slice(start, start + PAGE_SIZE);

    tableBody.innerHTML = pageRows.map((submission) => `
      <tr class="hover:bg-slate-50">
        <td class="py-2 px-3 font-semibold">${submission.exam_title || "-"}</td>
        <td class="py-2 px-3">${submission.subject_name || "-"}</td>
        <td class="py-2 px-3">${submission.exam_type || "-"}</td>
        <td class="py-2 px-3 font-bold">${submission.total_score != null ? `${submission.total_score}/${submission.max_score ?? "?"}` : "-"}</td>
        <td class="py-2 px-3">${window.AppUI.renderStatus(submission.grading_status || "published")}</td>
        <td class="py-2 px-3">${formatDateTime(submission.graded_at)}</td>
        <td class="py-2 px-3">
          <button class="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold" data-student-detail="${submission.id}">Xem chi tiết</button>
        </td>
      </tr>
    `).join("") || '<tr><td colspan="7" class="py-3 px-3 text-slate-400">Không tìm thấy kết quả đã công bố.</td></tr>';

    document.querySelectorAll("[data-student-detail]").forEach((button) => {
      button.addEventListener("click", () => {
        showSubmissionDetail(button.dataset.studentDetail);
      });
    });

    window.AppUI.renderPagination("student-pagination", allResults.length, currentPage, PAGE_SIZE, (p) => {
      currentPage = p;
      renderPage();
    });
  }

  function renderResults(results) {
    latestResults = results;
    allResults = results;
    currentPage = 1;
    renderPage();
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