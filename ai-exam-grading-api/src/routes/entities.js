const express = require('express');
const { query, queryEntityList, queryEntityDetail, ENTITY_ALIASES, ENTITY_CONFIG } = require('../database');
const { decorateSubmission, requireAuth } = require('../helpers');

const router = express.Router();

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function ensureRecordExists(table, id) {
  const result = await query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
  return result.rows[0] || null;
}

function pickDefined(input, keys) {
  const output = {};
  for (const key of keys) {
    if (input && Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined) {
      output[key] = input[key];
    }
  }
  return output;
}

function hasFilter(config, name) {
  const filters = config?.filterColumns || [];
  return filters.some((entry) => (typeof entry === 'string' ? entry === name : entry?.name === name));
}

// Middleware to inject teacher_id for teacher-owned entities
function injectTeacherFilter(request, response, next) {
  if (request.session && request.session.teacher && request.session.teacher.id) {
    const entityName = ENTITY_ALIASES[request.params.entity] || request.params.entity;
    const config = ENTITY_CONFIG[entityName];
    
    // Auto-inject teacher_id for entities that support teacher filtering
    if (hasFilter(config, 'teacher_id')) {
      request.query.teacher_id = String(request.session.teacher.id);
    }
    
    // For system_logs, use created_by instead
    if (entityName === 'system_logs' && hasFilter(config, 'created_by')) {
      request.query.created_by = String(request.session.teacher.id);
    }
  }
  next();
}

// GET /api/search - Tìm kiếm đa entity
router.get('/search', async (request, response, next) => {
  try {
    const requestedEntities = String(request.query.entity || request.query.entities || Object.keys(ENTITY_CONFIG).join(','))
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const uniqueEntities = requestedEntities.filter((entityName, index) => requestedEntities.indexOf(entityName) === index);
    const invalidEntities = uniqueEntities.filter((entityName) => !ENTITY_CONFIG[ENTITY_ALIASES[entityName] || entityName]);

    if (invalidEntities.length > 0) {
      response.status(400).json({ ok: false, message: `Unsupported entities: ${invalidEntities.join(', ')}` });
      return;
    }

    const results = await Promise.all(uniqueEntities.map((entityName) => queryEntityList(entityName, request.query)));
    response.json({ ok: true, query: request.query.q || '', results });
  } catch (error) {
    next(error);
  }
});

// ===== Simple CRUD for master data (classes / subjects / exam periods) =====

