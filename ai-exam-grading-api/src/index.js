const express = require('express');
const cors = require('cors');

const config = require('./config');
const { bootstrapSchema, query, getClient, ENTITY_CONFIG } = require('./database');
const { clearSessions } = require('./helpers');
const upload = require('./upload');

// Routes
const authRoutes = require('./routes/auth');
const examsRoutes = require('./routes/exams');
const { router: submissionsRoutes, studentResultsHandler } = require('./routes/submissions');
const logsRoutes = require('./routes/logs');
const entitiesRoutes = require('./routes/entities');

async function ensureUploadsFolder() {
  const fs = require('node:fs/promises');
  await fs.mkdir(config.paths.uploads, { recursive: true });
  await fs.mkdir(config.paths.uiProject, { recursive: true });
}

async function ensureDemoData() {
  const teacherCountResult = await query('SELECT COUNT(*)::int AS total FROM teachers');
  if ((teacherCountResult.rows[0]?.total || 0) > 0) {
    return;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const teacherResult = await client.query(`
      INSERT INTO teachers (
        teacher_code, full_name, email, username, password_hash, status
      )
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING id
    `, ['GV001', 'Tran Ha Linh', 'teacher01@school.edu.vn', 'teacher01', 'Demo123']);
    const teacherId = teacherResult.rows[0].id;

    const examValues = [
      ['EX-2026-001', 1, 'Kiem tra Toan 12 giua ky', 'De thi giua ky mon Toan khoi 12.', '12A1', 'MATH', 'Toan hoc', 'giua_ky', 'dot_1', teacherId, 'https://drive.google.com/file/d/exam-001/view', 'https://drive.google.com/file/d/answer-001/view', { questions: [{ question_no: '1', question_text: 'Tinh dao ham cua ham so da cho.', question_type: 'essay', options: [], expected_answer: 'f\'(x)=2x+1', rubrics: [{ key: 'Neu dung cong thuc dao ham', score: 1 }], max_score: 2 }], total_max_score: 2 }, 'ready'],
      ['EX-2026-002', 1, 'Kiem tra Ngu van 12 thu', 'De thu mon Ngu van danh gia nang luc doc hieu.', '12A2', 'LIT', 'Ngu van', 'thu', 'dot_1', teacherId, 'https://drive.google.com/file/d/exam-002/view', 'https://drive.google.com/file/d/answer-002/view', { questions: [], total_max_score: null }, 'processing']
    ];

    const createdExamIds = [];
    for (const exam of examValues) {
      const examResult = await client.query(`
        INSERT INTO exams (
          exam_code, version, title, description, class_code, subject_code, subject_name,
          exam_type, exam_round, teacher_id, question_file_path, answer_file_path,
          answer_extract_file_path, status, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $10, $10)
        RETURNING id
      `, exam);
      createdExamIds.push(examResult.rows[0].id);
    }

    const submissionValues = [
      [createdExamIds[0], 'SV2026001', 'Nguyen Minh An', '12A1', 'MATH', 'uploads/submissions/SV2026001.pdf', 'extract/submissions/SV2026001.json', 'grading/SV2026001-result.json', 8.5, 10, 92, 'web', 'published', new Date().toISOString(), teacherId, new Date().toISOString(), 'approved', 'Lap luan tot, trinh bay ro rang.'],
      [createdExamIds[0], 'SV2026002', 'Le Thu Trang', '12A1', 'MATH', 'uploads/submissions/SV2026002.pdf', 'extract/submissions/SV2026002.json', 'grading/SV2026002-result.json', 7.25, 10, 86, 'web', 'graded', null, null, null, 'recheck', 'Can xem lai cau hinh hoc.']
    ];

    for (const submission of submissionValues) {
      await client.query(`
        INSERT INTO submissions (
          exam_id, student_code, student_name, class_code, subject_code,
          submission_file_path, submission_extract_file_path, grading_result_file_path,
          total_score, max_score, ai_confidence, source_type, status,
          published_at, reviewed_by, reviewed_at, review_status, notes,
          created_by, updated_by, graded_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::varchar(30),
          $14, $15, $16, $17, $18, $15, $15,
          CASE WHEN $13::varchar(30) IN ('graded', 'published') THEN NOW() ELSE NULL END
        )
      `, submission);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function startServer() {
  await bootstrapSchema();
  await ensureUploadsFolder();
  await ensureDemoData();

  const app = express();
  
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(config.paths.uploads));
  app.use(express.static(config.paths.uiProject));

  app.get('/', (_request, response) => {
    response.redirect('/login.html');
  });

  app.get('/health', async (_request, response, next) => {
    try {
      const result = await query('SELECT current_database() AS database_name, NOW() AS server_time');
      response.json({
        ok: true,
        service: 'ai-exam-grading-api',
        database: result.rows[0]?.database_name || null,
        serverTime: result.rows[0]?.server_time || null
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api', (_request, response) => {
    response.json({
      ok: true,
      service: 'ai-exam-grading-api',
      entities: Object.keys(ENTITY_CONFIG),
      routes: {
        health: '/health',
        login: '/api/auth/login',
        studentResults: '/api/student-results',
        createExam: '/api/exams',
        submitSubmission: '/api/submissions',
        list: '/api/:entity',
        detail: '/api/:entity/:id',
        search: '/api/search?entity=exams&q=math'
      }
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/exams', upload.fields([
    { name: 'question_file', maxCount: 1 },
    { name: 'answer_file', maxCount: 1 }
  ]), examsRoutes);
  app.use('/api/submissions', upload.single('submission_file'), submissionsRoutes);
  app.use('/api/logs', logsRoutes);
  app.get('/api/student-results', studentResultsHandler);
  app.use('/api', entitiesRoutes);

  app.post('/api/admin/reset-demo-data', async (_request, response, next) => {
    try {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        await client.query('TRUNCATE system_logs, submissions, exams, teachers RESTART IDENTITY CASCADE');
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      clearSessions();
      await ensureDemoData();
      response.json({ ok: true, message: 'Demo data has been reset.' });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  });

  app.listen(config.port, config.host, () => {
    console.log(`AI Exam Grading API listening on http://${config.host}:${config.port}`);
    console.log(`Teacher UI: http://${config.host}:${config.port}/login.html`);
    console.log(`Student UI: http://${config.host}:${config.port}/student.html`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start AI Exam Grading API');
  console.error(error);
  process.exitCode = 1;
});
