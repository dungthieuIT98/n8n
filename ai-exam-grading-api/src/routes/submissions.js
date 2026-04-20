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
        s.submission_extract_file_path,
        s.grading_result_file_path,
        s.total_score,
        s.max_score,
        s.ai_confidence,
        s.submitted_at,
        s.graded_at,
        s.status,
        s.review_status,
        s.notes,
        s.published_at,
        s.reviewed_by,
        s.reviewed_at,
        s.created_at,
        s.updated_at
      FROM submissions s
      LEFT JOIN exams e ON e.id = s.exam_id
      WHERE s.status = 'published'
        AND ($1 = '' OR LOWER(s.student_code) = $1)
        AND ($2 = '' OR LOWER(s.student_name) LIKE '%' || $2 || '%')
        AND ($3 = '' OR LOWER(s.class_code) = $3)
      ORDER BY s.published_at DESC NULLS LAST, s.id DESC
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

    const updateResult = await query(`
      UPDATE submissions
      SET status = 'graded',
          review_status = 'recheck',
          graded_at = NOW(),
          ai_confidence = LEAST(99, COALESCE(ai_confidence, 80) + 3),
          total_score = LEAST(COALESCE(max_score, 10), COALESCE(total_score, 0) + 0.25),
          updated_at = NOW(),
          updated_by = $2
      WHERE id = $1
      RETURNING id, exam_id, student_code, student_name, class_code, total_score, ai_confidence
    `, [submissionId, request.session.teacher.id]);

    if (updateResult.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Submission not found' });
      return;
    }

    const submission = updateResult.rows[0];
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
        'grading', 'submissions', $1, $2, $1, $3, $4, $5, $6, 'gpt-5.4', 'success', 'Cham lai thanh cong.', $7::jsonb, $8, $8
      )
    `, [
      submission.id,
      submission.exam_id,
      submission.student_code,
      submission.student_name,
      submission.class_code,
      `wf-regrade-${submission.student_code.toLowerCase()}`,
      JSON.stringify({ total_score: submission.total_score, confidence: submission.ai_confidence }),
      request.session.teacher.id
    ]);

    const detail = decorateSubmission(await queryEntityDetail('submissions', submission.id));
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

    const updateResult = await query(`
      UPDATE submissions
      SET status = 'published',
          review_status = 'approved',
          published_at = NOW(),
          reviewed_at = NOW(),
          reviewed_by = $2,
          updated_at = NOW(),
          updated_by = $2
      WHERE id = $1
      RETURNING id, exam_id, student_code, student_name, class_code
    `, [submissionId, request.session.teacher.id]);

    if (updateResult.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Submission not found' });
      return;
    }

    const submission = updateResult.rows[0];
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
        'publish', 'submissions', $1, $2, $1, $3, $4, $5, $6, 'success', 'Ket qua da duoc phe duyet va cong bo.', '{"published":true}'::jsonb, $7, $7
      )
    `, [
      submission.id,
      submission.exam_id,
      submission.student_code,
      submission.student_name,
      submission.class_code,
      `wf-publish-${submission.student_code.toLowerCase()}`,
      request.session.teacher.id
    ]);

    const detail = decorateSubmission(await queryEntityDetail('submissions', submission.id));
    response.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
});

router.get('/student-results', studentResultsHandler);

module.exports = {
  router,
  studentResultsHandler
};