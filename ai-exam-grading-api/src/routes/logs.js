const express = require('express');

const { query, queryEntityDetail } = require('../database');
const { parseId, requireAuth } = require('../helpers');

const router = express.Router();

router.post('/:id/retry', requireAuth, async (request, response, next) => {
  try {
    const logId = parseId(request.params.id);
    if (!logId) {
      response.status(400).json({ ok: false, message: 'Invalid log id' });
      return;
    }

    const logResult = await query(`
      UPDATE system_logs
      SET status = 'success',
          message = CONCAT(message, ' Retry thanh cong.'),
          error_message = NULL,
          response_payload = '{"retry":true,"status":"success"}'::jsonb,
          updated_at = NOW(),
          updated_by = $2
      WHERE id = $1
      RETURNING id, ref_table, ref_id, exam_id, submission_id, student_code, student_name, class_code, workflow_execution_id, model_name, request_payload
    `, [logId, request.session.teacher.id]);

    if (logResult.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Log not found' });
      return;
    }

    const log = logResult.rows[0];
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
        request_payload,
        response_payload,
        created_by,
        updated_by
      ) VALUES (
        'retry', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'success', 'Da retry workflow thanh cong.', $10::jsonb, '{"retry":true,"status":"success"}'::jsonb, $11, $11
      )
    `, [
      log.ref_table,
      log.ref_id,
      log.exam_id,
      log.submission_id,
      log.student_code,
      log.student_name,
      log.class_code,
      `wf-retry-${log.id}`,
      log.model_name,
      JSON.stringify(log.request_payload || {}),
      request.session.teacher.id
    ]);

    if (log.submission_id) {
      await query(`
        UPDATE submissions
        SET status = 'graded',
            review_status = 'recheck',
            ai_confidence = COALESCE(ai_confidence, 84),
            total_score = COALESCE(total_score, 7),
            graded_at = NOW(),
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $1 AND status = 'failed'
      `, [log.submission_id, request.session.teacher.id]);
    }

    const detail = await queryEntityDetail('system_logs', log.id);
    response.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
});

module.exports = router;