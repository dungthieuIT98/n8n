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
        gr.notes,
        gr.graded_at,
        gr.review_status,
        gr.published_at,
        gr.reviewed_by,
        gr.reviewed_at,
        gr.status AS grading_status
      FROM submissions s
      LEFT JOIN exams e ON e.id = s.exam_id
      LEFT JOIN LATERAL (
        SELECT id, total_score, max_score, ai_confidence, grading_detail, general_feedback, notes,
               graded_at, review_status, published_at, reviewed_by, reviewed_at, status
        FROM grading_results
        WHERE submission_id = s.id
        ORDER BY grading_attempt DESC
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

    const result = await forwardSubmissionToN8n(file, request.body);
    response.json({
      ok: true,
      message: 'Da nop bai thanh cong. He thong dang xu ly va cham diem.',
      data: result
    });
  } catch (error) {
    if (error.statusCode) {
      const message = error.payload?.message || 'Khong the goi workflow n8n.';
      const hint = error.payload?.hint || null;
      response.status(502).json({
        ok: false,
        message,
        hint,
        source: 'n8n-webhook'
      });
      return;
    }

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

    // Get current grading result
    const currentResult = await query(`
      SELECT gr.*, s.exam_id, s.student_code, s.student_name, s.class_code, s.subject_code,
             e.exam_code, e.title AS exam_title
      FROM grading_results gr
      INNER JOIN submissions s ON s.id = gr.submission_id
      LEFT JOIN exams e ON e.id = s.exam_id
      WHERE gr.submission_id = $1
      ORDER BY gr.grading_attempt DESC
      LIMIT 1
    `, [submissionId]);

    if (currentResult.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Grading result not found' });
      return;
    }

    const current = currentResult.rows[0];
    const newTotalScore = Math.min(current.max_score || 10, (current.total_score || 0) + 0.25);
    const newConfidence = Math.min(99, (current.ai_confidence || 80) + 3);

    // Insert new grading attempt
    const updateResult = await query(`
      INSERT INTO grading_results (
        submission_id, exam_id, exam_code, exam_title, class_code, subject_code,
        student_code, student_name, grading_attempt, grading_type,
        total_score, max_score, ai_confidence, grading_detail, general_feedback,
        graded_by, graded_by_name, review_status, status, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 're-grade',
        $10, $11, $12, $13, $14, $15, $16, 'recheck', 'completed', $15, $15
      )
      RETURNING id, submission_id, exam_id, student_code, student_name, class_code, total_score, ai_confidence
    `, [
      submissionId,
      current.exam_id,
      current.exam_code,
      current.exam_title,
      current.class_code,
      current.subject_code,
      current.student_code,
      current.student_name,
      current.grading_attempt + 1,
      newTotalScore,
      current.max_score,
      newConfidence,
      current.grading_detail,
      'Da duoc cham lai tu dong',
      request.session.teacher.id,
      request.session.teacher.full_name
    ]);

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
        model_name,
        status,
        message,
        response_payload,
        created_by,
        updated_by
      ) VALUES (
        'grading', 'grading_results', $1, $2, $3, $4, $5, $6, $7, 'gpt-5.4', 'success', 'Cham lai thanh cong.', $8::jsonb, $9, $9
      )
    `, [
      result.id,
      result.exam_id,
      result.submission_id,
      result.student_code,
      result.student_name,
      result.class_code,
      `wf-regrade-${result.student_code.toLowerCase()}`,
      JSON.stringify({ total_score: result.total_score, confidence: result.ai_confidence }),
      request.session.teacher.id
    ]);

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

    // Update latest grading result to published
    const updateResult = await query(`
      UPDATE grading_results
      SET status = 'published',
          review_status = 'approved',
          published_at = NOW(),
          reviewed_at = NOW(),
          reviewed_by = $2,
          updated_at = NOW(),
          updated_by = $2
      WHERE id = (
        SELECT id FROM grading_results
        WHERE submission_id = $1
        ORDER BY grading_attempt DESC
        LIMIT 1
      )
      RETURNING id, submission_id, exam_id, student_code, student_name, class_code
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
      result.exam_id,
      result.submission_id,
      result.student_code,
      result.student_name,
      result.class_code,
      `wf-publish-${result.student_code.toLowerCase()}`,
      request.session.teacher.id
    ]);

    const detail = decorateSubmission(await queryEntityDetail('submissions', submissionId));
    response.json({ ok: true, data: detail });
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
        exam_id,
        exam_code,
        exam_title,
        class_code,
        subject_code,
        student_code,
        student_name,
        grading_attempt,
        grading_type,
        total_score,
        max_score,
        ai_confidence,
        grading_detail,
        general_feedback,
        notes,
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
      ORDER BY grading_attempt DESC
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
        gr.grading_attempt,
        gr.grading_type,
        gr.total_score,
        gr.max_score,
        gr.ai_confidence,
        gr.grading_detail,
        gr.general_feedback,
        gr.notes,
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
      ORDER BY s.submitted_at DESC NULLS LAST, s.id DESC, gr.grading_attempt DESC
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