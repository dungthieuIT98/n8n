document.addEventListener("DOMContentLoaded", async () => {
  window.AppLayout.init();

  function renderExamExtract(extract) {
    if (!extract) {
      return "<p>Chua co du lieu extract.</p>";
    }

    if (typeof extract === "string") {
      return `<pre>${extract}</pre>`;
    }

    const questions = Array.isArray(extract.questions) ? extract.questions : [];
    const summary = [
      `<p>So cau: ${questions.length}</p>`,
      `<p>Tong diem toi da: ${extract.total_max_score ?? "N/A"}</p>`
    ].join("");

    return `${summary}<pre>${JSON.stringify(extract, null, 2)}</pre>`;
  }

  let exams = [];
  let submissions = [];

  const classFilter = document.getElementById("exam-filter-class");
  const subjectFilter = document.getElementById("exam-filter-subject");
  const typeFilter = document.getElementById("exam-filter-type");
  const statusFilter = document.getElementById("exam-filter-status");

  window.AppUI.fillSelect(classFilter, window.AppUI.classOptions(), true);
  window.AppUI.fillSelect(subjectFilter, window.AppUI.subjectOptions(), true);
  window.AppUI.fillSelect(typeFilter, window.AppUI.examTypeOptions(), true);
  window.AppUI.fillSelect(statusFilter, window.AppUI.examStatusOptions(), true);

  ["exam-filter-class", "exam-filter-subject", "exam-filter-type", "exam-filter-status"].forEach((id) => {
    document.getElementById(id).addEventListener("change", renderPage);
  });

  async function loadData() {
    const [examsPayload, submissionsPayload] = await Promise.all([
      window.AppApi.list("exams", { limit: 100 }),
      window.AppApi.list("submissions", { limit: 100 })
    ]);
    exams = examsPayload.data;
    submissions = submissionsPayload.data;

    window.AppUI.fillSelect(classFilter, window.AppUI.classOptions(exams), true);
    window.AppUI.fillSelect(subjectFilter, window.AppUI.subjectOptions(exams), true);
  }

  async function showExamDetail(examId) {
    try {
      document.getElementById("exam-modal-title").textContent = "Chi tiet de thi - Dang tai...";
      document.getElementById("exam-detail-content").innerHTML = "<p>Dang tai du lieu...</p>";
      window.AppLayout.openModal("exam-detail-modal");

      const result = await window.AppApi.detail("exams", examId);
      const exam = result.data;

      if (!exam) {
        document.getElementById("exam-detail-content").innerHTML = "<p>Khong tim thay de thi.</p>";
        return;
      }

      const submissionCount = submissions.filter((item) => String(item.exam_id) === String(exam.id)).length;
      
      document.getElementById("exam-modal-title").textContent = exam.title;
      document.getElementById("exam-detail-content").innerHTML = `
        <h3>${exam.title}</h3>
        <div class="detail-meta">
          <div><strong>Ma de thi</strong><br>${exam.exam_code}</div>
          <div><strong>Version</strong><br>v${exam.version}</div>
          <div><strong>Lop / Mon</strong><br>${exam.class_code} / ${exam.subject_name}</div>
          <div><strong>Loai / Dot</strong><br>${exam.exam_type} / ${exam.exam_round}</div>
          <div><strong>Trang thai</strong><br>${window.AppUI.renderStatus(exam.status)}</div>
          <div><strong>Nguoi tao</strong><br>${exam.teacher_name}</div>
        </div>
        <div class="list-card">
          <strong>Mo ta</strong>
          <p>${exam.description || "Chua co mo ta"}</p>
        </div>
        <div class="list-card" style="margin-top: 12px;">
          <strong>File</strong>
          <p>De thi: ${exam.question_file_path}</p>
          <p>Dap an: ${exam.answer_file_path}</p>
          <div>Extract: ${renderExamExtract(exam.answer_extract_file_path)}</div>
        </div>
        <div class="list-card" style="margin-top: 12px;">
          <strong>Bai nop lien quan</strong>
          <p>${submissionCount} bai nop da duoc ghi nhan.</p>
        </div>
      `;
    } catch (error) {
      document.getElementById("exam-detail-content").innerHTML = `<p style="color: red;">Loi: ${error.message}</p>`;
    }
  }

  function renderPage() {
    const classCode = classFilter.value;
    const subjectCode = subjectFilter.value;
    const examType = typeFilter.value;
    const status = statusFilter.value;

    const rows = exams.filter((exam) => (
      (!classCode || exam.class_code === classCode)
      && (!subjectCode || exam.subject_code === subjectCode)
      && (!examType || exam.exam_type === examType)
      && (!status || exam.status === status)
    )).map((exam) => {
      const submissionCount = submissions.filter((item) => String(item.exam_id) === String(exam.id)).length;
      return `
        <tr>
          <td>${exam.exam_code}</td>
          <td>v${exam.version}</td>
          <td>${exam.title}</td>
          <td>${exam.class_code}</td>
          <td>${exam.subject_name}</td>
          <td>${exam.exam_type}</td>
          <td>${submissionCount}</td>
          <td>${window.AppUI.renderStatus(exam.status)}</td>
          <td>${exam.created_at}</td>
          <td>${exam.teacher_name}</td>
          <td>
            <div class="table-actions">
              <button class="secondary" data-view-exam="${exam.id}">Xem</button>
              <button data-update-exam="${exam.id}">Cap nhat</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    document.getElementById("exam-table-body").innerHTML = rows || '<tr><td colspan="11">Khong co de thi phu hop bo loc.</td></tr>';

    document.querySelectorAll("[data-view-exam]").forEach((button) => {
      button.addEventListener("click", () => {
        showExamDetail(button.dataset.viewExam);
      });
    });

    document.querySelectorAll("[data-update-exam]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await window.AppApi.reprocessExam(button.dataset.updateExam);
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
    document.getElementById("exam-table-body").innerHTML = `<tr><td colspan="11">${error.message}</td></tr>`;
  }
});