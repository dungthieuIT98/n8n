const crypto = require('node:crypto');
const path = require('node:path');

const sessions = new Map();

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sanitizeTeacher(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    teacher_code: row.teacher_code,
    full_name: row.full_name,
    email: row.email,
    username: row.username,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function toRelativeUploadPath(filePath) {
  return filePath ? path.basename(filePath) : '';
}

function makeQuestionList(submission) {
  const totalScore = Number(submission.total_score || 0);
  const maxScore = Number(submission.max_score || 10);
  const firstScore = Number((totalScore * 0.45).toFixed(2));
  const secondScore = Number((totalScore * 0.55).toFixed(2));

  return [
    {
      no: 1,
      type: 'tu_luan',
      question: `Tom tat noi dung chinh cua bai thi ${submission.exam_title || submission.exam_code || ''}`.trim(),
      student_answer: submission.notes || 'Hoc sinh da nop bai va he thong da luu bai lam.',
      correct_answer: 'Bai tra loi can bam sat de thi va the hien lap luan ro rang.',
      result: totalScore >= maxScore / 2 ? 'Dung' : 'Sai',
      score: firstScore,
      explanation: totalScore >= maxScore / 2 ? 'Noi dung dat muc yeu cau co ban.' : 'Can bo sung y va dan chung ro hon.'
    },
    {
      no: 2,
      type: 'tu_luan',
      question: 'Phan tich va dua ra ket luan tu bai lam cua sinh vien.',
      student_answer: submission.notes || 'He thong chua co OCR chi tiet, dang hien thi du lieu tong hop.',
      correct_answer: 'Can co bo cuc ro, dan chung va ket luan ngan gon.',
      result: totalScore >= maxScore * 0.7 ? 'Dung' : 'Sai',
      score: secondScore,
      explanation: totalScore >= maxScore * 0.7 ? 'Bai lam tot, co the cong bo.' : 'Nen cham lai hoac yeu cau recheck.'
    }
  ];
}

function decorateSubmission(row) {
  if (!row) {
    return null;
  }

  // Extract questions from grading_detail if available
  const questions = row.grading_detail?.graded_questions || makeQuestionList(row);
  return Object.assign({}, row, { questions });
}

function createAuthToken(teacher) {
  const token = crypto.randomUUID();
  sessions.set(token, {
    token,
    teacher,
    createdAt: new Date().toISOString()
  });
  return token;
}

function getSessionFromRequest(request) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  return token ? sessions.get(token) : null;
}

function destroySessionToken(token) {
  if (!token) {
    return false;
  }

  return sessions.delete(token);
}

function requireAuth(request, response, next) {
  const session = getSessionFromRequest(request);
  if (!session) {
    response.status(401).json({ ok: false, message: 'Unauthorized' });
    return;
  }

  request.session = session;
  next();
}

function clearSessions() {
  sessions.clear();
}

module.exports = {
  parseId,
  sanitizeTeacher,
  toRelativeUploadPath,
  makeQuestionList,
  decorateSubmission,
  createAuthToken,
  getSessionFromRequest,
  destroySessionToken,
  requireAuth,
  clearSessions
};
