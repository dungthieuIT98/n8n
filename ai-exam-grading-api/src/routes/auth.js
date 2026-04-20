const express = require('express');
const { query } = require('../database');
const { sanitizeTeacher, createAuthToken, destroySessionToken, requireAuth } = require('../helpers');

const router = express.Router();

// POST /api/auth/login - Đăng nhập cho giáo viên
router.post('/login', async (request, response, next) => {
  try {
    const identity = String(request.body.identity || '').trim();
    const password = String(request.body.password || '');

    if (!identity || !password) {
      response.status(400).json({ ok: false, message: 'Identity and password are required' });
      return;
    }

    const result = await query(`
      SELECT id, teacher_code, full_name, email, username, password_hash, status, created_at, updated_at
      FROM teachers
      WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
      LIMIT 1
    `, [identity]);

    const teacher = result.rows[0] || null;

    if (!teacher || teacher.status !== 'active' || teacher.password_hash !== password) {
      response.status(401).json({ ok: false, message: 'Sai thong tin dang nhap hoac tai khoan khong hoat dong.' });
      return;
    }

    const safeTeacher = sanitizeTeacher(teacher);
    const token = createAuthToken(safeTeacher);
    response.json({ ok: true, token, teacher: safeTeacher });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - Lấy thông tin user hiện tại
router.get('/me', requireAuth, (request, response) => {
  response.json({ ok: true, teacher: request.session.teacher });
});

// POST /api/auth/logout - Đăng xuất
router.post('/logout', requireAuth, (request, response) => {
  destroySessionToken(request.session.token);
  response.json({ ok: true, message: 'Logged out successfully' });
});

module.exports = router;
