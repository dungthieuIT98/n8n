document.addEventListener("DOMContentLoaded", async () => {
  window.AppLayout.init();

  try {
    const [statsPayload, chartPayload, submissionsPayload] = await Promise.all([
      window.AppApi.list("stats"),
      window.AppApi.list("exam-chart-data"),
      window.AppApi.list("submissions", { limit: 6 })
    ]);

    const stats = statsPayload.data;
    const chartData = chartPayload.data;
    const submissions = submissionsPayload.data;

    document.getElementById("summary-grid").innerHTML = [
      { label: "Tổng đề thi", value: stats.total_exams, hint: "Đang có trong hệ thống" },
      { label: "Tổng bài nộp", value: stats.total_submissions, hint: "Bao gồm bài lỗi và bài đã chấm" },
      { label: "Kết quả đã công bố", value: stats.published_count, hint: "Sinh viên có thể tra cứu" },
      { label: "Nhật ký lỗi cần xử lý", value: stats.failed_logs_count, hint: "Cần thử lại hoặc kiểm tra thủ công" }
    ].map((card) => `
      <article class="rounded-2xl border border-slate-200 p-4 bg-white">
        <div class="text-xs font-semibold text-slate-500">${card.label}</div>
        <div class="text-3xl font-extrabold mt-2">${card.value ?? 0}</div>
        <div class="text-sm text-slate-600 mt-1">${card.hint}</div>
      </article>
    `).join("");

    // Chart
    if (!chartData || chartData.length === 0) {
      document.getElementById("chart-wrap").classList.add("hidden");
      document.getElementById("chart-empty").classList.remove("hidden");
    } else {
      const labels = chartData.map((d) => d.exam_code || d.title);
      const submissionCounts = chartData.map((d) => d.submission_count || 0);
      const avgScores = chartData.map((d) => d.avg_score !== null ? Number(d.avg_score) : null);
      const maxPossible = chartData.map((d) => d.max_score_possible !== null ? Number(d.max_score_possible) : 10);

      const ctx = document.getElementById("exam-chart").getContext("2d");
      new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "So bai nop",
              data: submissionCounts,
              backgroundColor: "rgb(15 23 42 / 0.85)",
              borderRadius: 6,
              yAxisID: "y"
            },
            {
              label: "Diem trung binh",
              data: avgScores,
              backgroundColor: "rgb(56 189 248 / 0.75)",
              borderRadius: 6,
              yAxisID: "y2"
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                afterBody(items) {
                  const idx = items[0]?.dataIndex;
                  if (idx === undefined) return [];
                  const mp = maxPossible[idx];
                  const avg = avgScores[idx];
                  if (avg !== null && mp) {
                    return [`Tối đa có thể: ${mp}`];
                  }
                  return ["Chưa có kết quả công bố"];
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 } }
            },
            y: {
              position: "left",
              title: { display: true, text: "Số bài nộp", font: { size: 11 } },
              beginAtZero: true,
              ticks: { stepSize: 1 }
            },
            y2: {
              position: "right",
              title: { display: true, text: "Điểm TB", font: { size: 11 } },
              beginAtZero: true,
              grid: { drawOnChartArea: false }
            }
          }
        }
      });
    }

    document.getElementById("recent-submissions").innerHTML = submissions.slice(0, 6).map((submission) => `
      <div class="rounded-2xl border border-slate-200 p-4 bg-white">
        <div class="font-extrabold">${submission.student_name}</div>
        <div class="text-sm text-slate-600 mt-1">${submission.exam_title}</div>
        <div class="text-sm text-slate-700 mt-2">
          <span class="font-semibold">${submission.total_score ?? "-"}/${submission.max_score ?? "-"}</span>
          <span class="mx-1 text-slate-400">•</span>
          ${window.AppUI.renderStatus(submission.grading_status || submission.status)}
        </div>
      </div>
    `).join("");
  } catch (error) {
    document.getElementById("summary-grid").innerHTML = `<div class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">${error.message}</div>`;
  }
});
