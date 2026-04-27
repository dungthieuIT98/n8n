const express = require('express');
const FormData = require('form-data');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

const config = require('../config');
const { query, queryEntityDetail } = require('../database');
const { decorateSubmission, parseId, requireAuth } = require('../helpers');

const router = express.Router();

async function studentResultsHandler(request, response, next) {
  try {
    const studentCode = String(request.query.student_code || '').trim().toLowerCase();
    const studentName = String(request.query.student_name || '').trim().toLowerCase();
    const classCode = String(request.query.class_code || '').trim().toLowerCase();

    const result = await query(`
      SELECT
        s.id,
        s.exam_id,
        e.exam_code,
        e.title AS exam_title,
        e.subject_name,
        e.exam_type,
        s.student_code,
        s.student_name,
        s.class_code,
        s.subject_code,
        s.submission_file_path,
        s.submission_extract,
        s.submitted_at,
        s.status,
        s.created_at,
        s.updated_at,
        gr.id AS grading_result_id,
        gr.total_score,
        gr.max_score,
        gr.ai_confidence,
        gr.grading_detail,
        gr.general_feedback,
        gr.graded_at,
        gr.review_status,
        gr.published_at,
        gr.reviewed_by,
        gr.reviewed_at,
        gr.status AS grading_status
      FROM submissions s
      LEFT JOIN exams e ON e.id = s.exam_id
      LEFT JOIN LATERAL (
        SELECT id, total_score, max_score, ai_confidence, grading_detail, general_feedback,
               graded_at, review_status, published_at, reviewed_by, reviewed_at, status
        FROM grading_results
        WHERE submission_id = s.id
        ORDER BY attempt_no DESC
        LIMIT 1
      ) gr ON true
      WHERE gr.status = 'published'
        AND ($1 = '' OR LOWER(s.student_code) = $1)
        AND ($2 = '' OR LOWER(s.student_name) LIKE '%' || $2 || '%')
        AND ($3 = '' OR LOWER(s.class_code) = $3)
      ORDER BY gr.published_at DESC NULLS LAST, s.id DESC
    `, [studentCode, studentName, classCode]);

    response.json({ ok: true, data: result.rows.map(decorateSubmission) });
  } catch (error) {
    next(error);
  }
}

function forwardSubmissionToN8n(file, body) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('submission_file', fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype
    });

    ['student_name', 'student_code', 'class_code', 'subject_code', 'subject_name', 'exam_title', 'exam_id', 'exam_code', 'exam_type', 'notes']
      .forEach((fieldName) => {
        if (body[fieldName]) {
          formData.append(fieldName, body[fieldName]);
        }
      });

    const webhookUrl = new URL(`${config.n8nBaseUrl}/${config.n8nApis.uploadAnswer}`);
    const transport = webhookUrl.protocol === 'https:' ? https : http;
    const requestOptions = {
      hostname: webhookUrl.hostname,
      port: webhookUrl.port || (webhookUrl.protocol === 'https:' ? 443 : 80),
      path: webhookUrl.pathname + webhookUrl.search,
      method: 'POST',
      headers: formData.getHeaders()
    };

    const proxyRequest = transport.request(requestOptions, (proxyResponse) => {
      let raw = '';
      proxyResponse.on('data', (chunk) => {
        raw += chunk;
      });
      proxyResponse.on('end', () => {
        if (proxyResponse.statusCode && proxyResponse.statusCode >= 400) {
          const error = new Error(raw || `N8N webhook failed with status ${proxyResponse.statusCode}`);
          error.statusCode = proxyResponse.statusCode;
          error.rawResponse = raw;
          try {
            error.payload = JSON.parse(raw);
          } catch (_parseError) {
            error.payload = null;
          }
          reject(error);
          return;
        }

        try {
          resolve(JSON.parse(raw));
        } catch (_error) {
          resolve({ raw });
        }
      });
    });

    proxyRequest.on('error', reject);
    formData.pipe(proxyRequest);
  });
}

