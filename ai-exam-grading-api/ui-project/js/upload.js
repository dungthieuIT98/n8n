document.addEventListener("DOMContentLoaded", () => {
  window.AppLayout.init();

  const currentTeacher = window.AppState.getCurrentTeacher();
  const form = document.getElementById("upload-form");
  const message = document.getElementById("upload-message");

  window.AppUI.fillSelect(form.elements.class_code, window.AppUI.classOptions(), false);
  window.AppUI.fillSelect(form.elements.subject_code, window.AppUI.subjectOptions(), false);
  form.elements.teacher_id.value = currentTeacher.id;
  form.elements.teacher_id.readOnly = true;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const questionFile = form.elements.question_file.files[0];
    const answerFile = form.elements.answer_file.files[0];
    const submitButton = form.querySelector('button[type="submit"]');

    if (!questionFile || !answerFile) {
      message.innerHTML = '<div class="message error">Can chon day du file de thi va file dap an.</div>';
      return;
    }

    submitButton.disabled = true;

    try {
      const formData = new FormData();
      formData.set("title", form.elements.title.value.trim());
      formData.set("description", form.elements.description.value.trim());
      formData.set("class_code", form.elements.class_code.value);
      formData.set("subject_code", form.elements.subject_code.value);
      formData.set("subject_name", window.AppUI.getSubjectName(form.elements.subject_code.value));
      formData.set("exam_type", form.elements.exam_type.value);
      formData.set("exam_round", form.elements.exam_round.value);
      formData.set("teacher_id", currentTeacher.id);
      formData.set("question_file", questionFile);
      formData.set("answer_file", answerFile);

      const payload = await window.AppApi.createExam(formData);
      message.innerHTML = `<div class="message success">Da tao de thi ${payload.data.exam_code}. Trang thai hien tai: ${payload.data.status}.</div>`;
      form.reset();
      form.elements.teacher_id.value = currentTeacher.id;
    } catch (error) {
      message.innerHTML = `<div class="message error">${error.message}</div>`;
    } finally {
      submitButton.disabled = false;
    }
  });
});