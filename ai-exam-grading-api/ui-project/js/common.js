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
    return `<span class="status ${status}">${status}</span>`;
  }

  function renderQuestionList(questions) {
    if (!questions || !questions.length) {
      return `<div class="list-card">Chua co du lieu cau hoi vi bai nop dang loi hoac chua extract xong.</div>`;
    }

    return questions.map((item) => `
      <div class="question-item">
        <h4>Cau ${item.no} ${renderStatus(item.result === "Dung" ? "approved" : "failed")}</h4>
        <p><strong>De bai:</strong> ${item.question}</p>
        <p><strong>Tra loi:</strong> ${item.student_answer}</p>
        <p><strong>Dap an dung:</strong> ${item.correct_answer}</p>
        <p><strong>Diem:</strong> ${item.score}</p>
        <p><strong>Giai thich:</strong> ${item.explanation}</p>
      </div>
    `).join("");
  }

  function renderSubmissionDetail(submission) {
    if (!submission) {
      return "<h3>Chi tiet bai lam</h3><p>Khong tim thay bai nop.</p>";
    }

    return `
      <h3>${submission.student_name} - ${submission.exam_title}</h3>
      <div class="detail-meta">
        <div><strong>student_code</strong><br>${submission.student_code}</div>
        <div><strong>Lop</strong><br>${submission.class_code}</div>
        <div><strong>Mon hoc</strong><br>${submission.subject_name}</div>
        <div><strong>Loai bai thi</strong><br>${submission.exam_type}</div>
        <div><strong>Diem tong</strong><br>${submission.total_score}/${submission.max_score}</div>
        <div><strong>AI confidence</strong><br>${submission.ai_confidence ? `${submission.ai_confidence}%` : "-"}</div>
        <div><strong>Trang thai</strong><br>${renderStatus(submission.status)}</div>
        <div><strong>Phe duyet</strong><br>${renderStatus(submission.review_status)}</div>
      </div>
      <div class="list-card">
        <p><strong>De thi:</strong> ${submission.exam_code || "-"}</p>
        <p><strong>File bai nop:</strong> ${submission.submission_file_path || "-"}</p>
        <p><strong>Ket qua JSON:</strong> ${submission.grading_result_file_path || "-"}</p>
        <p><strong>Ghi chu:</strong> ${submission.notes || "Khong co"}</p>
      </div>
      <div class="question-list" style="margin-top: 14px;">${renderQuestionList(submission.questions || [])}</div>
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