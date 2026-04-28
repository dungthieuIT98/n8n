document.addEventListener('DOMContentLoaded', async () => {
  window.AppLayout.init();

  const params = new URLSearchParams(location.search);
  const submissionId = params.get('submission_id');

  const $ = (id) => document.getElementById(id);

  const loading = $('loading');
  const errorBlock = $('error-block');
  const content = $('content');
  const actionMsg = $('action-message');

  const btnSave = $('btn-save');
  const btnDelete = $('btn-delete');
  const btnRegrade = $('btn-regrade');
  const deleteModal = $('delete-modal');

  let state = null; // { student, submission, grading }

  function fmt(dt) {
    if (!dt) return '-';
    return new Date(dt).toLocaleString('vi-VN', { hour12: false });
  }

  function showMsg(type, text) {
    const map = {
      success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      error: 'border-red-200 bg-red-50 text-red-800',
      info: 'border-slate-200 bg-slate-50 text-slate-700'
    };
    actionMsg.className = `mt-3 rounded-xl border p-3 text-sm ${map[type] || map.info}`;
    actionMsg.textContent = text;
    actionMsg.classList.remove('hidden');
    if (type !== 'error') {
      setTimeout(() => actionMsg.classList.add('hidden'), 4000);
    }
  }

  function renderExtract(extract) {
    if (!extract) return 'Chưa có dữ liệu trích xuất.';
    if (typeof extract === 'string') return extract;
    // If JSONB object, pretty-print or render text field
    if (extract.text) return extract.text;
    if (extract.content) return extract.content;
    return JSON.stringify(extract, null, 2);
  }

  function statusBadge(status) {
    const map = {
      graded: 'bg-emerald-100 text-emerald-700',
      published: 'bg-blue-100 text-blue-700',
      pending: 'bg-amber-100 text-amber-700',
      error: 'bg-red-100 text-red-700',
      recheck: 'bg-purple-100 text-purple-700'
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  }

  function renderPage(data) {
    state = data;
    const { student, submission, grading } = data;

    $('page-subtitle').textContent =
      `${student.student_name || '-'} — ${submission.exam_code || '-'} — ${submission.exam_title || '-'}`;

    // Student info
    $('s-student-code').textContent = student.student_code || '-';
    $('s-student-name').textContent = student.student_name || '-';
    $('s-class-code').textContent = student.class_code || '-';
    $('s-subject-code').textContent = student.subject_code || '-';
    $('s-exam-code').textContent = submission.exam_code || '-';
    $('s-exam-title').textContent = submission.exam_title || '-';
    $('s-exam-type').textContent = submission.exam_type || '-';
    $('s-submitted-at').textContent = fmt(submission.submitted_at);
    $('s-sub-status').textContent = submission.status || '-';

    const fileEl = $('s-file-link');
    if (submission.submission_file_path) {
      const filename = submission.submission_file_path.split('/').pop();
      fileEl.innerHTML = `<a href="${submission.submission_file_path}" target="_blank"
        class="text-blue-600 hover:underline text-sm">${filename}</a>`;
    } else {
      fileEl.textContent = 'Không có file';
    }

    // Submission extract
    $('submission-extract').textContent = renderExtract(submission.submission_extract);

    // Grading
    if (!grading) {
      $('no-grading').classList.remove('hidden');
      $('grading-panel').classList.add('hidden');
      btnSave.disabled = true;
      btnDelete.disabled = true;
      btnRegrade.disabled = true;
    } else {
      $('no-grading').classList.add('hidden');
      $('grading-panel').classList.remove('hidden');

      $('g-attempt').textContent = grading.attempt_no ?? '-';
      $('g-graded-at').textContent = fmt(grading.graded_at);
      $('g-graded-by').textContent = grading.graded_by_name || 'AI';
      $('g-type').textContent = grading.grading_type || '-';

      const statusEl = $('g-status-badge');
      statusEl.textContent = grading.status || '-';
      statusEl.className = `px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(grading.status)}`;

      $('g-max-score').textContent = grading.max_score ?? 10;
      $('g-total-score').value = grading.total_score ?? '';
      $('g-total-score').max = grading.max_score ?? 10;

      const conf = Math.round(grading.ai_confidence ?? 0);
      $('g-confidence-bar').style.width = `${conf}%`;
      $('g-confidence-text').textContent = `${conf}%`;

      $('g-feedback').value = grading.general_feedback || '';
      $('g-notes').value = grading.notes || '';
      $('g-detail').value = grading.grading_detail
        ? JSON.stringify(grading.grading_detail, null, 2)
        : '';

      btnSave.disabled = false;
      btnDelete.disabled = false;
      btnRegrade.disabled = false;
    }

    loading.classList.add('hidden');
    content.classList.remove('hidden');
  }

  async function loadData() {
    errorBlock.classList.add('hidden');

    if (!submissionId) {
      loading.classList.add('hidden');
      errorBlock.textContent = 'Thiếu tham số submission_id trong URL. Ví dụ: grading-result.html?submission_id=1';
      errorBlock.classList.remove('hidden');
      return;
    }

    try {
      const res = await window.AppApi.getSubmissionResult(submissionId);
      renderPage(res.data);
    } catch (err) {
      loading.classList.add('hidden');
      // If content is already visible (reload after action), show inline message instead
      if (!content.classList.contains('hidden')) {
        showMsg('error', `Lỗi tải lại dữ liệu: ${err.message}`);
      } else {
        errorBlock.textContent = `Lỗi tải dữ liệu: ${err.message}`;
        errorBlock.classList.remove('hidden');
      }
    }
  }

  // Save
  btnSave.addEventListener('click', async () => {
    if (!state?.grading) return;

    const detailRaw = $('g-detail').value.trim();
    let parsedDetail;
    try {
      parsedDetail = detailRaw ? JSON.parse(detailRaw) : null;
      $('g-detail-error').classList.add('hidden');
    } catch (_e) {
      $('g-detail-error').classList.remove('hidden');
      return;
    }

    btnSave.disabled = true;
    try {
      await window.AppApi.updateGrading(state.grading.grading_id, {
        total_score: parseFloat($('g-total-score').value),
        general_feedback: $('g-feedback').value,
        grading_detail: parsedDetail,
        notes: $('g-notes').value
      });
      showMsg('success', 'Đã lưu kết quả chấm bài thành công.');
      await loadData();
    } catch (err) {
      showMsg('error', `Lỗi lưu: ${err.message}`);
      btnSave.disabled = false;
    }
  });

  // Delete
  btnDelete.addEventListener('click', () => {
    deleteModal.classList.remove('hidden');
  });
  $('delete-cancel').addEventListener('click', () => {
    deleteModal.classList.add('hidden');
  });
  $('delete-confirm').addEventListener('click', async () => {
    if (!state?.grading) return;
    deleteModal.classList.add('hidden');
    btnDelete.disabled = true;

    try {
      await window.AppApi.deleteGrading(state.grading.grading_id);
      showMsg('success', 'Đã xóa kết quả chấm bài.');
      await loadData();
    } catch (err) {
      showMsg('error', `Lỗi xóa: ${err.message}`);
      btnDelete.disabled = false;
    }
  });

  // Re-grade
  btnRegrade.addEventListener('click', async () => {
    if (!submissionId) return;
    btnRegrade.disabled = true;
    showMsg('info', 'Đang chấm lại...');

    try {
      const res = await window.AppApi.regradeGrading(submissionId);
      showMsg('success', `Chấm lại thành công. Điểm mới: ${res.data?.grading?.total_score ?? '-'}`);
      renderPage(res.data);
    } catch (err) {
      showMsg('error', `Lỗi chấm lại: ${err.message}`);
      btnRegrade.disabled = false;
    }
  });

  await loadData();
});
