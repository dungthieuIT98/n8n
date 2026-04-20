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
      <article class="summary-card">
        <span class="muted">${card.label}</span>
        <strong>${card.value}</strong>
        <span class="muted">${card.hint}</span>
      </article>
    `).join("");

    document.getElementById("recent-exams").innerHTML = exams.slice(0, 3).map((exam) => `
      <div class="list-card">
        <strong>${exam.title}</strong>
        <p>${exam.exam_code} - ${exam.class_code} - ${exam.subject_name}</p>
        <p>${window.AppUI.renderStatus(exam.status)}</p>
      </div>
    `).join("");

    document.getElementById("recent-submissions").innerHTML = submissions.slice(0, 3).map((submission) => `
      <div class="list-card">
        <strong>${submission.student_name}</strong>
        <p>${submission.exam_title}</p>
        <p>${submission.total_score}/${submission.max_score} - ${window.AppUI.renderStatus(submission.status)}</p>
      </div>
    `).join("");
  } catch (error) {
    document.getElementById("summary-grid").innerHTML = `<div class="message error">${error.message}</div>`;
  }
});