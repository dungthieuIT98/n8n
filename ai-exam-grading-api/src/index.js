const express = require('express');
const cors = require('cors');

const config = require('./config');
const { bootstrapSchema, query, getClient, ENTITY_CONFIG } = require('./database');
const { clearSessions } = require('./helpers');
const upload = require('./upload');

// Routes
const authRoutes = require('./routes/auth');
const examsRoutes = require('./routes/exams');
const { router: submissionsRoutes, studentResultsHandler, studentResultDetailHandler } = require('./routes/submissions');
const logsRoutes = require('./routes/logs');
const entitiesRoutes = require('./routes/entities');
const gradingRoutes = require('./routes/grading');

async function ensureUploadsFolder() {
  const fs = require('node:fs/promises');
  await fs.mkdir(config.paths.uploads, { recursive: true });
  await fs.mkdir(config.paths.uiProject, { recursive: true });
}


async function startServer() {
  await bootstrapSchema();
  await ensureUploadsFolder();
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
  app.use('/api/grading', gradingRoutes);
  app.get('/api/student-results', studentResultsHandler);
  app.get('/api/student-results/:id', studentResultDetailHandler);

  // Dashboard stats - requires auth
  app.get('/api/stats', async (request, response, next) => {
    try {
      const { requireAuth: checkAuth, getSessionFromRequest } = require('./helpers');
      const session = getSessionFromRequest(request);
      if (!session) {
        response.status(401).json({ ok: false, message: 'Unauthorized' });
        return;
      }
      const teacherId = session.teacher.id;

      const result = await query(`
        SELECT
          (SELECT COUNT(*)::int FROM exams WHERE teacher_id = $1) AS total_exams,
          (SELECT COUNT(*)::int FROM submissions s JOIN exams e ON e.id = s.exam_id WHERE e.teacher_id = $1) AS total_submissions,
          (
            SELECT COUNT(*)::int
            FROM submissions s
            JOIN exams e ON e.id = s.exam_id
            JOIN LATERAL (
              SELECT status FROM grading_results WHERE submission_id = s.id ORDER BY attempt_no DESC LIMIT 1
            ) gr ON true
            WHERE e.teacher_id = $1 AND gr.status = 'published'
          ) AS published_count,
          (SELECT COUNT(*)::int FROM system_logs WHERE created_by = $1 AND status IN ('failed', 'error')) AS failed_logs_count
      `, [teacherId]);

      response.json({ ok: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  // Per-exam chart data - requires auth
  app.get('/api/exam-chart-data', async (request, response, next) => {
    try {
      const { getSessionFromRequest } = require('./helpers');
      const session = getSessionFromRequest(request);
      if (!session) {
        response.status(401).json({ ok: false, message: 'Unauthorized' });
        return;
      }
      const teacherId = session.teacher.id;

      const result = await query(`
        SELECT
          e.id,
          e.exam_code,
          e.title,
          COUNT(DISTINCT s.id)::int AS submission_count,
          ROUND(AVG(gr.total_score)::numeric, 1) AS avg_score,
          MAX(gr.total_score) AS max_score_achieved,
          MIN(gr.total_score) AS min_score_achieved,
          MAX(gr.max_score) AS max_score_possible
        FROM exams e
        LEFT JOIN submissions s ON s.exam_id = e.id
        LEFT JOIN LATERAL (
          SELECT total_score, max_score
          FROM grading_results
          WHERE submission_id = s.id AND status = 'published'
          ORDER BY attempt_no DESC
          LIMIT 1
        ) gr ON true
        WHERE e.teacher_id = $1
        GROUP BY e.id, e.exam_code, e.title
        ORDER BY e.created_at DESC
        LIMIT 10
      `, [teacherId]);

      response.json({ ok: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', entitiesRoutes);


  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  });

  app.listen(config.port, config.host, () => {
    const browserHost = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;

    console.log(`AI Exam Grading API listening on http://${config.host}:${config.port}`);
    console.log(`Teacher UI: http://${browserHost}:${config.port}/login.html`);
    console.log(`Student UI: http://${browserHost}:${config.port}/student.html`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start AI Exam Grading API');
  console.error(error);
  process.exitCode = 1;
});
