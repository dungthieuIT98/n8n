const express = require('express');
const { queryEntityList, queryEntityDetail, ENTITY_ALIASES, ENTITY_CONFIG } = require('../database');
const { decorateSubmission } = require('../helpers');

const router = express.Router();

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

// GET /api/:entity - Lấy danh sách entity
router.get('/:entity', async (request, response, next) => {
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
router.get('/:entity/:id', async (request, response, next) => {
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