router.post('/', async (request, response, next) => {
  try {
    const file = request.file;
    if (!file) {
      response.status(400).json({ ok: false, message: 'Can tai len file bai lam (submission_file).' });
      return;
    }

    const filename = String(file.originalname || '').toLowerCase();
    const mimeType = String(file.mimetype || '').toLowerCase();
    const isPdf = filename.endsWith('.pdf') || mimeType === 'application/pdf';

    if (!isPdf) {
      response.status(400).json({ ok: false, message: 'Chi ho tro file PDF.' });
      return;
    }

    const body = request.body;
    const examId = body.exam_id ? Number(body.exam_id) : null;

    // 1. Luu submission vao DB
    const submissionResult = await query(`
      INSERT INTO submissions (exam_id, student_code, student_name, class_code, subject_code, submission_file_path, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'uploaded')
      RETURNING id
    `, [
      examId,
      String(body.student_code || '').trim(),
      String(body.student_name || '').trim(),
      String(body.class_code || '').trim(),
      String(body.subject_code || '').trim(),
      file.path
    ]);

    const submissionId = submissionResult.rows[0].id;

    // 2. Luu log
    await query(`
      INSERT INTO system_logs (log_type, ref_table, ref_id, exam_id, submission_id, student_code, student_name, class_code, status, message, request_payload)
      VALUES ('submission_upload', 'submissions', $1, $2, $1, $3, $4, $5, 'pending', 'Bai lam da luu, dang chuyen sang n8n workflow', $6)
    `, [
      submissionId,
      examId,
      String(body.student_code || '').trim(),
      String(body.student_name || '').trim(),
      String(body.class_code || '').trim(),
      JSON.stringify({ exam_id: examId, exam_code: body.exam_code, exam_type: body.exam_type, subject_code: body.subject_code, notes: body.notes })
    ]);

    // 3. Tra ve ngay, goi n8n async (fire and forget)
    response.json({
      ok: true,
      message: 'Da nop bai thanh cong. He thong dang xu ly va cham diem.',
      data: { submission_id: submissionId }
    });

    // Goi n8n sau khi da tra response
    forwardSubmissionToN8n(file, { ...body, submission_id: submissionId }).then(async () => {
      await query(`
        UPDATE system_logs SET status = 'success', message = 'N8n workflow da nhan bai lam', updated_at = NOW()
        WHERE ref_table = 'submissions' AND ref_id = $1 AND log_type = 'submission_upload'
      `, [submissionId]);
    }).catch(async (error) => {
      await query(`
        UPDATE system_logs SET status = 'error', error_message = $2, updated_at = NOW()
        WHERE ref_table = 'submissions' AND ref_id = $1 AND log_type = 'submission_upload'
      `, [submissionId, String(error.message || error)]);
    });

  } catch (error) {
    next(error);
  }
});

