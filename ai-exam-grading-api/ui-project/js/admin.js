(function () {
  function setGlobalMessage(message, type) {
    const el = document.getElementById('global-message');
    if (!el) return;
    el.textContent = message || '';
    el.className = `text-sm ${type === 'error' ? 'text-red-600' : 'text-slate-700'}`;
  }

  async function apiRequest(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = window.AppState.getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || `Request failed: ${response.status}`);
    }
    return payload;
  }

  function openModal({ title, subtitle, fields, initial, onSave }) {
    const modal = document.getElementById('modal');
    const form = document.getElementById('modal-form');
    const titleEl = document.getElementById('modal-title');
    const subtitleEl = document.getElementById('modal-subtitle');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('modal-cancel');

    titleEl.textContent = title;
    subtitleEl.textContent = subtitle || '';
    form.innerHTML = fields.map((f) => {
      const value = (initial && initial[f.name] !== undefined && initial[f.name] !== null) ? initial[f.name] : '';
      const input = f.type === 'textarea'
        ? `<textarea name="${f.name}" rows="3" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900/20">${String(value)}</textarea>`
        : `<input name="${f.name}" type="${f.type || 'text'}" value="${String(value).replace(/"/g, '&quot;')}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900/20" ${f.placeholder ? `placeholder="${f.placeholder}"` : ''}>`;
      return `
        <label class="block">
          <div class="text-sm font-semibold text-slate-700">${f.label}</div>
          ${input}
        </label>
      `;
    }).join('');

    function close() {
      modal.classList.add('hidden');
      modal.classList.remove('block');
      form.onsubmit = null;
      closeBtn.onclick = null;
      cancelBtn.onclick = null;
    }

    closeBtn.onclick = close;
    cancelBtn.onclick = close;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const payload = {};
      for (const [key, value] of formData.entries()) {
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
    editBtn.textContent = 'Sua';
    editBtn.onclick = onEdit;
    const delBtn = document.createElement('button');
    delBtn.className = 'px-2 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold';
    delBtn.textContent = 'Xoa';
    delBtn.onclick = onDelete;
    wrap.appendChild(editBtn);
    wrap.appendChild(delBtn);
    return wrap;
  }

  async function loadClasses() {
    const tbody = document.getElementById('classes-tbody');
    tbody.innerHTML = '';
    const payload = await apiRequest('/api/classes');
    payload.data.forEach((row) => {
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
          title: 'Sua lop hoc',
          subtitle: `#${row.id}`,
          initial: row,
          fields: [
            { name: 'class_code', label: 'Ma lop', placeholder: '12A1' },
            { name: 'class_name', label: 'Ten lop', placeholder: 'Lop 12A1' },
            { name: 'grade', label: 'Khoi', placeholder: '12', type: 'number' },
            { name: 'status', label: 'Trang thai', placeholder: 'active' }
          ],
          onSave: async (body) => {
            const nextBody = Object.assign({}, body);
            if (nextBody.grade !== null) {
              nextBody.grade = Number(nextBody.grade);
              if (!Number.isFinite(nextBody.grade)) nextBody.grade = null;
            }
            await apiRequest(`/api/classes/${row.id}`, { method: 'PUT', body: nextBody });
            await refreshAll();
          }
        }),
        onDelete: async () => {
          if (!confirm(`Xoa lop ${row.class_code}?`)) return;
          await apiRequest(`/api/classes/${row.id}`, { method: 'DELETE' });
          await refreshAll();
        }
      }));
      tbody.appendChild(tr);
    });
  }

  async function loadSubjects() {
    const tbody = document.getElementById('subjects-tbody');
    tbody.innerHTML = '';
    const payload = await apiRequest('/api/subjects');
    payload.data.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2 pr-4 font-semibold">${row.subject_code || ''}</td>
        <td class="py-2 pr-4">${row.subject_name || ''}</td>
        <td class="py-2 pr-4">${row.status || ''}</td>
        <td class="py-2 pr-4"></td>
      `;
      tr.lastElementChild.appendChild(renderActions({
        onEdit: () => openModal({
          title: 'Sua mon hoc',
          subtitle: `#${row.id}`,
          initial: row,
          fields: [
            { name: 'subject_code', label: 'Ma mon', placeholder: 'MATH' },
            { name: 'subject_name', label: 'Ten mon', placeholder: 'Toan hoc' },
            { name: 'status', label: 'Trang thai', placeholder: 'active' }
          ],
          onSave: async (body) => {
            await apiRequest(`/api/subjects/${row.id}`, { method: 'PUT', body });
            await refreshAll();
          }
        }),
        onDelete: async () => {
          if (!confirm(`Xoa mon ${row.subject_code}?`)) return;
          await apiRequest(`/api/subjects/${row.id}`, { method: 'DELETE' });
          await refreshAll();
        }
      }));
      tbody.appendChild(tr);
    });
  }

  async function loadExamPeriods() {
    const tbody = document.getElementById('periods-tbody');
    tbody.innerHTML = '';
    const payload = await apiRequest('/api/exam-periods');
    payload.data.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2 pr-4 font-semibold">${row.period_code || ''}</td>
        <td class="py-2 pr-4">${row.period_name || ''}</td>
        <td class="py-2 pr-4">${row.start_date || ''}</td>
        <td class="py-2 pr-4">${row.end_date || ''}</td>
        <td class="py-2 pr-4">${row.status || ''}</td>
        <td class="py-2 pr-4"></td>
      `;
      tr.lastElementChild.appendChild(renderActions({
        onEdit: () => openModal({
          title: 'Sua dot thi',
          subtitle: `#${row.id}`,
          initial: row,
          fields: [
            { name: 'period_code', label: 'Ma dot', placeholder: 'dot_1' },
            { name: 'period_name', label: 'Ten dot', placeholder: 'Dot 1 - Giua ky' },
            { name: 'description', label: 'Mo ta', type: 'textarea' },
            { name: 'start_date', label: 'Tu ngay', type: 'date' },
            { name: 'end_date', label: 'Den ngay', type: 'date' },
            { name: 'status', label: 'Trang thai', placeholder: 'active' }
          ],
          onSave: async (body) => {
            await apiRequest(`/api/exam-periods/${row.id}`, { method: 'PUT', body });
            await refreshAll();
          }
        }),
        onDelete: async () => {
          if (!confirm(`Xoa dot ${row.period_code}?`)) return;
          await apiRequest(`/api/exam-periods/${row.id}`, { method: 'DELETE' });
          await refreshAll();
        }
      }));
      tbody.appendChild(tr);
    });
  }

  async function refreshAll() {
    setGlobalMessage('', 'info');
    await Promise.all([loadClasses(), loadSubjects(), loadExamPeriods()]);
  }

  async function init() {
    window.AppState.ensurePageAccess('admin');
    window.AppLayout.init();

    document.getElementById('add-class-btn').onclick = () => openModal({
      title: 'Them lop hoc',
      subtitle: 'Tao moi record trong classes',
      initial: { status: 'active' },
      fields: [
        { name: 'class_code', label: 'Ma lop', placeholder: '12A1' },
        { name: 'class_name', label: 'Ten lop', placeholder: 'Lop 12A1' },
        { name: 'grade', label: 'Khoi', placeholder: '12', type: 'number' },
        { name: 'status', label: 'Trang thai', placeholder: 'active' }
      ],
      onSave: async (body) => {
        const nextBody = Object.assign({}, body);
        if (nextBody.grade !== null) {
          nextBody.grade = Number(nextBody.grade);
          if (!Number.isFinite(nextBody.grade)) nextBody.grade = null;
        }
        await apiRequest('/api/classes', { method: 'POST', body: nextBody });
        await refreshAll();
      }
    });

    document.getElementById('add-subject-btn').onclick = () => openModal({
      title: 'Them mon hoc',
      subtitle: 'Tao moi record trong subjects',
      initial: { status: 'active' },
      fields: [
        { name: 'subject_code', label: 'Ma mon', placeholder: 'MATH' },
        { name: 'subject_name', label: 'Ten mon', placeholder: 'Toan hoc' },
        { name: 'status', label: 'Trang thai', placeholder: 'active' }
      ],
      onSave: async (body) => {
        await apiRequest('/api/subjects', { method: 'POST', body });
        await refreshAll();
      }
    });

    document.getElementById('add-period-btn').onclick = () => openModal({
      title: 'Them dot thi',
      subtitle: 'Tao moi record trong exam_periods',
      initial: { status: 'active' },
      fields: [
        { name: 'period_code', label: 'Ma dot', placeholder: 'dot_1' },
        { name: 'period_name', label: 'Ten dot', placeholder: 'Dot 1 - Giua ky' },
        { name: 'description', label: 'Mo ta', type: 'textarea' },
        { name: 'start_date', label: 'Tu ngay', type: 'date' },
        { name: 'end_date', label: 'Den ngay', type: 'date' },
        { name: 'status', label: 'Trang thai', placeholder: 'active' }
      ],
      onSave: async (body) => {
        await apiRequest('/api/exam-periods', { method: 'POST', body });
        await refreshAll();
      }
    });

    await refreshAll();
  }

  window.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => setGlobalMessage(error.message, 'error'));
  });
})();

