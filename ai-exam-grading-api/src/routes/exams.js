const express = require('express');
const FormData = require('form-data');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

const config = require('../config');
const { query, queryEntityDetail } = require('../database');
const { parseId, requireAuth } = require('../helpers');

const router = express.Router();

async function nextExamCode() {
  const result = await query('SELECT COUNT(*)::int AS total FROM exams');
  const nextNumber = String((result.rows[0]?.total || 0) + 1).padStart(3, '0');
  return `EX-2026-${nextNumber}`;
}

function forwardExamToN8n(questionFile, answerFile, body) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('question_file', fs.createReadStream(questionFile.path), {
      filename: questionFile.originalname,
      contentType: questionFile.mimetype
    });
    formData.append('answer_file', fs.createReadStream(answerFile.path), {
      filename: answerFile.originalname,
      contentType: answerFile.mimetype
    });

    [
      'exam_id',
      'exam_code',
      'title',
      'description',
      'class_code',
      'subject_code',
      'subject_name',
      'exam_type',
      'exam_round',
      'teacher_id',
      'question_file_path',
      'answer_file_path'
    ].forEach((fieldName) => {
      if (body[fieldName] !== undefined && body[fieldName] !== null && body[fieldName] !== '') {
        formData.append(fieldName, String(body[fieldName]));
      }
    });

    const webhookUrl = new URL(`${config.n8nBaseUrl}/${config.n8nApis.uploadExam}`);
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

router.post('/', requireAuth, async (request, response, next) => {
  try {
    const questionFile = request.files?.question_file?.[0];
    const answerFile = request.files?.answer_file?.[0];

    if (!questionFile || !answerFile) {
      response.status(400).json({ ok: false, message: 'Can tai len file de thi va file dap an.' });
      return;
    }

    const teacherId = parseId(request.body.teacher_id) || request.session.teacher.id;
    const examCode = await nextExamCode();
    const insertResult = await query(`
      INSERT INTO exams (
        exam_code,
        version,
        title,
        description,
        class_code,
        subject_code,
        subject_name,
        exam_type,
        exam_round,
        teacher_id,
        question_file_path,
        answer_file_path,
        answer_extract,
        status,
        created_by,
        updated_by
      ) VALUES (
        $1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'processing', $9, $9
      )
      RETURNING id
    `, [
      examCode,
      request.body.title,
      request.body.description || '',
      request.body.class_code,
      request.body.subject_code,
      request.body.subject_name,
      request.body.exam_type,
      request.body.exam_round,
      teacherId,
      null,
      null,
      null
    ]);

    const examId = insertResult.rows[0].id;
    await query(`
      INSERT INTO system_logs (
        log_type,
        ref_table,
        ref_id,
        exam_id,
        workflow_execution_id,
        model_name,
        status,
        message,
        request_payload,
        created_by,
        updated_by
      ) VALUES (
        'exam_extract', 'exams', $1, $1, $2, 'gpt-5.4', 'queued', $3, $4::jsonb, $5, $5
      )
    `, [
      examId,
      `wf-extract-${examCode.toLowerCase()}`,
      'Da tai len de thi moi, dang cho extract.',
      JSON.stringify({ exam_code: examCode, question_file: questionFile.originalname, answer_file: answerFile.originalname }),
      teacherId
    ]);

    let workflowResult;
    try {
      workflowResult = await forwardExamToN8n(questionFile, answerFile, {
        exam_id: examId,
        exam_code: examCode,
        title: request.body.title,
        description: request.body.description || '',
        class_code: request.body.class_code,
        subject_code: request.body.subject_code,
        subject_name: request.body.subject_name,
        exam_type: request.body.exam_type,
        exam_round: request.body.exam_round,
        teacher_id: teacherId
      });
    } catch (error) {
      await query(`
        UPDATE exams
        SET status = 'processing',
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $1
      `, [examId, teacherId]);

      await query(`
        INSERT INTO system_logs (
          log_type,
          ref_table,
          ref_id,
          exam_id,
          class_code,
          workflow_execution_id,
          model_name,
          status,
          message,
          error_message,
          request_payload,
          created_by,
          updated_by
        ) VALUES (
          'exam_extract', 'exams', $1, $1, $2, $3, 'gpt-5.4', 'failed', $4, $5, $6::jsonb, $7, $7
        )
      `, [
        examId,
        request.body.class_code || null,
        `wf-extract-${examCode.toLowerCase()}`,
        'Khong the kich hoat workflow extract de thi.',
        error.payload?.message || error.message,
        JSON.stringify({ exam_code: examCode, question_file: questionFile.originalname, answer_file: answerFile.originalname }),
        teacherId
      ]);

      if (error.statusCode) {
        const detail = await queryEntityDetail('exams', examId);
        response.status(502).json({
          ok: false,
          message: error.payload?.message || 'Khong the goi workflow n8n.',
          hint: error.payload?.hint || null,
          source: 'n8n-webhook',
          data: detail
        });
        return;
      }

      throw error;
    }

    const exam = await queryEntityDetail('exams', examId);
    response.status(201).json({ ok: true, data: exam, workflow: workflowResult || null });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reprocess', requireAuth, async (request, response, next) => {
  try {
    const examId = parseId(request.params.id);
    if (!examId) {
      response.status(400).json({ ok: false, message: 'Invalid exam id' });
      return;
    }

    const updateResult = await query(`
      UPDATE exams
      SET version = version + 1,
          status = 'processing',
          updated_at = NOW(),
          updated_by = $2
      WHERE id = $1
      RETURNING id, exam_code, class_code, version
    `, [examId, request.session.teacher.id]);

    if (updateResult.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Exam not found' });
      return;
    }

    const exam = updateResult.rows[0];
    await query(`
      INSERT INTO system_logs (
        log_type,
        ref_table,
        ref_id,
        exam_id,
        class_code,
        workflow_execution_id,
        model_name,
        status,
        message,
        request_payload,
        created_by,
        updated_by
      ) VALUES (
        'exam_extract', 'exams', $1, $1, $2, $3, 'gpt-5.4', 'running', $4, $5::jsonb, $6, $6
      )
    `, [
      exam.id,
      exam.class_code,
      `wf-extract-${exam.exam_code.toLowerCase()}-v${exam.version}`,
      'Cap nhat de thi va kich hoat extract lai.',
      JSON.stringify({ exam_code: exam.exam_code, version: exam.version }),
      request.session.teacher.id
    ]);

    const detail = await queryEntityDetail('exams', exam.id);
    response.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
});

module.exports = router;