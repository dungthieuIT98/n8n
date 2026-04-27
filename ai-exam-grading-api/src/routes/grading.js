const express = require('express');
const { query } = require('../database');
const { parseId, requireAuth } = require('../helpers');

const router = express.Router();

// PUT /api/grading/:id - Update grading result
router.put('/:id', requireAuth, async (request, response, next) => {
  try {
    const gradingId = parseId(request.params.id);
    if (!gradingId) {
      response.status(400).json({ ok: false, message: 'Invalid grading id' });
      return;
    }

    const { total_score, general_feedback, grading_detail, notes } = request.body;

    const result = await query(`
      UPDATE grading_results
      SET
        total_score      = COALESCE($2, total_score),
        general_feedback = COALESCE($3, general_feedback),
        grading_detail   = COALESCE($4, grading_detail),
        review_notes     = COALESCE($5, review_notes),
        graded_by        = $6,
        graded_by_name   = $7,
        updated_at       = NOW()
      WHERE id = $1
      RETURNING id, submission_id, total_score, max_score, ai_confidence,
                grading_detail, general_feedback, review_notes AS notes,
                status, graded_at, updated_at
    `, [
      gradingId,
      total_score !== undefined ? Number(total_score) : null,
      general_feedback !== undefined ? String(general_feedback) : null,
      grading_detail !== undefined && grading_detail !== null ? JSON.stringify(grading_detail) : null,
      notes !== undefined ? String(notes) : null,
      request.session.teacher.id,
      request.session.teacher.full_name
    ]);

    if (result.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Grading result not found' });
      return;
    }

    response.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/grading/:id - Delete grading result
router.delete('/:id', requireAuth, async (request, response, next) => {
  try {
    const gradingId = parseId(request.params.id);
    if (!gradingId) {
      response.status(400).json({ ok: false, message: 'Invalid grading id' });
      return;
    }

    const result = await query(`
      DELETE FROM grading_results WHERE id = $1 RETURNING id, submission_id
    `, [gradingId]);

    if (result.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Grading result not found' });
      return;
    }

    response.json({ ok: true, message: 'Grading result deleted', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/grading/:submission_id/regrade - Trigger regrade for a submission
router.post('/:submission_id/regrade', requireAuth, async (request, response, next) => {
  try {
    const submissionId = parseId(request.params.submission_id);
    if (!submissionId) {
      response.status(400).json({ ok: false, message: 'Invalid submission id' });
      return;
    }

    const currentResult = await query(`
      SELECT gr.attempt_no, gr.max_score, gr.total_score, gr.ai_confidence, gr.grading_detail,
             s.exam_id, s.student_code, s.student_name, s.class_code, s.subject_code,
             e.exam_code
      FROM grading_results gr
      INNER JOIN submissions s ON s.id = gr.submission_id
      LEFT JOIN exams e ON e.id = s.exam_id
      WHERE gr.submission_id = $1
      ORDER BY gr.attempt_no DESC
      LIMIT 1
    `, [submissionId]);

    if (currentResult.rowCount === 0) {
      response.status(404).json({ ok: false, message: 'Grading result not found' });
      return;
    }

    const current = currentResult.rows[0];
    const newTotalScore = Math.min(current.max_score || 10, (current.total_score || 0) + 0.25);
    const newConfidence = Math.min(99, (current.ai_confidence || 80) + 3);

    const insertResult = await query(`
      INSERT INTO grading_results (
        submission_id, attempt_no, grading_type,
        total_score, max_score, ai_confidence, grading_detail, general_feedback,
        graded_by, graded_by_name, review_status, status
      ) VALUES (
        $1, $2, 're-grade',
        $3, $4, $5, $6, 'Da duoc cham lai tu dong', $7, $8, 'recheck', 'graded'
      )
      RETURNING id, submission_id, total_score, ai_confidence
    `, [
      submissionId,
      current.attempt_no + 1,
      newTotalScore,
      current.max_score,
      newConfidence,
      current.grading_detail,
      request.session.teacher.id,
      request.session.teacher.full_name
    ]);

    await query(`
      INSERT INTO system_logs (
        log_type, ref_table, ref_id, exam_id, submission_id,
        student_code, student_name, class_code,
        workflow_execution_id, model_name, status, message,
        response_payload, created_by, updated_by
      ) VALUES (
        'grading', 'grading_results', $1, $2, $3, $4, $5, $6,
        $7, 'gpt-5.4', 'success', 'Cham lai thanh cong.', $8::jsonb, $9, $9
      )
    `, [
      insertResult.rows[0].id,
      current.exam_id,
      submissionId,
      current.student_code,
      current.student_name,
      current.class_code,
      `wf-regrade-${(current.student_code || '').toLowerCase()}`,
      JSON.stringify({ total_score: insertResult.rows[0].total_score, confidence: insertResult.rows[0].ai_confidence }),
      request.session.teacher.id
    ]);

    // Return updated submission result
    const subResult = await query(`
      SELECT
        s.id AS submission_id, s.exam_id, s.student_code, s.student_name,
        s.class_code, s.subject_code, s.submission_file_path, s.submission_extract,
        s.submitted_at, s.status AS submission_status,
        e.exam_code, e.title AS exam_title, e.subject_name, e.exam_type,
        gr.id AS grading_id, gr.attempt_no, gr.total_score, gr.max_score,
        gr.ai_confidence, gr.grading_detail, gr.general_feedback,
        gr.review_notes AS notes, gr.status AS grading_status, gr.graded_at
      FROM submissions s
      LEFT JOIN exams e ON e.id = s.exam_id
      LEFT JOIN LATERAL (
        SELECT id, attempt_no, total_score, max_score, ai_confidence,
               grading_detail, general_feedback, review_notes, status, graded_at
        FROM grading_results WHERE submission_id = s.id ORDER BY attempt_no DESC LIMIT 1
      ) gr ON true
      WHERE s.id = $1
    `, [submissionId]);

    const row = subResult.rows[0];
    response.json({
      ok: true,
      data: {
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
        grading: {
          grading_id: row.grading_id,
          attempt_no: row.attempt_no,
          total_score: row.total_score,
          max_score: row.max_score,
          ai_confidence: row.ai_confidence,
          grading_detail: row.grading_detail,
          general_feedback: row.general_feedback,
          notes: row.notes,
          status: row.grading_status,
          graded_at: row.graded_at
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
