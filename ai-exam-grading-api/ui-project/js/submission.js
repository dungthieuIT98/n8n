document.addEventListener("DOMContentLoaded", async () => {
  window.AppLayout.init();

  const form = document.getElementById("submission-form");
  const message = document.getElementById("upload-message");
  const examSelect = form.elements.exam_id;
  const infoDisplay = document.getElementById("exam-info-display");
  let exams = [];

  // Load exams list
  async function loadExams() {
    try {
      const payload = await window.AppApi.list("exams", { limit: 100 });
      exams = payload.data || [];
      
      examSelect.innerHTML = '<option value="">Chon bai thi</option>';
      exams.forEach((exam) => {
        const option = document.createElement("option");
        option.value = exam.id;
        option.textContent = `${exam.exam_code} - ${exam.title} (${exam.class_code})`;
        examSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Failed to load exams:", error);
      message.innerHTML = `<div class="message error">Khong the tai danh sach bai thi: ${error.message}</div>`;
    }
  }

  // Display exam info when selected
  examSelect.addEventListener("change", () => {
    if (examSelect.value) {
      const selectedExam = exams.find((e) => String(e.id) === String(examSelect.value));
      if (selectedExam) {
        document.getElementById("exam-title").textContent = selectedExam.title;
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
      infoDisplay.style.display = "none";
    }
  });

  // Handle form submission
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const submissionFile = form.elements.submission_file.files[0];

    if (!submissionFile) {
      message.innerHTML = '<div class="message error">Vui long chon file bai lam.</div>';
      return;
    }

    if (!examSelect.value) {
      message.innerHTML = '<div class="message error">Vui long chon bai thi.</div>';
      return;
    }

    if (submissionFile.type && submissionFile.type !== "application/pdf") {
      message.innerHTML = '<div class="message error">Workflow hien tai chi chap nhan file PDF.</div>';
      return;
    }

    if (!submissionFile.name.toLowerCase().endsWith(".pdf")) {
      message.innerHTML = '<div class="message error">Vui long tai len file .pdf.</div>';
      return;
    }

    submitButton.disabled = true;
    message.innerHTML = '<div class="message"><p>Dang dua bai lam...</p></div>';

    try {
      const selectedExam = exams.find((e) => String(e.id) === String(examSelect.value));
      const formData = new FormData();

      formData.set("student_name", form.elements.student_name.value.trim());
      formData.set("student_code", form.elements.student_code.value.trim());
      formData.set("subject_code", selectedExam.subject_code);
      formData.set("exam_title", selectedExam.title);
      formData.set("notes", form.elements.notes.value.trim());
      formData.set("class_code", form.elements.class_code.value.trim());
      formData.set("submission_file", submissionFile);

      const payload = await window.AppApi.submitExamSubmission(formData);
      message.innerHTML = `<div class="message success">Da nop bai lam thanh cong! Ho tro de: ${selectedExam.exam_code}. Vui long doi cham diem.</div>`;
      form.reset();
      infoDisplay.style.display = "none";
    } catch (error) {
      message.innerHTML = `<div class="message error">Loi khi nop bai: ${error.message}</div>`;
    } finally {
      submitButton.disabled = false;
    }
  });

  // Load exams on page load
  await loadExams();

  // Logout handler
  document.querySelectorAll(".js-logout").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        if (window.AppState.getAuthToken()) {
          await window.AppApi.logout();
        }
      } catch (error) {
        console.error(error);
      } finally {
        window.AppState.clearSession();
        window.location.href = "login.html";
      }
    });
  });
});
