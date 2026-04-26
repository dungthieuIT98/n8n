document.addEventListener("DOMContentLoaded", async () => {
  window.AppLayout.init();

  try {
    const [examsPayload, submissionsPayload, logsPayload] = await Promise.all([
      window.AppApi.list("exams", { limit: 6 }),
      window.AppApi.list("submissions", { limit: 6 }),
      window.AppApi.list("logs", { limit: 20 })
    ]);
    const exams = examsPayload.data;
    const submissions = submissionsPayload.data;
    const logs = logsPayload.data;
    const publishedCount = submissions.filter((item) => item.status === "published").length;
    const failedCount = logs.filter((item) => item.status === "failed").length;

    document.getElementById("summary-grid").innerHTML = [
      { label: "Tong de thi", value: examsPayload.pagination.total, hint: "Dang co trong he thong" },
      { label: "Tong bai nop", value: submissionsPayload.pagination.total, hint: "Bao gom bai loi va bai da cham" },
      { label: "Ket qua da cong bo", value: publishedCount, hint: "Sinh vien co the tra cuu" },
      { label: "Log loi can xu ly", value: failedCount, hint: "Can retry hoac kiem tra thu cong" }
    ].map((card) => `
      <article class="rounded-2xl border border-slate-200 p-4 bg-white">
        <div class="text-xs font-semibold text-slate-500">${card.label}</div>
        <div class="text-3xl font-extrabold mt-2">${card.value}</div>
        <div class="text-sm text-slate-600 mt-1">${card.hint}</div>
      </article>
    `).join("");

    document.getElementById("recent-exams").innerHTML = exams.slice(0, 6).map((exam) => `
      <div class="rounded-2xl border border-slate-200 p-4 bg-white">
        <div class="font-extrabold">${exam.title}</div>
        <div class="text-sm text-slate-600 mt-1">${exam.exam_code} - ${exam.class_code} - ${exam.subject_name}</div>
        <div class="mt-2">${window.AppUI.renderStatus(exam.status)}</div>
      </div>
    `).join("");

    document.getElementById("recent-submissions").innerHTML = submissions.slice(0, 6).map((submission) => `
      <div class="rounded-2xl border border-slate-200 p-4 bg-white">
        <div class="font-extrabold">${submission.student_name}</div>
        <div class="text-sm text-slate-600 mt-1">${submission.exam_title}</div>
        <div class="text-sm text-slate-700 mt-2">
          <span class="font-semibold">${submission.total_score}/${submission.max_score}</span>
          <span class="mx-1 text-slate-400">•</span>
          ${window.AppUI.renderStatus(submission.status)}
        </div>
      </div>
    `).join("");
  } catch (error) {
    document.getElementById("summary-grid").innerHTML = `<div class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">${error.message}</div>`;
  }
});