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
    if (!focusCard) return;
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

  function setupDelegatedActions() {
    document.addEventListener("click", async (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;

      if (btn.dataset.viewSubmission) {
        selectedSubmissionId = btn.dataset.viewSubmission;
        renderPage();
        showSubmissionDetail(btn.dataset.viewSubmission);
        return;
      }

      if (btn.dataset.downloadSubmission) {
        const submission = submissions.find((item) => String(item.id) === String(btn.dataset.downloadSubmission));
        if (submission) {
          window.alert(`Tai file bai nop: ${submission.submission_file_path || "Chua co duong dan file"}`);
        }
        return;
      }

      if (btn.dataset.regradeSubmission) {
        const submissionId = btn.dataset.regradeSubmission;
        if (btn.disabled) return;
        btn.disabled = true;
        try {
          await window.AppApi.regradeSubmission(submissionId);
          selectedSubmissionId = submissionId;
          await loadData();
          renderPage();
          if (!document.getElementById("result-detail-modal").classList.contains("hidden")) {
            await showSubmissionDetail(submissionId);
          }
        } catch (error) {
          window.alert(error.message);
        } finally {
          btn.disabled = false;
        }
        return;
      }

      if (btn.dataset.approveSubmission) {
        const submissionId = btn.dataset.approveSubmission;
        if (btn.disabled) return;
        btn.disabled = true;
        try {
          await window.AppApi.approveSubmission(submissionId);
          selectedSubmissionId = submissionId;
          await loadData();
          renderPage();
          if (!document.getElementById("result-detail-modal").classList.contains("hidden")) {
            await showSubmissionDetail(submissionId);
          }
        } catch (error) {
          window.alert(error.message);
        } finally {
          btn.disabled = false;
        }
      }
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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function field(label, value) {
    return `<div>
      <div class="text-xs text-slate-500 mb-0.5">${label}</div>
      <div class="font-semibold text-sm">${value ?? "-"}</div>
    </div>`;
  }

  function sectionBlock(title, body) {
    return `<div class="space-y-3">
      <div class="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1">${title}</div>
      ${body}
    </div>`;
  }

  // submissions.submission_extract — nội dung OCR/extract từ PDF bài làm (do n8n điền vào)
  function renderSubmissionExtract(extract) {
    if (!extract) return '<span class="text-slate-400">Chua co du lieu trich xuat (chua qua workflow extract).</span>';
    const text = typeof extract === "string"
      ? extract
      : (extract.text || extract.content || extract.raw || JSON.stringify(extract, null, 2));
    return `<pre class="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">${text}</pre>`;
  }

  // grading_results.grading_detail — JSON kết quả chấm từ n8n, hiển thị linh hoạt
  function renderGradingDetail(detail) {
    if (!detail) return "";

    // Nếu workflow trả về danh sách câu hỏi đã chấm
    const questions = detail.graded_questions || detail.questions || detail.details || [];
    if (Array.isArray(questions) && questions.length) {
      return `<div class="space-y-2">${questions.map((q) => {
        const earned = Number(q.earned_score ?? q.earned ?? q.score ?? 0);
        const max = Number(q.max_score ?? q.max ?? q.total ?? 0);
        const hasScore = Number.isFinite(earned) && Number.isFinite(max) && max > 0;
        const isDung = hasScore ? earned >= max : (String(q.result || q.verdict || "").toLowerCase().includes("dung") || q.is_correct);
        const scoreText = hasScore ? `${earned}/${max}đ` : (q.score ?? "-");
        const rubricScores = Array.isArray(q.rubric_scores) ? q.rubric_scores : [];
        return `<div class="rounded-xl border ${isDung ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"} p-3 text-sm space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-bold">Câu ${q.no ?? q.question_no ?? "?"}</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${isDung ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}">
              ${scoreText}
            </span>
          </div>
          ${q.question_text || q.question ? `<div><span class="text-slate-500">Đề:</span> ${q.question_text || q.question}</div>` : ""}
          ${q.student_answer ? `<div><span class="text-slate-500">Trả lời:</span> ${q.student_answer}</div>` : ""}
          ${q.correct_answer ? `<div><span class="text-slate-500">Đáp án:</span> ${q.correct_answer}</div>` : ""}
          ${q.feedback || q.explanation || q.comment ? `<div class="text-slate-600 text-xs leading-relaxed">${q.feedback || q.explanation || q.comment}</div>` : ""}
          ${rubricScores.length ? `
            <div class="mt-2 rounded-lg border border-slate-200 bg-white/60">
              <div class="px-2 py-1 text-[11px] font-semibold text-slate-500 border-b border-slate-200">Rubric</div>
              <div class="divide-y divide-slate-200">
                ${rubricScores.map((r) => {
                  const rEarned = Number(r.earned ?? 0);
                  const rScore = Number(r.score ?? 0);
                  const ok = Number.isFinite(rEarned) && Number.isFinite(rScore) && rScore > 0 && rEarned >= rScore;
                  return `
                  <div class="px-2 py-1.5 text-[11px]">
                    <div class="flex items-center justify-between gap-2">
                      <div class="font-semibold text-slate-800 truncate">${r.key ?? "-"}</div>
                      <div class="font-semibold ${ok ? "text-emerald-700" : "text-slate-600"}">${Number.isFinite(rEarned) ? rEarned : 0}/${Number.isFinite(rScore) ? rScore : 0}</div>
                    </div>
                    ${r.comment ? `<div class="text-slate-600 mt-0.5 leading-relaxed">${r.comment}</div>` : ""}
                  </div>`;
                }).join("")}
              </div>
            </div>
          ` : ""}
        </div>`;
      }).join("")}</div>`;
    }

    // Nếu không có structured questions → hiển thị raw JSON để debug
    return `<pre class="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-auto max-h-60 text-slate-600">${JSON.stringify(detail, null, 2)}</pre>`;
  }

  // ── Main modal ───────────────────────────────────────────────────────────────

  async function showSubmissionDetail(submissionId) {
    document.getElementById("result-modal-title").textContent = "Dang tai...";
    document.getElementById("result-detail-content").innerHTML = '<div class="text-sm text-slate-400 py-8 text-center">Dang tai du lieu...</div>';
    window.AppLayout.openModal("result-detail-modal");

    try {
      const result = await window.AppApi.detail("submissions", submissionId);
      const s = result.data;
      if (!s) {
        document.getElementById("result-detail-content").innerHTML = '<div class="text-sm text-red-600">Khong tim thay bai nop.</div>';
        return;
      }

      document.getElementById("result-modal-title").textContent = `${s.student_name} — ${s.exam_title || s.exam_code || "-"}`;

      const conf = Number(s.ai_confidence ?? 0);
      const hasGrading = s.grading_result_id != null && !["pending", "processing", "failed"].includes(s.grading_status);
      const fileName = s.submission_file_path ? s.submission_file_path.split(/[\\/]/).pop() : null;

      document.getElementById("result-detail-content").innerHTML = `<div class="space-y-5">

        <!-- submissions: thông tin sinh viên & bài thi -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${field("Ma sinh vien", s.student_code)}
          ${field("Ho ten", s.student_name)}
          ${field("Lop", s.class_code)}
          ${field("Mon hoc", s.subject_code)}
          ${field("Ma de thi", s.exam_code)}
          ${field("Ten bai thi", s.exam_title)}
          ${field("Loai bai thi", s.exam_type)}
          ${field("Mon (exams)", s.subject_name)}
        </div>

        <!-- submissions: trạng thái & file -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          ${field("Trang thai nop", renderBadge(s.status))}
          ${field("Thoi gian nop", formatDateTime(s.submitted_at))}
          ${field("Tao luc", formatDateTime(s.created_at))}
          ${field("Cap nhat", formatDateTime(s.updated_at))}
          <div class="sm:col-span-4">
            <div class="text-xs text-slate-500 mb-0.5">File bai lam (submission_file_path)</div>
            ${fileName
              ? `<a href="/uploads/submissions/${fileName}" target="_blank" class="text-blue-600 hover:underline text-sm font-semibold">${fileName}</a>`
              : '<span class="text-slate-400 text-sm">Chua co file</span>'}
          </div>
        </div>

        <!-- submissions.submission_extract: nội dung OCR/extract từ PDF (n8n điền) -->
        ${sectionBlock("Noi dung bai lam — submission_extract", `
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 max-h-60 overflow-y-auto text-sm leading-relaxed">
            ${renderSubmissionExtract(s.submission_extract)}
          </div>
        `)}

        <!-- grading_results: kết quả chấm (lấy attempt cao nhất — do n8n workflow chấm) -->
        ${hasGrading ? `
          <div class="pt-3 border-t border-slate-100 space-y-4">
            <div class="text-xs font-bold text-slate-500 uppercase tracking-wide">Ket qua cham — grading_results (attempt #${s.attempt_no ?? "-"})</div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              ${field("Diem", s.total_score != null
                ? `<span class="text-2xl font-extrabold">${s.total_score}</span> <span class="text-slate-400 text-sm">/ ${s.max_score ?? "?"}</span>`
                : "-")}
              ${field("Loai cham", s.grading_type || "-")}
              ${field("Trang thai", renderBadge(s.grading_status))}
              ${field("Phe duyet", renderBadge(s.review_status, "chua co"))}
              ${field("Cham xong", formatDateTime(s.graded_at))}
              ${field("Duyet luc", formatDateTime(s.reviewed_at))}
              ${field("Published", formatDateTime(s.published_at))}
              <div>
                <div class="text-xs text-slate-500 mb-1">Do tin cay AI</div>
                <div class="flex items-center gap-2">
                  <div class="flex-1 bg-slate-200 rounded-full h-2">
                    <div class="bg-emerald-500 h-2 rounded-full" style="width:${conf}%"></div>
                  </div>
                  <span class="text-sm font-semibold">${conf}%</span>
                </div>
              </div>
            </div>

            ${s.general_feedback ? `
              <div>
                <div class="text-xs text-slate-500 mb-1">general_feedback</div>
                <div class="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm leading-relaxed">${s.general_feedback}</div>
              </div>` : ""}

            ${s.notes ? `
              <div>
                <div class="text-xs text-slate-500 mb-1">review_notes</div>
                <div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">${s.notes}</div>
              </div>` : ""}

            ${s.grading_detail ? `
              <div>
                <div class="text-xs text-slate-500 mb-2">grading_detail</div>
                ${renderGradingDetail(s.grading_detail)}
              </div>` : ""}
          </div>
        ` : `
          <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mt-3">
            Chua co ket qua cham. He thong dang xu ly hoac workflow cham bai chua chay.
          </div>`}

        <!-- Actions -->
        <div class="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
          ${hasGrading ? `<button class="px-3 py-2 rounded-lg border border-amber-200 text-amber-800 hover:bg-amber-50 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed" type="button" data-regrade-submission="${s.id}" ${s.status === "regrade" ? "disabled" : ""}>
            ${s.status === "regrade" ? "Dang cho cham lai..." : "Cham lai"}
          </button>` : ""}
          ${hasGrading ? `<button class="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-semibold" type="button" data-approve-submission="${s.id}">Phe duyet</button>` : ""}
        </div>

      </div>`;

    } catch (error) {
      document.getElementById("result-detail-content").innerHTML = `<div class="text-sm text-red-600">Loi: ${error.message}</div>`;
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


    const rows = currentFilteredRows.map((submission) => {
      const score = submission.total_score != null ? `${submission.total_score}/${submission.max_score ?? "?"}` : "-";
      const conf = submission.ai_confidence != null ? submission.ai_confidence : null;
      const isSelected = String(submission.id) === String(selectedSubmissionId);
      const hasGrading = submission.grading_result_id != null && !["pending", "processing", "failed"].includes(submission.grading_status);
      return `
      <tr class="${isSelected ? "bg-blue-50" : "hover:bg-slate-50"} cursor-pointer transition-colors" data-select-submission="${submission.id}">
        <td class="py-2.5 px-3">
          <div class="font-semibold">${submission.student_name}</div>
          <div class="text-slate-400 text-xs mt-0.5">${submission.student_code} · ${submission.class_code}</div>
        </td>
        <td class="py-2.5 px-3">
          <div class="font-semibold text-xs">${submission.exam_code || "-"}</div>
          <div class="text-slate-400 text-xs mt-0.5">${submission.subject_name || "-"} · ${submission.exam_type || "-"}</div>
        </td>
        <td class="py-2.5 px-3">
          <div class="font-bold">${score}</div>
          ${conf != null ? `<div class="text-xs text-slate-400 mt-0.5">AI: ${conf}%</div>` : ""}
        </td>
        <td class="py-2.5 px-3">
          <div class="flex flex-col gap-1">
            ${renderBadge(submission.grading_status || submission.status)}
            ${submission.review_status ? renderBadge(submission.review_status) : ""}
          </div>
        </td>
        <td class="py-2.5 px-3">
          <div class="flex flex-wrap gap-1.5">
            <button class="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold" type="button" data-view-submission="${submission.id}">Xem</button>
            ${hasGrading ? `<button class="px-2 py-1 rounded-lg border border-amber-200 text-amber-800 hover:bg-amber-50 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed" type="button" data-regrade-submission="${submission.id}" ${submission.status === "regrade" ? "disabled" : ""}>
              ${submission.status === "regrade" ? "Dang cho cham lai..." : "Cham lai"}
            </button>` : ""}
            ${hasGrading ? `<button class="px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold" type="button" data-approve-submission="${submission.id}">Phe duyet</button>` : `<span class="px-2 py-1 text-xs text-slate-400 italic">Chua cham</span>`}
          </div>
        </td>
      </tr>`;
    }).join("");

    document.getElementById("result-table-body").innerHTML = rows || '<tr><td colspan="5" class="py-6 px-3 text-center text-slate-400">Khong co ket qua phu hop bo loc.</td></tr>';

    document.querySelectorAll("[data-select-submission]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) {
          return;
        }

        selectedSubmissionId = row.dataset.selectSubmission;
        renderPage();
      });
    });

  }

  setupDelegatedActions();

  try {
    await loadData();
    renderPage();
  } catch (error) {
    document.getElementById("result-table-body").innerHTML = `<tr><td colspan="11">${error.message}</td></tr>`;
  }
});