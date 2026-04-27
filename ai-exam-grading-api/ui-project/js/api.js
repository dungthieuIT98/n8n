(function () {
  function buildQuery(params) {
    const searchParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      searchParams.set(key, value);
    });
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  async function request(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = window.AppState.getAuthToken();
    const requestOptions = {
      method: options.method || 'GET',
      headers
    };

    if (token) {
      requestOptions.headers.Authorization = `Bearer ${token}`;
    }

    if (options.body instanceof FormData) {
      requestOptions.body = options.body;
    } else if (options.body !== undefined) {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, requestOptions);
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      window.AppState.clearSession();
      window.location.href = "login.html";
      throw new Error("Session expired. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(payload.message || `Request failed with status ${response.status}`);
    }

    return payload;
  }

  function mockDetailRequest(entity, id) {
    const mockData = window.MockData || {};
    const collection = mockData[entity] || [];
    const item = collection.find(x => String(x.id) === String(id));
    if (item) {
      return Promise.resolve({ success: true, data: item });
    }
    return Promise.reject(new Error(`Not found: ${entity} ${id}`));
  }

  function list(entity, params) {
    return request(`/api/${entity}${buildQuery(params)}`);
  }

  function detail(entity, id) {
    return request(`/api/${entity}/${id}`);
  }

  function login(identity, password) {
    return request('/api/auth/login', {
      method: 'POST',
      body: { identity, password }
    });
  }

  function logout() {
    return request('/api/auth/logout', { method: 'POST' });
  }

  function createExam(formData) {
    return request('/api/exams', {
      method: 'POST',
      body: formData
    });
  }

  function updateExam(examId, formData) {
    return request(`/api/exams/${examId}`, {
      method: 'PUT',
      body: formData
    });
  }

  function deleteExam(examId) {
    return request(`/api/exams/${examId}`, { method: 'DELETE' });
  }

  function reprocessExam(examId) {
    return request(`/api/exams/${examId}/reprocess`, { method: 'POST' });
  }

  function regradeSubmission(submissionId) {
    return request(`/api/submissions/${submissionId}/regrade`, { method: 'POST' });
  }

  function approveSubmission(submissionId) {
    return request(`/api/submissions/${submissionId}/approve`, { method: 'POST' });
  }

  function retryLog(logId) {
    return request(`/api/logs/${logId}/retry`, { method: 'POST' });
  }

  function studentResults(params) {
    return request(`/api/student-results${buildQuery(params)}`);
  }

  function publicExams() {
    return request('/api/exams/public');
  }

  function submitExamSubmission(formData) {
    return request('/api/submissions', {
      method: 'POST',
      body: formData
    });
  }

  function resetDemoData() {
    return request('/api/admin/reset-demo-data', { method: 'POST' });
  }

  function getSubmissionResult(submissionId) {
    return request(`/api/submissions/${submissionId}/result`);
  }

  function updateGrading(gradingId, body) {
    return request(`/api/grading/${gradingId}`, { method: 'PUT', body });
  }

  function deleteGrading(gradingId) {
    return request(`/api/grading/${gradingId}`, { method: 'DELETE' });
  }

  function regradeGrading(submissionId) {
    return request(`/api/grading/${submissionId}/regrade`, { method: 'POST' });
  }

  window.AppApi = {
    list,
    detail,
    login,
    logout,
    createExam,
    updateExam,
    deleteExam,
    reprocessExam,
    regradeSubmission,
    approveSubmission,
    retryLog,
    studentResults,
    publicExams,
    submitExamSubmission,
    resetDemoData,
    getSubmissionResult,
    updateGrading,
    deleteGrading,
    regradeGrading
  };
})();