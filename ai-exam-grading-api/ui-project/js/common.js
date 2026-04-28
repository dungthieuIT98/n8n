(function () {
  const DEFAULT_CLASS_OPTIONS = ["12A1", "12A2", "11B1", "10C3"];
  const DEFAULT_SUBJECT_OPTIONS = [
    { code: "MATH", name: "Toán học" },
    { code: "PHY", name: "Vật lý" },
    { code: "LIT", name: "Ngữ văn" },
    { code: "ENG", name: "Tiếng Anh" }
  ];

  function fillSelect(select, options, includeAll) {
    const items = includeAll
      ? [{ value: "", label: "Tất cả" }].concat(options)
      : options;
    select.innerHTML = items.map((item) => `<option value="${item.value}">${item.label}</option>`).join("");
  }

  function classOptions(records) {
    const values = new Set(DEFAULT_CLASS_OPTIONS);
    (records || []).forEach((item) => {
      if (item.class_code) {
        values.add(item.class_code);
      }
    });

    return Array.from(values).sort().map((value) => ({ value, label: value }));
  }

  function subjectOptions(records) {
    const values = new Map(DEFAULT_SUBJECT_OPTIONS.map((item) => [item.code, item.name]));
    (records || []).forEach((item) => {
      if (item.subject_code && item.subject_name) {
        values.set(item.subject_code, item.subject_name);
      }
    });

    return Array.from(values.entries()).map(([code, name]) => ({ value: code, label: `${code} - ${name}` }));
  }

  function getSubjectName(subjectCode) {
    const found = DEFAULT_SUBJECT_OPTIONS.find((item) => item.code === subjectCode);
    return found ? found.name : subjectCode;
  }

  function examTypeOptions() {
    return [
      { value: "15p", label: "15 phút" },
      { value: "giua_ky", label: "Giữa kỳ" },
      { value: "cuoi_ky", label: "Cuối kỳ" },
      { value: "thu", label: "Thử" }
    ];
  }

  function examStatusOptions() {
    return [
      { value: "draft", label: "draft" },
      { value: "processing", label: "processing" },
      { value: "ready", label: "ready" },
      { value: "archived", label: "archived" }
    ];
  }

  function submissionStatusOptions() {
    return [
      { value: "uploaded", label: "uploaded" },
      { value: "extracting", label: "extracting" },
      { value: "extracted", label: "extracted" },
      { value: "grading", label: "grading" },
      { value: "graded", label: "graded" },
      { value: "regrade", label: "regrade" },
      { value: "published", label: "published" },
      { value: "failed", label: "failed" }
    ];
  }

  function logTypeOptions() {
    return [
      { value: "exam_extract", label: "exam_extract" },
      { value: "submission_extract", label: "submission_extract" },
      { value: "grading", label: "grading" },
      { value: "publish", label: "publish" },
      { value: "retry", label: "retry" }
    ];
  }

  function logStatusOptions() {
    return [
      { value: "queued", label: "queued" },
      { value: "running", label: "running" },
      { value: "success", label: "success" },
      { value: "failed", label: "failed" }
    ];
  }

  function renderStatus(status) {
    const s = String(status || "").toLowerCase();
    const map = {
      published: "bg-emerald-50 text-emerald-700 border-emerald-200",
      approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      success: "bg-emerald-50 text-emerald-700 border-emerald-200",
      ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
      active: "bg-emerald-50 text-emerald-700 border-emerald-200",

      processing: "bg-sky-50 text-sky-700 border-sky-200",
      running: "bg-sky-50 text-sky-700 border-sky-200",
      extracting: "bg-sky-50 text-sky-700 border-sky-200",
      grading: "bg-sky-50 text-sky-700 border-sky-200",

      uploaded: "bg-slate-50 text-slate-700 border-slate-200",
      extracted: "bg-slate-50 text-slate-700 border-slate-200",
      graded: "bg-slate-50 text-slate-700 border-slate-200",
      queued: "bg-slate-50 text-slate-700 border-slate-200",
      draft: "bg-slate-50 text-slate-700 border-slate-200",
      archived: "bg-slate-50 text-slate-700 border-slate-200",

      warning: "bg-amber-50 text-amber-800 border-amber-200",
      recheck: "bg-amber-50 text-amber-800 border-amber-200",
      regrade: "bg-amber-50 text-amber-800 border-amber-200",

      failed: "bg-red-50 text-red-700 border-red-200",
      rejected: "bg-red-50 text-red-700 border-red-200"
    };

    const cls = map[s] || "bg-slate-50 text-slate-700 border-slate-200";
    const labelMap = {
      draft: "Nháp",
      processing: "Đang xử lý",
      ready: "Sẵn sàng",
      archived: "Lưu trữ",
      active: "Hoạt động",

      uploaded: "Đã tải lên",
      extracting: "Đang trích xuất",
      extracted: "Đã trích xuất",
      grading: "Đang chấm",
      graded: "Đã chấm",
      regrade: "Chấm lại",
      published: "Đã công bố",

      queued: "Đang chờ",
      running: "Đang chạy",
      success: "Thành công",
      failed: "Thất bại",

      approved: "Đạt",
      rejected: "Không đạt",
      warning: "Cảnh báo",
      recheck: "Cần kiểm tra lại"
    };
    const label = labelMap[s] || String(status ?? "");
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${cls}">${label}</span>`;
  }

  function renderQuestionList(questions) {
    if (!questions || !questions.length) {
      return `<div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Chưa có dữ liệu câu hỏi vì bài nộp đang lỗi hoặc chưa trích xuất xong.</div>`;
    }

    return questions.map((item) => `
      <div class="rounded-xl border border-slate-200 p-4 space-y-2">
        <div class="flex items-center justify-between gap-3">
          <div class="font-extrabold">Câu ${item.no}</div>
          <div>${renderStatus(item.result === "Dung" ? "approved" : "failed")}</div>
        </div>
        <div class="text-sm space-y-1">
          <div><span class="font-semibold">Đề bài:</span> ${item.question}</div>
          <div><span class="font-semibold">Trả lời:</span> ${item.student_answer}</div>
          <div><span class="font-semibold">Đáp án đúng:</span> ${item.correct_answer}</div>
          <div><span class="font-semibold">Điểm:</span> ${item.score}</div>
          <div><span class="font-semibold">Giải thích:</span> ${item.explanation}</div>
        </div>
      </div>
    `).join("");
  }

  function renderSubmissionDetail(submission) {
    if (!submission) {
      return '<div class="text-sm text-slate-700">Không tìm thấy bài nộp.</div>';
    }

    return `
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">student_code</div>
            <div class="font-bold">${submission.student_code}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Lớp</div>
            <div class="font-bold">${submission.class_code}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Môn học</div>
            <div class="font-bold">${submission.subject_name}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Loại bài thi</div>
            <div class="font-bold">${submission.exam_type}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Điểm tổng</div>
            <div class="font-bold">${submission.total_score}/${submission.max_score}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Độ tin cậy AI</div>
            <div class="font-bold">${submission.ai_confidence ? `${submission.ai_confidence}%` : "-"}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Trạng thái</div>
            <div>${renderStatus(submission.status)}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Phê duyệt</div>
            <div>${submission.review_status ? renderStatus(submission.review_status) : "-"}</div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 p-4 text-sm space-y-2">
          <div><span class="font-semibold">Đề thi:</span> ${submission.exam_code || "-"}</div>
          <div><span class="font-semibold">File bài nộp:</span> ${submission.submission_file_path ? `<a href="${submission.submission_file_path}" target="_blank" class="text-blue-600 hover:underline">${submission.submission_file_path.split('/').pop()}</a>` : "-"}</div>
          <div><span class="font-semibold">Kết quả JSON:</span> ${submission.grading_result_file_path || "-"}</div>
          <div><span class="font-semibold">Ghi chú:</span> ${submission.notes || "Không có"}</div>
        </div>

        <div class="space-y-3">${renderQuestionList(submission.questions || [])}</div>
      </div>
    `;
  }

  function fileUrl(filePath) {
    if (!filePath) return null;
    if (/^https?:\/\//i.test(filePath)) return filePath;
    return '/' + filePath.replace(/\\/g, '/').replace(/^\//, '');
  }

  function renderPagination(containerId, total, currentPage, pageSize, onPageChange) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const totalPages = Math.ceil(total / pageSize);

    if (totalPages <= 1) {
      el.innerHTML = total > 0 ? `<span class="text-xs text-slate-500">${total} dòng</span>` : '';
      return;
    }

    const range = [];
    const delta = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }
    const withEllipsis = [];
    let prev = null;
    for (const p of range) {
      if (prev !== null && p - prev > 1) withEllipsis.push('...');
      withEllipsis.push(p);
      prev = p;
    }

    el.innerHTML = `
      <span class="text-xs text-slate-500">${total} dòng &middot; Trang ${currentPage}/${totalPages}</span>
      <div class="flex items-center gap-1 flex-wrap">
        <button ${currentPage === 1 ? 'disabled' : ''} id="${containerId}-prev" class="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">&#8249; Trước</button>
        ${withEllipsis.map((p) => p === '...'
          ? `<span class="px-1 text-xs text-slate-400">...</span>`
          : `<button class="px-2.5 py-1 rounded-lg border text-xs font-semibold ${p === currentPage ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 hover:bg-slate-50'}" data-page="${p}">${p}</button>`
        ).join('')}
        <button ${currentPage === totalPages ? 'disabled' : ''} id="${containerId}-next" class="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Sau &#8250;</button>
      </div>
    `;

    document.getElementById(`${containerId}-prev`)?.addEventListener('click', () => onPageChange(currentPage - 1));
    document.getElementById(`${containerId}-next`)?.addEventListener('click', () => onPageChange(currentPage + 1));
    el.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => onPageChange(Number(btn.dataset.page)));
    });
  }

  function downloadCsv(fileName, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  window.AppUI = {
    fillSelect,
    classOptions,
    subjectOptions,
    getSubjectName,
    examTypeOptions,
    examStatusOptions,
    submissionStatusOptions,
    logTypeOptions,
    logStatusOptions,
    renderStatus,
    renderSubmissionDetail,
    renderPagination,
    downloadCsv
  };
})();