(function () {
  const DEFAULT_CLASS_OPTIONS = ["12A1", "12A2", "11B1", "10C3"];
  const DEFAULT_SUBJECT_OPTIONS = [
    { code: "MATH", name: "Toan hoc" },
    { code: "PHY", name: "Vat ly" },
    { code: "LIT", name: "Ngu van" },
    { code: "ENG", name: "Tieng Anh" }
  ];

  function fillSelect(select, options, includeAll) {
    const items = includeAll
      ? [{ value: "", label: "Tat ca" }].concat(options)
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
      { value: "15p", label: "15 phut" },
      { value: "giua_ky", label: "Giua ky" },
      { value: "cuoi_ky", label: "Cuoi ky" },
      { value: "thu", label: "Thu" }
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

      failed: "bg-red-50 text-red-700 border-red-200",
      rejected: "bg-red-50 text-red-700 border-red-200"
    };

    const cls = map[s] || "bg-slate-50 text-slate-700 border-slate-200";
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${cls}">${status}</span>`;
  }

  function renderQuestionList(questions) {
    if (!questions || !questions.length) {
      return `<div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Chua co du lieu cau hoi vi bai nop dang loi hoac chua extract xong.</div>`;
    }

    return questions.map((item) => `
      <div class="rounded-xl border border-slate-200 p-4 space-y-2">
        <div class="flex items-center justify-between gap-3">
          <div class="font-extrabold">Cau ${item.no}</div>
          <div>${renderStatus(item.result === "Dung" ? "approved" : "failed")}</div>
        </div>
        <div class="text-sm space-y-1">
          <div><span class="font-semibold">De bai:</span> ${item.question}</div>
          <div><span class="font-semibold">Tra loi:</span> ${item.student_answer}</div>
          <div><span class="font-semibold">Dap an dung:</span> ${item.correct_answer}</div>
          <div><span class="font-semibold">Diem:</span> ${item.score}</div>
          <div><span class="font-semibold">Giai thich:</span> ${item.explanation}</div>
        </div>
      </div>
    `).join("");
  }

  function renderSubmissionDetail(submission) {
    if (!submission) {
      return '<div class="text-sm text-slate-700">Khong tim thay bai nop.</div>';
    }

    return `
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">student_code</div>
            <div class="font-bold">${submission.student_code}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Lop</div>
            <div class="font-bold">${submission.class_code}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Mon hoc</div>
            <div class="font-bold">${submission.subject_name}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Loai bai thi</div>
            <div class="font-bold">${submission.exam_type}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Diem tong</div>
            <div class="font-bold">${submission.total_score}/${submission.max_score}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">AI confidence</div>
            <div class="font-bold">${submission.ai_confidence ? `${submission.ai_confidence}%` : "-"}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Trang thai</div>
            <div>${renderStatus(submission.status)}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <div class="text-xs font-semibold text-slate-500">Phe duyet</div>
            <div>${submission.review_status ? renderStatus(submission.review_status) : "-"}</div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 p-4 text-sm space-y-2">
          <div><span class="font-semibold">De thi:</span> ${submission.exam_code || "-"}</div>
          <div><span class="font-semibold">File bai nop:</span> ${submission.submission_file_path || "-"}</div>
          <div><span class="font-semibold">Ket qua JSON:</span> ${submission.grading_result_file_path || "-"}</div>
          <div><span class="font-semibold">Ghi chu:</span> ${submission.notes || "Khong co"}</div>
        </div>

        <div class="space-y-3">${renderQuestionList(submission.questions || [])}</div>
      </div>
    `;
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
    downloadCsv
  };
})();