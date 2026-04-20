// API Client cho Frontend
const API_BASE = window.location.origin;

const api = {
  // Authentication
  async login(identity, password) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password })
    });
    return res.json();
  },

  async getMe() {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
  },

  async logout() {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    localStorage.removeItem('auth_token');
    return res.json();
  },

  // Students
  async submitAnswer(formData) {
    const res = await fetch(`${API_BASE}/api/students/submit-answer`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  },

  async getStudentResults(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/students/results?${query}`);
    return res.json();
  },

  // Generic entity queries
  async getEntityList(entity, params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/${entity}?${query}`);
    return res.json();
  },

  async getEntityDetail(entity, id) {
    const res = await fetch(`${API_BASE}/api/${entity}/${id}`);
    return res.json();
  },

  async search(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/search?${query}`);
    return res.json();
  }
};