router.get('/classes', requireAuth, async (_request, response, next) => {
  try {
    const result = await query(
      `SELECT id, class_code, class_name, grade, status, created_at, updated_at
       FROM classes
       ORDER BY created_at DESC, id DESC`
    );
    response.json({ ok: true, entity: 'classes', data: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/classes', requireAuth, async (request, response, next) => {
  try {
    const { class_code, class_name, grade, status } = request.body || {};
    if (!class_code) {
      response.status(400).json({ ok: false, message: 'class_code is required' });
      return;
    }

    const result = await query(
      `INSERT INTO classes (class_code, class_name, grade, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, class_code, class_name, grade, status, created_at, updated_at`,
      [String(class_code).trim(), class_name ?? null, grade ?? null, status ?? 'active']
    );
    response.json({ ok: true, entity: 'classes', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/classes/:id', requireAuth, async (request, response, next) => {
  try {
    const id = parsePositiveInt(request.params.id);
    if (!id) {
      response.status(400).json({ ok: false, message: 'Invalid id' });
      return;
    }

    const existing = await ensureRecordExists('classes', id);
    if (!existing) {
      response.status(404).json({ ok: false, message: `Record not found for classes#${id}` });
      return;
    }

    const updates = pickDefined(request.body, ['class_code', 'class_name', 'grade', 'status']);
    const nextRow = Object.assign({}, existing, updates);
    if (!nextRow.class_code) {
      response.status(400).json({ ok: false, message: 'class_code is required' });
      return;
    }

    const result = await query(
      `UPDATE classes
       SET class_code = $2,
           class_name = $3,
           grade = $4,
           status = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, class_code, class_name, grade, status, created_at, updated_at`,
      [id, String(nextRow.class_code).trim(), nextRow.class_name ?? null, nextRow.grade ?? null, nextRow.status ?? 'active']
    );
    response.json({ ok: true, entity: 'classes', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/classes/:id', requireAuth, async (request, response, next) => {
  try {
    const id = parsePositiveInt(request.params.id);
    if (!id) {
      response.status(400).json({ ok: false, message: 'Invalid id' });
      return;
    }

    const existing = await ensureRecordExists('classes', id);
    if (!existing) {
      response.status(404).json({ ok: false, message: `Record not found for classes#${id}` });
      return;
    }

    await query('DELETE FROM classes WHERE id = $1', [id]);
    response.json({ ok: true, entity: 'classes', deleted: true, id });
  } catch (error) {
    next(error);
  }
});

router.get('/subjects', requireAuth, async (_request, response, next) => {
  try {
    const result = await query(
      `SELECT id, subject_code, subject_name, status, created_at, updated_at
       FROM subjects
       ORDER BY created_at DESC, id DESC`
    );
    response.json({ ok: true, entity: 'subjects', data: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/subjects', requireAuth, async (request, response, next) => {
  try {
    const { subject_code, subject_name, status } = request.body || {};
    if (!subject_code || !subject_name) {
      response.status(400).json({ ok: false, message: 'subject_code and subject_name are required' });
      return;
    }

    const result = await query(
      `INSERT INTO subjects (subject_code, subject_name, status)
       VALUES ($1, $2, $3)
       RETURNING id, subject_code, subject_name, status, created_at, updated_at`,
      [String(subject_code).trim(), String(subject_name).trim(), status ?? 'active']
    );
    response.json({ ok: true, entity: 'subjects', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/subjects/:id', requireAuth, async (request, response, next) => {
  try {
    const id = parsePositiveInt(request.params.id);
    if (!id) {
      response.status(400).json({ ok: false, message: 'Invalid id' });
      return;
    }

    const existing = await ensureRecordExists('subjects', id);
    if (!existing) {
      response.status(404).json({ ok: false, message: `Record not found for subjects#${id}` });
      return;
    }

    const updates = pickDefined(request.body, ['subject_code', 'subject_name', 'status']);
    const nextRow = Object.assign({}, existing, updates);
    if (!nextRow.subject_code || !nextRow.subject_name) {
      response.status(400).json({ ok: false, message: 'subject_code and subject_name are required' });
      return;
    }

    const result = await query(
      `UPDATE subjects
       SET subject_code = $2,
           subject_name = $3,
           status = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, subject_code, subject_name, status, created_at, updated_at`,
      [id, String(nextRow.subject_code).trim(), String(nextRow.subject_name).trim(), nextRow.status ?? 'active']
    );
    response.json({ ok: true, entity: 'subjects', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/subjects/:id', requireAuth, async (request, response, next) => {
  try {
    const id = parsePositiveInt(request.params.id);
    if (!id) {
      response.status(400).json({ ok: false, message: 'Invalid id' });
      return;
    }

    const existing = await ensureRecordExists('subjects', id);
    if (!existing) {
      response.status(404).json({ ok: false, message: `Record not found for subjects#${id}` });
      return;
    }

    await query('DELETE FROM subjects WHERE id = $1', [id]);
    response.json({ ok: true, entity: 'subjects', deleted: true, id });
  } catch (error) {
    next(error);
  }
});

function registerExamPeriodRoutes(basePath) {
  router.get(basePath, requireAuth, async (_request, response, next) => {
    try {
      const result = await query(
        `SELECT id, period_code, period_name, description, start_date, end_date, status, created_at, updated_at
         FROM exam_periods
         ORDER BY created_at DESC, id DESC`
      );
      response.json({ ok: true, entity: 'exam_periods', data: result.rows });
    } catch (error) {
      next(error);
    }
  });

  router.post(basePath, requireAuth, async (request, response, next) => {
    try {
      const { period_code, period_name, description, start_date, end_date, status } = request.body || {};
      if (!period_code || !period_name) {
        response.status(400).json({ ok: false, message: 'period_code and period_name are required' });
        return;
      }

      const result = await query(
        `INSERT INTO exam_periods (period_code, period_name, description, start_date, end_date, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, period_code, period_name, description, start_date, end_date, status, created_at, updated_at`,
        [
          String(period_code).trim(),
          String(period_name).trim(),
          description ?? null,
          start_date ?? null,
          end_date ?? null,
          status ?? 'active'
        ]
      );
      response.json({ ok: true, entity: 'exam_periods', data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.put(`${basePath}/:id`, requireAuth, async (request, response, next) => {
    try {
      const id = parsePositiveInt(request.params.id);
      if (!id) {
        response.status(400).json({ ok: false, message: 'Invalid id' });
        return;
      }

      const existing = await ensureRecordExists('exam_periods', id);
      if (!existing) {
        response.status(404).json({ ok: false, message: `Record not found for exam_periods#${id}` });
        return;
      }

      const updates = pickDefined(request.body, ['period_code', 'period_name', 'description', 'start_date', 'end_date', 'status']);
      const nextRow = Object.assign({}, existing, updates);
      if (!nextRow.period_code || !nextRow.period_name) {
        response.status(400).json({ ok: false, message: 'period_code and period_name are required' });
        return;
      }

      const result = await query(
        `UPDATE exam_periods
         SET period_code = $2,
             period_name = $3,
             description = $4,
             start_date = $5,
             end_date = $6,
             status = $7,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, period_code, period_name, description, start_date, end_date, status, created_at, updated_at`,
        [
          id,
          String(nextRow.period_code).trim(),
          String(nextRow.period_name).trim(),
          nextRow.description ?? null,
          nextRow.start_date ?? null,
          nextRow.end_date ?? null,
          nextRow.status ?? 'active'
        ]
      );
      response.json({ ok: true, entity: 'exam_periods', data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.delete(`${basePath}/:id`, requireAuth, async (request, response, next) => {
    try {
      const id = parsePositiveInt(request.params.id);
      if (!id) {
        response.status(400).json({ ok: false, message: 'Invalid id' });
        return;
      }

      const existing = await ensureRecordExists('exam_periods', id);
      if (!existing) {
        response.status(404).json({ ok: false, message: `Record not found for exam_periods#${id}` });
        return;
      }

      await query('DELETE FROM exam_periods WHERE id = $1', [id]);
      response.json({ ok: true, entity: 'exam_periods', deleted: true, id });
    } catch (error) {
      next(error);
    }
  });
}

// Support both /api/exam-periods and /api/exam_periods
registerExamPeriodRoutes('/exam-periods');
registerExamPeriodRoutes('/exam_periods');

// GET /api/:entity - Lấy danh sách entity
router.get('/:entity', requireAuth, injectTeacherFilter, async (request, response, next) => {
  try {
    const payload = await queryEntityList(request.params.entity, request.query);
    if (!payload) {
      response.status(404).json({ ok: false, message: `Unknown entity: ${request.params.entity}` });
      return;
    }

    response.json({
      ok: true,
      ...(payload.entity === 'submissions' ? {
        entity: payload.entity,
        data: payload.data.map(decorateSubmission),
        pagination: payload.pagination
      } : payload)
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/:entity/:id - Lấy chi tiết entity
router.get('/:entity/:id', requireAuth, async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      response.status(400).json({ ok: false, message: 'Invalid id' });
      return;
    }

    const resolvedEntityName = ENTITY_ALIASES[request.params.entity] || request.params.entity;
    const payload = await queryEntityDetail(request.params.entity, id);
    if (payload === null) {
      const entityExists = Boolean(ENTITY_CONFIG[resolvedEntityName]);
      response.status(404).json({
        ok: false,
        message: entityExists ? `Record not found for ${resolvedEntityName}#${id}` : `Unknown entity: ${request.params.entity}`
      });
      return;
    }

    response.json({
      ok: true,
      entity: resolvedEntityName,
      data: resolvedEntityName === 'submissions' ? decorateSubmission(payload) : payload
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
