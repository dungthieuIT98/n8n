const fs = require('node:fs/promises');
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

const ENTITY_CONFIG = {
  teachers: {
    table: 'teachers',
    alias: 't',
    orderBy: 't.created_at DESC, t.id DESC',
    searchColumns: ['t.teacher_code', 't.full_name', 't.email', 't.username'],
    filterColumns: ['status', 'teacher_code', 'email', 'username'],
    select: [
      't.id', 't.teacher_code', 't.full_name', 't.email', 't.username',
      't.status', 't.created_at', 't.updated_at'
    ]
  },
  exams: {
    table: 'exams',
    alias: 'e',
    orderBy: 'e.created_at DESC, e.id DESC',
    searchColumns: ['e.exam_code', 'e.title', 'e.description', 'e.class_code', 'e.subject_code', 'e.subject_name'],
    filterColumns: ['status', 'teacher_id', 'class_code', 'subject_code', 'exam_type', 'exam_round'],
    select: [
      'e.id', 'e.exam_code', 'e.version', 'e.title', 'e.description',
      'e.class_code', 'e.subject_code', 'e.subject_name', 'e.exam_type', 'e.exam_round',
      'e.teacher_id', 't.full_name AS teacher_name', 'e.question_file_path',
      'e.answer_file_path', 'e.answer_extract_file_path', 'e.status',
      'e.created_at', 'e.updated_at'
    ],
    joins: ['LEFT JOIN teachers t ON t.id = e.teacher_id']
  },
  submissions: {
    table: 'submissions',
    alias: 's',
    orderBy: 's.submitted_at DESC, s.id DESC',
    searchColumns: ['s.student_code', 's.student_name', 's.class_code', 's.subject_code', 'e.exam_code', 'e.title'],
    filterColumns: ['status', 'review_status', 'exam_id', 'class_code', 'student_code', 'student_name', 'subject_code'],
    select: [
      's.id', 's.exam_id', 'e.exam_code', 'e.title AS exam_title', 'e.subject_name', 'e.exam_type',
      's.student_code', 's.student_name', 's.class_code', 's.subject_code',
      's.submission_file_path', 's.submission_extract_file_path', 's.grading_result_file_path',
      's.total_score', 's.max_score', 's.ai_confidence', 's.submitted_at', 's.graded_at',
      's.status', 's.review_status', 's.notes', 's.published_at',
      's.reviewed_by', 's.reviewed_at', 's.created_at', 's.updated_at'
    ],
    joins: ['LEFT JOIN exams e ON e.id = s.exam_id']
  },
  system_logs: {
    table: 'system_logs',
    alias: 'l',
    orderBy: 'l.created_at DESC, l.id DESC',
    searchColumns: ['l.student_code', 'l.student_name', 'l.class_code', 'l.workflow_execution_id', 'l.model_name', 'l.message', 'l.error_message'],
    filterColumns: ['status', 'log_type', 'ref_table', 'exam_id', 'submission_id', 'student_code', 'class_code'],
    select: [
      'l.id', 'l.log_type', 'l.ref_table', 'l.ref_id', 'l.exam_id', 'e.exam_code',
      'l.submission_id', 's.student_name AS submission_student_name', 'l.student_code',
      'l.student_name', 'l.class_code', 'l.workflow_execution_id', 'l.model_name',
      'l.status', 'l.message', 'l.request_payload', 'l.response_payload',
      'l.error_message', 'l.created_at', 'l.updated_at'
    ],
    joins: [
      'LEFT JOIN exams e ON e.id = l.exam_id',
      'LEFT JOIN submissions s ON s.id = l.submission_id'
    ]
  }
};

const ENTITY_ALIASES = {
  logs: 'system_logs'
};

async function bootstrapSchema() {
  const sql = await fs.readFile(config.paths.schema, 'utf8');
  await pool.query(sql);
}

async function query(text, params) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

function buildFilters(entity, queryParams, startingIndex = 1) {
  const where = [];
  const values = [];
  let parameterIndex = startingIndex;

  if (queryParams.q) {
    const searchValue = `%${String(queryParams.q).trim()}%`;
    const clauses = entity.searchColumns.map((column) => `${column} ILIKE $${parameterIndex}`);
    values.push(searchValue);
    where.push(`(${clauses.join(' OR ')})`);
    parameterIndex += 1;
  }

  for (const filterName of entity.filterColumns) {
    const filterValue = queryParams[filterName];
    if (filterValue === undefined || filterValue === null || filterValue === '') {
      continue;
    }

    const columnName = `${entity.alias}.${filterName}`;
    where.push(`${columnName} = $${parameterIndex}`);
    values.push(filterValue);
    parameterIndex += 1;
  }

  return { where, values, parameterIndex };
}

function buildListQuery(entity, queryParams) {
  const rawLimit = Number(queryParams.limit || config.defaultLimit);
  const rawPage = Number(queryParams.page || 1);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, config.maxLimit) : config.defaultLimit;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const offset = (page - 1) * limit;

  const { where, values, parameterIndex } = buildFilters(entity, queryParams);
  const fromClause = [`FROM ${entity.table} ${entity.alias}`].concat(entity.joins || []).join(' ');
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const selectClause = entity.select.join(',\n      ');
  const listQuery = `
    SELECT
      ${selectClause}
    ${fromClause}
    ${whereClause}
    ORDER BY ${entity.orderBy}
    LIMIT $${parameterIndex}
    OFFSET $${parameterIndex + 1}
  `;
  const countQuery = `
    SELECT COUNT(*)::int AS total
    ${fromClause}
    ${whereClause}
  `;
  const listValues = values.concat([limit, offset]);

  return {
    limit,
    page,
    offset,
    listQuery,
    countQuery,
    values,
    listValues
  };
}

function buildDetailQuery(entity, id) {
  const fromClause = [`FROM ${entity.table} ${entity.alias}`].concat(entity.joins || []).join(' ');
  const selectClause = entity.select.join(',\n      ');

  return {
    text: `
      SELECT
        ${selectClause}
      ${fromClause}
      WHERE ${entity.alias}.id = $1
      LIMIT 1
    `,
    values: [id]
  };
}

async function queryEntityList(entityName, queryParams) {
  const resolvedEntityName = ENTITY_ALIASES[entityName] || entityName;
  const entity = ENTITY_CONFIG[resolvedEntityName];
  if (!entity) {
    return null;
  }

  const { listQuery, countQuery, values, listValues, limit, page } = buildListQuery(entity, queryParams);
  const [rowsResult, countResult] = await Promise.all([
    pool.query(listQuery, listValues),
    pool.query(countQuery, values)
  ]);
  const total = countResult.rows[0]?.total || 0;

  return {
    entity: resolvedEntityName,
    data: rowsResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit)
    }
  };
}

async function queryEntityDetail(entityName, id) {
  const resolvedEntityName = ENTITY_ALIASES[entityName] || entityName;
  const entity = ENTITY_CONFIG[resolvedEntityName];
  if (!entity) {
    return null;
  }

  const detailQuery = buildDetailQuery(entity, id);
  const result = await pool.query(detailQuery.text, detailQuery.values);

  return result.rows[0] || null;
}

module.exports = {
  pool,
  query,
  getClient,
  bootstrapSchema,
  queryEntityList,
  queryEntityDetail,
  ENTITY_CONFIG,
  ENTITY_ALIASES
};