router.post('/:id/regrade', requireAuth, async (request, response, next) => {
  try {
    const submissionId = parseId(request.params.id);
    if (!submissionId) {
      response.status(400).json({ ok: false, message: 'Invalid submission id' });
      return;
    }

    const updateResult = await query(`
      UPDATE submissions
      SET status = 'regrade', updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `, [submissionId]);

    if (updateResult.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Submission not found' });
      return;
    }

    const detail = decorateSubmission(await queryEntityDetail('submissions', submissionId));
    response.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/approve', requireAuth, async (request, response, next) => {
  try {
    const submissionId = parseId(request.params.id);
    if (!submissionId) {
      response.status(400).json({ ok: false, message: 'Invalid submission id' });
      return;
    }

    // Lấy dữ liệu submission cho log
    const subData = await query(`
      SELECT s.exam_id, s.student_code, s.student_name, s.class_code
      FROM submissions s WHERE s.id = $1
    `, [submissionId]);

    if (subData.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Submission not found' });
      return;
    }

    const sub = subData.rows[0];

    // Check grading result exists and is in a gradeable state
    const gradingCheck = await query(`
      SELECT id, status FROM grading_results
      WHERE submission_id = $1
      ORDER BY attempt_no DESC
      LIMIT 1
    `, [submissionId]);

    if (gradingCheck.rowCount === 0) {
      response.status(400).json({ ok: false, message: 'Bai nop chua duoc cham. Khong the phe duyet.' });
      return;
    }

    const gradingStatus = gradingCheck.rows[0].status;
    if (['pending', 'processing', 'failed'].includes(gradingStatus)) {
      response.status(400).json({ ok: false, message: `Ket qua cham dang o trang thai "${gradingStatus}". Chi co the phe duyet khi bai da duoc cham xong.` });
      return;
    }

    // Update latest grading result to published
    const updateResult = await query(`
      UPDATE grading_results
      SET status = 'published',
          review_status = 'approved',
          published_at = NOW(),
          reviewed_at = NOW(),
          reviewed_by = $2,
          updated_at = NOW()
      WHERE id = (
        SELECT id FROM grading_results
        WHERE submission_id = $1
        ORDER BY attempt_no DESC
        LIMIT 1
      )
      RETURNING id, submission_id
    `, [submissionId, request.session.teacher.id]);

    if (updateResult.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Submission not found' });
      return;
    }

    const result = updateResult.rows[0];
    await query(`
      INSERT INTO system_logs (
        log_type,
        ref_table,
        ref_id,
        exam_id,
        submission_id,
        student_code,
        student_name,
        class_code,
        workflow_execution_id,
        status,
        message,
        response_payload,
        created_by,
        updated_by
      ) VALUES (
        'publish', 'grading_results', $1, $2, $3, $4, $5, $6, $7, 'success', 'Ket qua da duoc phe duyet va cong bo.', '{"published":true}'::jsonb, $8, $8
      )
    `, [
      result.id,
      sub.exam_id,
      result.submission_id,
      sub.student_code,
      sub.student_name,
      sub.class_code,
      `wf-publish-${sub.student_code.toLowerCase()}`,
      request.session.teacher.id
    ]);

    const detail = decorateSubmission(await queryEntityDetail('submissions', submissionId));
    response.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
});

// GET /api/submissions/:id/result - Get submission + latest grading result
router.get('/:id/result', requireAuth, async (request, response, next) => {
  try {
    const submissionId = parseId(request.params.id);
    if (!submissionId) {
      response.status(400).json({ ok: false, message: 'Invalid submission id' });
      return;
    }

    const result = await query(`
      SELECT
        s.id AS submission_id,
        s.exam_id,
        s.student_code,
        s.student_name,
        s.class_code,
        s.subject_code,
        s.submission_file_path,
        s.submission_extract,
        s.submitted_at,
        s.status AS submission_status,
        s.created_at,
        s.updated_at,
        e.exam_code,
        e.title AS exam_title,
        e.subject_name,
        e.exam_type,
        gr.id AS grading_id,
        gr.attempt_no,
        gr.grading_type,
        gr.total_score,
        gr.max_score,
        gr.ai_confidence,
        gr.grading_detail,
        gr.general_feedback,
        gr.review_notes AS notes,
        gr.status AS grading_status,
        gr.graded_at,
        gr.graded_by_name
      FROM submissions s
      LEFT JOIN exams e ON e.id = s.exam_id
      LEFT JOIN LATERAL (
        SELECT id, attempt_no, grading_type, total_score, max_score, ai_confidence,
               grading_detail, general_feedback, review_notes, status, graded_at, graded_by_name
        FROM grading_results
        WHERE submission_id = s.id
        ORDER BY attempt_no DESC
        LIMIT 1
      ) gr ON true
      WHERE s.id = $1
    `, [submissionId]);

    if (result.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Submission not found' });
      return;
    }

    const row = result.rows[0];
    const payload = {
      student: {
        student_code: row.student_code,
        student_name: row.student_name,
        class_code: row.class_code,
        subject_code: row.subject_code
      },
      submission: {
        submission_id: row.submission_id,
        exam_id: row.exam_id,
        exam_code: row.exam_code,
        exam_title: row.exam_title,
        subject_name: row.subject_name,
        exam_type: row.exam_type,
        submission_file_path: row.submission_file_path,
        submission_extract: row.submission_extract,
        submitted_at: row.submitted_at,
        status: row.submission_status
      },
      grading: row.grading_id ? {
        grading_id: row.grading_id,
        attempt_no: row.attempt_no,
        grading_type: row.grading_type,
        total_score: row.total_score,
        max_score: row.max_score,
        ai_confidence: row.ai_confidence,
        grading_detail: row.grading_detail,
        general_feedback: row.general_feedback,
        notes: row.notes,
        status: row.grading_status,
        graded_at: row.graded_at,
        graded_by_name: row.graded_by_name
      } : null
    };

    response.json({ ok: true, data: payload });
  } catch (error) {
    next(error);
  }
});

// GET /api/submissions/:id/history - Get grading history of a submission
router.get('/:id/history', requireAuth, async (request, response, next) => {
  try {
    const submissionId = parseId(request.params.id);
    if (!submissionId) {
      response.status(400).json({ ok: false, message: 'Invalid submission id' });
      return;
    }

    // Get submission info with teacher check
    const submissionCheck = await query(`
      SELECT s.id, s.exam_id, e.teacher_id
      FROM submissions s
      INNER JOIN exams e ON e.id = s.exam_id
      WHERE s.id = $1
    `, [submissionId]);

    if (submissionCheck.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Submission not found' });
      return;
    }

    const submission = submissionCheck.rows[0];
    if (submission.teacher_id !== request.session.teacher.id) {
      response.status(403).json({ ok: false, message: 'Unauthorized - not your exam' });
      return;
    }

    // Get all grading attempts
    const result = await query(`
      SELECT
        id,
        submission_id,
        attempt_no,
        grading_type,
        total_score,
        max_score,
        ai_confidence,
        grading_detail,
        general_feedback,
        graded_by,
        graded_by_name,
        graded_at,
        reviewed_by,
        reviewed_at,
        review_status,
        review_notes,
        status,
        error_message,
        published_at,
        created_at,
        updated_at
      FROM grading_results
      WHERE submission_id = $1
      ORDER BY attempt_no DESC
    `, [submissionId]);

    response.json({
      ok: true,
      submission_id: submissionId,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/submissions/by-student - Get submission history by student and exam
router.get('/by-student', requireAuth, async (request, response, next) => {
  try {
    const { exam_id, student_code } = request.query;

    if (!exam_id || !student_code) {
      response.status(400).json({ ok: false, message: 'exam_id and student_code are required' });
      return;
    }

    const examId = parseId(exam_id);
    if (!examId) {
      response.status(400).json({ ok: false, message: 'Invalid exam_id' });
      return;
    }

    // Verify exam belongs to teacher
    const examCheck = await query(`
      SELECT id, exam_code, title FROM exams WHERE id = $1 AND teacher_id = $2
    `, [examId, request.session.teacher.id]);

    if (examCheck.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Exam not found or unauthorized' });
      return;
    }

    // Get all submissions for student + exam with ALL grading attempts
    const result = await query(`
      SELECT
        s.id AS submission_id,
        s.exam_id,
        e.exam_code,
        e.title AS exam_title,
        s.student_code,
        s.student_name,
        s.class_code,
        s.subject_code,
        s.submission_file_path,
        s.submission_extract,
        s.submitted_at,
        s.status AS submission_status,
        s.created_at AS submission_created_at,
        gr.id AS grading_result_id,
        gr.attempt_no,
        gr.grading_type,
        gr.total_score,
        gr.max_score,
        gr.ai_confidence,
        gr.grading_detail,
        gr.general_feedback,
        gr.graded_by,
        gr.graded_by_name,
        gr.graded_at,
        gr.reviewed_by,
        gr.reviewed_at,
        gr.review_status,
        gr.review_notes,
        gr.status AS grading_status,
        gr.error_message,
        gr.published_at,
        gr.created_at AS grading_created_at,
        gr.updated_at AS grading_updated_at
      FROM submissions s
      LEFT JOIN exams e ON e.id = s.exam_id
      LEFT JOIN grading_results gr ON gr.submission_id = s.id
      WHERE s.exam_id = $1 AND s.student_code = $2
      ORDER BY s.submitted_at DESC NULLS LAST, s.id DESC, gr.attempt_no DESC
    `, [examId, student_code]);

    response.json({
      ok: true,
      exam_id: examId,
      exam_code: examCheck.rows[0].exam_code,
      exam_title: examCheck.rows[0].title,
      student_code: student_code,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});


module.exports = {
  router,
  studentResultsHandler
};