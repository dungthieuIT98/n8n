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
        <div class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Ma de thi</div>
              <div class="font-bold">${exam.exam_code}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Version</div>
              <div class="font-bold">v${exam.version}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Trang thai</div>
              <div>${window.AppUI.renderStatus(exam.status)}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Lop / Mon</div>
              <div class="font-bold">${exam.class_code} / ${exam.subject_name}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Loai / Dot</div>
              <div class="font-bold">${exam.exam_type} / ${exam.exam_round}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Nguoi tao</div>
              <div class="font-bold">${exam.teacher_name}</div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 p-4 space-y-2 text-sm">
            <div class="font-extrabold">Mo ta</div>
            <div class="text-slate-700">${exam.description || "Chua co mo ta"}</div>
          </div>

          <div class="rounded-2xl border border-slate-200 p-4 space-y-2 text-sm">
            <div class="font-extrabold">File</div>
            <div><span class="font-semibold">De thi:</span> ${exam.question_file_path}</div>
            <div><span class="font-semibold">Dap an:</span> ${exam.answer_file_path}</div>
            <div class="mt-2"><span class="font-semibold">Extract:</span> ${renderExamExtract(exam.answer_extract)}</div>
          </div>

          <div class="rounded-2xl border border-slate-200 p-4 space-y-1 text-sm">
            <div class="font-extrabold">Bai nop lien quan</div>
            <div>${submissionCount} bai nop da duoc ghi nhan.</div>
          </div>
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
          <td class="py-2 px-3 font-semibold">${exam.exam_code}</td>
          <td class="py-2 px-3">v${exam.version}</td>
          <td class="py-2 px-3">${exam.title}</td>
          <td class="py-2 px-3">${exam.class_code}</td>
          <td class="py-2 px-3">${exam.subject_name}</td>
          <td class="py-2 px-3">${exam.exam_type}</td>
          <td class="py-2 px-3">${submissionCount}</td>
          <td class="py-2 px-3">${window.AppUI.renderStatus(exam.status)}</td>
          <td class="py-2 px-3">${exam.created_at}</td>
          <td class="py-2 px-3">${exam.teacher_name}</td>
          <td>
            <div class="flex flex-wrap gap-2 py-2 px-3">
              <button class="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold" data-view-exam="${exam.id}">Xem</button>
              <button class="px-2 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold" data-update-exam="${exam.id}">Cap nhat</button>
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