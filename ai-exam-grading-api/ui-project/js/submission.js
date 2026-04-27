document.addEventListener("DOMContentLoaded", async () => {
  window.AppLayout.init();

  const form = document.getElementById("submission-form");
  const message = document.getElementById("upload-message");
    const examIdInput = document.getElementById("exam-id"); // hidden input
  const examIdDisplay = document.getElementById("exam-id-display");
  const subjectCodeInput = form.elements.subject_code;
  const infoDisplay = document.getElementById("exam-info-display");

  // custom dropdown elements
  const dropdownBtn = document.getElementById("exam-dropdown-btn");
  const dropdownLabel = document.getElementById("exam-dropdown-label");
  const dropdownPanel = document.getElementById("exam-dropdown-panel");
  const dropdownList = document.getElementById("exam-dropdown-list");
  const filterClass = document.getElementById("filter-class");
  const filterSubject = document.getElementById("filter-subject");
  const filterType = document.getElementById("filter-type");

  let exams = [];
  let selectedExam = null;

  function renderMessage(type, text) {
    if (!text) { message.innerHTML = ""; return; }
    const map = {
      success: "border-emerald-200 bg-emerald-50 text-emerald-800",
      error: "border-red-200 bg-red-50 text-red-800",
      info: "border-slate-200 bg-slate-50 text-slate-800"
    };
    message.innerHTML = `<div class="rounded-xl border p-3 text-sm ${map[type] || map.info}">${text}</div>`;
  }

  function resetExamDetails() {
    selectedExam = null;
    examIdInput.value = "";
    examIdDisplay.value = "";
    subjectCodeInput.value = "";
    dropdownLabel.textContent = "Chon bai thi";
    dropdownLabel.classList.add("text-slate-400");
    dropdownLabel.classList.remove("text-slate-900");
    document.getElementById("exam-subject").textContent = "-";
    document.getElementById("exam-type").textContent = "-";
    document.getElementById("exam-code").textContent = "-";
    infoDisplay.classList.add("hidden");
  }

  function examLabel(exam) {
    return [
      exam.class_code || "N/A",
      exam.subject_code || "N/A",
      exam.exam_type || "N/A",
      exam.exam_round || "N/A"
    ].join(" · ");
  }

  function renderList() {
    const fc = filterClass.value.trim().toLowerCase();
    const fs = filterSubject.value.trim().toLowerCase();
    const ft = filterType.value.trim().toLowerCase();

    const filtered = exams.filter((e) =>
      (!fc || (e.class_code || "").toLowerCase().includes(fc)) &&
      (!fs || (e.subject_code || "").toLowerCase().includes(fs) || (e.subject_name || "").toLowerCase().includes(fs)) &&
      (!ft || (e.exam_type || "").toLowerCase().includes(ft))
    );

    if (!filtered.length) {
      dropdownList.innerHTML = `<li class="px-3 py-3 text-xs text-slate-400 text-center">Khong tim thay bai thi</li>`;
      return;
    }

    dropdownList.innerHTML = filtered.map((exam) => `
      <li data-exam-id="${exam.id}"
        class="px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center gap-2 ${selectedExam?.id === exam.id ? "bg-slate-100 font-semibold" : ""}">
        <span class="text-xs">${examLabel(exam)}</span>
      </li>
    `).join("");

    dropdownList.querySelectorAll("li[data-exam-id]").forEach((li) => {
      li.addEventListener("click", () => selectExam(li.dataset.examId));
    });
  }

  function selectExam(id) {
    const exam = exams.find((e) => String(e.id) === String(id));
    if (!exam) return;

    selectedExam = exam;
    examIdInput.value = String(exam.id);
    examIdDisplay.value = String(exam.id);
    subjectCodeInput.value = exam.subject_code || "";

    dropdownLabel.textContent = examLabel(exam);
    dropdownLabel.classList.remove("text-slate-400");
    dropdownLabel.classList.add("text-slate-900");

    document.getElementById("exam-subject").textContent = exam.subject_name || exam.subject_code || "-";
    document.getElementById("exam-type").textContent = exam.exam_type || "-";
    document.getElementById("exam-code").textContent = exam.exam_code || "-";
    infoDisplay.classList.remove("hidden");

    if (!form.elements.class_code.value) {
      form.elements.class_code.value = exam.class_code || "";
    }

    closeDropdown();
  }

  function openDropdown() {
    dropdownPanel.classList.remove("hidden");
    filterClass.value = "";
    filterSubject.value = "";
    filterType.value = "";
    renderList();
    filterClass.focus();
  }

  function closeDropdown() {
    dropdownPanel.classList.add("hidden");
  }

  dropdownBtn.addEventListener("click", () => {
    dropdownPanel.classList.contains("hidden") ? openDropdown() : closeDropdown();
  });

  [filterClass, filterSubject, filterType].forEach((el) => {
    el.addEventListener("input", renderList);
  });

  // close on outside click
  document.addEventListener("click", (e) => {
    if (!document.getElementById("exam-dropdown").contains(e.target)) closeDropdown();
  });

  // Load exams list
  async function loadExams() {
    try {
      const payload = await window.AppApi.publicExams();
      exams = payload.data || [];
      renderList();
    } catch (error) {
      console.error("Failed to load exams:", error);
      renderMessage("error", `Khong the tai danh sach bai thi: ${error.message}`);
    }
  }

  // Handle form submission
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = document.getElementById("submit-btn");
    const submissionFile = document.getElementById("submission-file")?.files?.[0];

    if (!submissionFile) { renderMessage("error", "Vui long chon file bai lam."); return; }
    if (!examIdInput.value) { renderMessage("error", "Vui long chon bai thi."); return; }
    if (!subjectCodeInput.value.trim()) { renderMessage("error", "Thong tin bai thi chua day du. Vui long chon lai."); return; }
    if (!submissionFile.name.toLowerCase().endsWith(".pdf")) { renderMessage("error", "Vui long tai len file .pdf."); return; }

    submitButton.disabled = true;
    renderMessage("info", "Dang dua bai lam...");

    try {
      const formData = new FormData();
      formData.set("student_name", form.elements.student_name.value.trim());
      formData.set("student_code", form.elements.student_code.value.trim());
      formData.set("class_code", form.elements.class_code.value.trim());
      formData.set("subject_code", subjectCodeInput.value.trim());
      formData.set("exam_id", examIdInput.value.trim());
      formData.set("notes", form.elements.notes.value.trim());
      formData.set("submission_file", submissionFile);

      if (selectedExam) {
        formData.set("exam_code", selectedExam.exam_code || "");
        formData.set("exam_type", selectedExam.exam_type || "");
        formData.set("subject_name", selectedExam.subject_name || "");
      }

      await window.AppApi.submitExamSubmission(formData);
      renderMessage("success", `Da nop bai lam thanh cong! De: ${selectedExam?.exam_code || "N/A"}. Vui long doi cham diem.`);
      form.reset();
      resetExamDetails();
    } catch (error) {
      renderMessage("error", `Loi khi nop bai: ${error.message}`);
    } finally {
      submitButton.disabled = false;
    }
  });

  await loadExams();
});
