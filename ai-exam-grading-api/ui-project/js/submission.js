document.addEventListener("DOMContentLoaded", async () => {
  window.AppLayout.init();

  const form = document.getElementById("submission-form");
  const message = document.getElementById("upload-message");
  const examSelect = form.elements.exam_id;
  const examIdDisplay = document.getElementById("exam-id-display");
  const subjectCodeInput = form.elements.subject_code;
  const infoDisplay = document.getElementById("exam-info-display");
  let exams = [];

  function renderMessage(type, text) {
    message.innerHTML = `<div class="message ${type}">${text}</div>`;
  }

  function resetExamDetails() {
    examIdDisplay.value = "";
    subjectCodeInput.value = "";
    document.getElementById("exam-subject").textContent = "-";
    document.getElementById("exam-type").textContent = "-";
    document.getElementById("exam-code").textContent = "-";
    infoDisplay.style.display = "none";
  }

  // Load exams list
  async function loadExams() {
    try {
      const payload = await window.AppApi.list("exams", { limit: 100 });
      exams = payload.data || [];
      
      examSelect.innerHTML = '<option value="">Chon bai thi</option>';
      exams.forEach((exam) => {
        const option = document.createElement("option");
        option.value = exam.id;
        option.textContent = `${exam.title} - ${exam.subject_code || "N/A"} - ${exam.class_code || "N/A"}`;
        examSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Failed to load exams:", error);
      renderMessage("error", `Khong the tai danh sach bai thi: ${error.message}`);
    }
  }

  // Display exam info when selected
  examSelect.addEventListener("change", () => {
    if (examSelect.value) {
      const selectedExam = exams.find((e) => String(e.id) === String(examSelect.value));
      if (selectedExam) {
        examIdDisplay.value = String(selectedExam.id || "");
        subjectCodeInput.value = selectedExam.subject_code || "";
        document.getElementById("exam-subject").textContent = selectedExam.subject_name;
        document.getElementById("exam-type").textContent = selectedExam.exam_type;
        document.getElementById("exam-code").textContent = selectedExam.exam_code;
        infoDisplay.style.display = "block";

        // Pre-fill class_code from exam if empty
        if (!form.elements.class_code.value) {
          form.elements.class_code.value = selectedExam.class_code;
        }
      }
    } else {
      resetExamDetails();
    }
  });

  // Handle form submission
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const submissionFile = form.elements.submission_file.files[0];

    if (!submissionFile) {
      renderMessage("error", "Vui long chon file bai lam.");
      return;
    }

    if (!examSelect.value) {
      renderMessage("error", "Vui long chon bai thi.");
      return;
    }

    if (!examIdDisplay.value.trim() || !subjectCodeInput.value.trim()) {
      renderMessage("error", "Thong tin bai thi chua day du. Vui long chon lai bai thi.");
      return;
    }

    if (submissionFile.type && submissionFile.type !== "application/pdf") {
      renderMessage("error", "Workflow hien tai chi chap nhan file PDF.");
      return;
    }

    if (!submissionFile.name.toLowerCase().endsWith(".pdf")) {
      renderMessage("error", "Vui long tai len file .pdf.");
      return;
    }

    submitButton.disabled = true;
    renderMessage("", "Dang dua bai lam...");

    try {
      const selectedExam = exams.find((e) => String(e.id) === String(examSelect.value));
      const formData = new FormData();

      formData.set("student_name", form.elements.student_name.value.trim());
      formData.set("student_code", form.elements.student_code.value.trim());
      formData.set("class_code", form.elements.class_code.value.trim());
      formData.set("subject_code", subjectCodeInput.value.trim());
      formData.set("exam_id", examIdDisplay.value.trim());
      formData.set("notes", form.elements.notes.value.trim());
      formData.set("submission_file", submissionFile);

      if (selectedExam) {
        formData.set("exam_code", selectedExam.exam_code || "");
        formData.set("exam_type", selectedExam.exam_type || "");
        formData.set("subject_name", selectedExam.subject_name || "");
      }

      await window.AppApi.submitExamSubmission(formData);
      renderMessage("success", `Da nop bai lam thanh cong! Ho tro de: ${selectedExam?.exam_code || "N/A"}. Vui long doi cham diem.`);
      form.reset();
      resetExamDetails();
    } catch (error) {
      renderMessage("error", `Loi khi nop bai: ${error.message}`);
    } finally {
      submitButton.disabled = false;
    }
  });

  // Load exams on page load
  await loadExams();
});
