(function () {
  const PAGE_SIZE = 10;

  function setGlobalMessage(message, type) {
    const el = document.getElementById('global-message');
    if (!el) return;
    el.textContent = message || '';
    el.className = `text-sm ${type === 'error' ? 'text-red-600' : 'text-slate-700'}`;
  }

  async function apiRequest(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = window.AppState.getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Yêu cầu thất bại: ${response.status}`);
    return payload;
  }

  function openModal({ title, subtitle, fields, initial, onSave }) {
    const modal = document.getElementById('modal');
    const form = document.getElementById('modal-form');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-subtitle').textContent = subtitle || '';

    form.innerHTML = fields.map((f) => {
      const value = (initial && initial[f.name] != null) ? initial[f.name] : '';
      const input = f.type === 'textarea'
        ? `<textarea name="${f.name}" rows="3" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900/20">${String(value)}</textarea>`
        : `<input name="${f.name}" type="${f.type || 'text'}" value="${String(value).replace(/"/g, '&quot;')}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900/20" ${f.placeholder ? `placeholder="${f.placeholder}"` : ''}>`;
      return `<label class="block"><div class="text-sm font-semibold text-slate-700">${f.label}</div>${input}</label>`;
    }).join('');

    function close() {
      modal.classList.add('hidden');
      modal.classList.remove('block');
      form.onsubmit = null;
    }

    document.getElementById('modal-close').onclick = close;
    document.getElementById('modal-cancel').onclick = close;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const payload = {};
      for (const [key, value] of new FormData(form).entries()) {
        payload[key] = value === '' ? null : value;
      }
      try {
        await onSave(payload);
        close();
      } catch (error) {
        setGlobalMessage(error.message, 'error');
      }
    };

    modal.classList.remove('hidden');
    modal.classList.add('block');
  }

  function renderActions({ onEdit, onDelete }) {
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center gap-2';
    const editBtn = document.createElement('button');
    editBtn.className = 'px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold';
    editBtn.textContent = 'Sửa';
    editBtn.onclick = onEdit;
    const delBtn = document.createElement('button');
    delBtn.className = 'px-2 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold';
    delBtn.textContent = 'Xóa';
    delBtn.onclick = onDelete;
    wrap.appendChild(editBtn);
    wrap.appendChild(delBtn);
    return wrap;
  }

  // ── Classes ──────────────────────────────────────────────────────────────

  let classesData = [];
  let classesPage = 1;

  function renderClassesPage() {
    const tbody = document.getElementById('classes-tbody');
    if (!tbody) return;
    const start = (classesPage - 1) * PAGE_SIZE;
    const rows = classesData.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-6 px-4 text-center text-slate-400 text-sm">Không có dữ liệu.</td></tr>';
    } else {
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-2 pr-4 font-semibold">${row.class_code || ''}</td>
          <td class="py-2 pr-4">${row.class_name || ''}</td>
          <td class="py-2 pr-4">${row.grade ?? ''}</td>
          <td class="py-2 pr-4">${row.status || ''}</td>
          <td class="py-2 pr-4"></td>
        `;
        tr.lastElementChild.appendChild(renderActions({
          onEdit: () => openModal({
            title: 'Sửa lớp học', subtitle: `#${row.id}`, initial: row,
            fields: [
              { name: 'class_code', label: 'Mã lớp', placeholder: '12A1' },
              { name: 'class_name', label: 'Tên lớp', placeholder: 'Lớp 12A1' },
              { name: 'grade', label: 'Khối', placeholder: '12', type: 'number' },
              { name: 'status', label: 'Trạng thái', placeholder: 'active' }
            ],
            onSave: async (body) => {
              if (body.grade !== null) { body.grade = Number(body.grade) || null; }
              await apiRequest(`/api/classes/${row.id}`, { method: 'PUT', body });
              await loadClasses();
            }
          }),
          onDelete: async () => {
            if (!confirm(`Xóa lớp ${row.class_code}?`)) return;
            await apiRequest(`/api/classes/${row.id}`, { method: 'DELETE' });
            await loadClasses();
          }
        }));
        tbody.appendChild(tr);
      });
    }

    window.AppUI.renderPagination('classes-pagination', classesData.length, classesPage, PAGE_SIZE, (p) => {
      classesPage = p;
      renderClassesPage();
    });
  }

  async function loadClasses() {
    const tbody = document.getElementById('classes-tbody');
    if (!tbody) return;
    const payload = await apiRequest('/api/classes');
    classesData = payload.data;
    classesPage = 1;
    renderClassesPage();
  }

  async function initClasses() {
    window.AppLayout.init();
    document.getElementById('add-class-btn').onclick = () => openModal({
      title: 'Thêm lớp học', subtitle: 'Tạo bản ghi mới trong classes',
      initial: { status: 'active' },
      fields: [
        { name: 'class_code', label: 'Mã lớp', placeholder: '12A1' },
        { name: 'class_name', label: 'Tên lớp', placeholder: 'Lớp 12A1' },
        { name: 'grade', label: 'Khối', placeholder: '12', type: 'number' },
        { name: 'status', label: 'Trạng thái', placeholder: 'active' }
      ],
      onSave: async (body) => {
        if (body.grade !== null) { body.grade = Number(body.grade) || null; }
        await apiRequest('/api/classes', { method: 'POST', body });
        await loadClasses();
      }
    });
    await loadClasses();
  }

  // ── Subjects ─────────────────────────────────────────────────────────────

  let subjectsData = [];
  let subjectsPage = 1;

  function renderSubjectsPage() {
    const tbody = document.getElementById('subjects-tbody');
    if (!tbody) return;
    const start = (subjectsPage - 1) * PAGE_SIZE;
    const rows = subjectsData.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-6 px-4 text-center text-slate-400 text-sm">Không có dữ liệu.</td></tr>';
    } else {
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-2 pr-4 font-semibold">${row.subject_code || ''}</td>
          <td class="py-2 pr-4">${row.subject_name || ''}</td>
          <td class="py-2 pr-4">${row.status || ''}</td>
          <td class="py-2 pr-4"></td>
        `;
        tr.lastElementChild.appendChild(renderActions({
          onEdit: () => openModal({
            title: 'Sửa môn học', subtitle: `#${row.id}`, initial: row,
            fields: [
              { name: 'subject_code', label: 'Mã môn', placeholder: 'MATH' },
              { name: 'subject_name', label: 'Tên môn', placeholder: 'Toán học' },
              { name: 'status', label: 'Trạng thái', placeholder: 'active' }
            ],
            onSave: async (body) => {
              await apiRequest(`/api/subjects/${row.id}`, { method: 'PUT', body });
              await loadSubjects();
            }
          }),
          onDelete: async () => {
            if (!confirm(`Xóa môn ${row.subject_code}?`)) return;
            await apiRequest(`/api/subjects/${row.id}`, { method: 'DELETE' });
            await loadSubjects();
          }
        }));
        tbody.appendChild(tr);
      });
    }

    window.AppUI.renderPagination('subjects-pagination', subjectsData.length, subjectsPage, PAGE_SIZE, (p) => {
      subjectsPage = p;
      renderSubjectsPage();
    });
  }

  async function loadSubjects() {
    const tbody = document.getElementById('subjects-tbody');
    if (!tbody) return;
    const payload = await apiRequest('/api/subjects');
    subjectsData = payload.data;
    subjectsPage = 1;
    renderSubjectsPage();
  }

  async function initSubjects() {
    window.AppLayout.init();
    document.getElementById('add-subject-btn').onclick = () => openModal({
      title: 'Thêm môn học', subtitle: 'Tạo bản ghi mới trong subjects',
      initial: { status: 'active' },
      fields: [
        { name: 'subject_code', label: 'Mã môn', placeholder: 'MATH' },
        { name: 'subject_name', label: 'Tên môn', placeholder: 'Toán học' },
        { name: 'status', label: 'Trạng thái', placeholder: 'active' }
      ],
      onSave: async (body) => {
        await apiRequest('/api/subjects', { method: 'POST', body });
        await loadSubjects();
      }
    });
    await loadSubjects();
  }

  // ── Exam Periods ─────────────────────────────────────────────────────────

  let periodsData = [];
  let periodsPage = 1;

  function renderPeriodsPage() {
    const tbody = document.getElementById('periods-tbody');
    if (!tbody) return;
    const start = (periodsPage - 1) * PAGE_SIZE;
    const rows = periodsData.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="py-6 px-4 text-center text-slate-400 text-sm">Không có dữ liệu.</td></tr>';
    } else {
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-2 pr-4 font-semibold">${row.period_code || ''}</td>
          <td class="py-2 pr-4">${row.period_name || ''}</td>
          <td class="py-2 pr-4">${row.start_date ? row.start_date.slice(0, 10) : ''}</td>
          <td class="py-2 pr-4">${row.end_date ? row.end_date.slice(0, 10) : ''}</td>
          <td class="py-2 pr-4">${row.status || ''}</td>
          <td class="py-2 pr-4"></td>
        `;
        tr.lastElementChild.appendChild(renderActions({
          onEdit: () => openModal({
            title: 'Sửa đợt thi', subtitle: `#${row.id}`, initial: row,
            fields: [
              { name: 'period_code', label: 'Mã đợt', placeholder: 'dot_1' },
              { name: 'period_name', label: 'Tên đợt', placeholder: 'Đợt 1 - Giữa kỳ' },
              { name: 'description', label: 'Mô tả', type: 'textarea' },
              { name: 'start_date', label: 'Từ ngày', type: 'date' },
              { name: 'end_date', label: 'Đến ngày', type: 'date' },
              { name: 'status', label: 'Trạng thái', placeholder: 'active' }
            ],
            onSave: async (body) => {
              await apiRequest(`/api/exam-periods/${row.id}`, { method: 'PUT', body });
              await loadExamPeriods();
            }
          }),
          onDelete: async () => {
            if (!confirm(`Xóa đợt ${row.period_code}?`)) return;
            await apiRequest(`/api/exam-periods/${row.id}`, { method: 'DELETE' });
            await loadExamPeriods();
          }
        }));
        tbody.appendChild(tr);
      });
    }

    window.AppUI.renderPagination('periods-pagination', periodsData.length, periodsPage, PAGE_SIZE, (p) => {
      periodsPage = p;
      renderPeriodsPage();
    });
  }

  async function loadExamPeriods() {
    const tbody = document.getElementById('periods-tbody');
    if (!tbody) return;
    const payload = await apiRequest('/api/exam-periods');
    periodsData = payload.data;
    periodsPage = 1;
    renderPeriodsPage();
  }

  async function initPeriods() {
    window.AppLayout.init();
    document.getElementById('add-period-btn').onclick = () => openModal({
      title: 'Thêm đợt thi', subtitle: 'Tạo bản ghi mới trong exam_periods',
      initial: { status: 'active' },
      fields: [
        { name: 'period_code', label: 'Mã đợt', placeholder: 'dot_1' },
        { name: 'period_name', label: 'Tên đợt', placeholder: 'Đợt 1 - Giữa kỳ' },
        { name: 'description', label: 'Mô tả', type: 'textarea' },
        { name: 'start_date', label: 'Từ ngày', type: 'date' },
        { name: 'end_date', label: 'Đến ngày', type: 'date' },
        { name: 'status', label: 'Trạng thái', placeholder: 'active' }
      ],
      onSave: async (body) => {
        await apiRequest('/api/exam-periods', { method: 'POST', body });
        await loadExamPeriods();
      }
    });
    await loadExamPeriods();
  }

  window.AdminApp = { initClasses, initSubjects, initPeriods, setGlobalMessage };
})();
