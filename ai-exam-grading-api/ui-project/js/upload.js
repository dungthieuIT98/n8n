document.addEventListener("DOMContentLoaded", async () => {
  window.AppLayout.init();

  const currentTeacher = window.AppState.getCurrentTeacher();
  const form = document.getElementById("upload-form");
  const message = document.getElementById("upload-message");

  let subjectsByCode = new Map();

  function renderMessage(type, text) {
    if (!text) {
      message.innerHTML = "";
      return;
    }

    const map = {
      success: "border-emerald-200 bg-emerald-50 text-emerald-800",
      error: "border-red-200 bg-red-50 text-red-800",
      info: "border-slate-200 bg-slate-50 text-slate-800"
    };
    const cls = map[type] || map.info;
    message.innerHTML = `<div class="rounded-xl border p-3 text-sm ${cls}">${text}</div>`;
  }

  function fillSelect(select, items, placeholder) {
    const safe = Array.isArray(items) ? items : [];
    select.innerHTML = [
      `<option value="">${placeholder || "Chon"}</option>`,
      ...safe.map((item) => `<option value="${String(item.value)}">${item.label}</option>`)
    ].join("");
  }

  async function loadMasterData() {
    renderMessage("info", "Dang tai danh sach lop / mon / dot thi...");
    try {
      const [classesPayload, subjectsPayload, periodsPayload] = await Promise.all([
        window.AppApi.list("classes"),
        window.AppApi.list("subjects"),
        window.AppApi.list("exam-periods")
      ]);

      const classes = classesPayload.data || [];
      const subjects = subjectsPayload.data || [];
      const periods = periodsPayload.data || [];

      function pickValueLabel(row, primaryValueKey, primaryLabelKey, fallbackValueKey, fallbackLabelKey) {
        const primaryValue = row?.[primaryValueKey];
        const primaryLabel = row?.[primaryLabelKey];
        const fallbackValue = row?.[fallbackValueKey];
        const fallbackLabel = row?.[fallbackLabelKey];

        const value = (primaryValue ?? fallbackValue ?? "").toString();
        const labelValue = (primaryValue ?? fallbackValue ?? "").toString();
        const labelName = (primaryLabel ?? fallbackLabel ?? "").toString();
        const label = labelName ? `${labelValue} - ${labelName}` : labelValue;
        return { value, label };
      }

      fillSelect(
        form.elements.class_code,
        // Lop hoc lay tu bang classes
        classes
          .filter((x) => !x.status || x.status === "active")
          .map((x) => pickValueLabel(x, "class_code", "class_name", "subject_code", "subject_name")),
        "Chon lop"
      );

      fillSelect(
        form.elements.subject_code,
        // Mon hoc lay tu bang subjects
        subjects
          .filter((x) => !x.status || x.status === "active")
          .map((x) => pickValueLabel(x, "subject_code", "subject_name", "class_code", "class_name")),
        "Chon mon"
      );

      // Build subject name map from the same data source as Mon hoc select
      subjectsByCode = new Map(
        subjects.map((x) => {
          const code = String((x?.subject_code ?? x?.class_code ?? "") || "").trim();
          const name = String((x?.subject_name ?? x?.class_name ?? "") || "").trim();
          return [code, name];
        }).filter(([code]) => Boolean(code))
      );

      fillSelect(
        form.elements.exam_round,
        periods
          .filter((x) => !x.status || x.status === "active")
          .map((x) => ({
            value: x.period_code,
            label: x.period_name ? `${x.period_code} - ${x.period_name}` : String(x.period_code)
          })),
        "Chon dot"
      );

      renderMessage("", "");
    } catch (error) {
      console.error(error);
      // Fallback to previous defaults if master-data API is not ready
      window.AppUI.fillSelect(form.elements.class_code, window.AppUI.classOptions(), false);
      window.AppUI.fillSelect(form.elements.subject_code, window.AppUI.subjectOptions(), false);
      renderMessage("error", `Khong the tai master data (lop/mon/dot thi). Dang dung option mac dinh. Loi: ${error.message}`);
    }
  }

  await loadMasterData();

  // Show teach_id (teacher_code) on UI; backend still resolves teacher_id from session if needed
  if (!currentTeacher) {
    renderMessage("error", "Chua dang nhap. Vui long dang nhap lai de thay teach_id.");
    form.querySelectorAll("input, select, button, textarea").forEach((el) => {
      el.disabled = true;
    });
    return;
  }

  const teachId = currentTeacher.teacher_code || currentTeacher.teach_id || currentTeacher.teacher_id || String(currentTeacher.id || "");
  form.elements.teacher_id.value = teachId;
  form.elements.teacher_id.readOnly = true;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const questionFile = form.elements.question_file.files[0];
    const answerFile = form.elements.answer_file.files[0];
    const submitButton = form.querySelector('button[type="submit"]');

    if (!questionFile || !answerFile) {
      renderMessage("error", "Can chon day du file de thi va file dap an.");
      return;
    }

    submitButton.disabled = true;
    renderMessage("info", "Dang tao de thi va tai file...");

    try {
      const formData = new FormData();
      formData.set("title", form.elements.title.value.trim());
      formData.set("description", form.elements.description.value.trim());
      formData.set("class_code", form.elements.class_code.value);
      formData.set("subject_code", form.elements.subject_code.value);
      const subjectCode = String(form.elements.subject_code.value || "").trim();
      const subjectName = subjectsByCode.get(subjectCode) || window.AppUI.getSubjectName(subjectCode);
      formData.set("subject_name", subjectName);
      formData.set("exam_type", form.elements.exam_type.value);
      formData.set("exam_round", form.elements.exam_round.value);
      // keep numeric teacher_id if available; otherwise server will fallback to session teacher.id
      if (currentTeacher.id) {
        formData.set("teacher_id", currentTeacher.id);
      }
      formData.set("question_file", questionFile);
      formData.set("answer_file", answerFile);

      const payload = await window.AppApi.createExam(formData);
      renderMessage("success", `Da tao de thi ${payload.data.exam_code}. Trang thai hien tai: ${payload.data.status}.`);
      form.reset();
      form.elements.teacher_id.value = teachId;
    } catch (error) {
      renderMessage("error", error.message);
    } finally {
      submitButton.disabled = false;
    }
  });
});