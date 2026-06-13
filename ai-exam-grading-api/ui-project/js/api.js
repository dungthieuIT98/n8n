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
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    if (!response.ok) {
      throw new Error(payload.message || `Yêu cầu thất bại (mã ${response.status}).`);
    }

    return payload;
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
    getSubmissionResult,
    updateGrading,
    deleteGrading,
    regradeGrading
  };
})();