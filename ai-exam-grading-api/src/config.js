const dotenv = require('dotenv');
const path = require('node:path');

dotenv.config();

const config = {
  host: process.env.APP_HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3010),
  n8nBaseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678/webhook',
  n8nApis: {
    uploadExam: 'upload-exam-api',
    uploadAnswer: 'upload-answer-api'
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5544),
    database: process.env.DB_NAME || 'app',
    user: process.env.DB_USER || 'app',
    password: process.env.DB_PASSWORD || 'app',
    ssl: String(process.env.DB_SSL || 'false').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DB_MAX_POOL_SIZE || 10)
  },
  defaultLimit: Number(process.env.API_DEFAULT_LIMIT || 20),
  maxLimit: Number(process.env.API_MAX_LIMIT || 100),
  paths: {
    schema: path.resolve(__dirname, '..', '..', 'docs', 'ai-exam-grading', 'database-postgres.sql'),
    uploads: path.resolve(__dirname, '..', 'uploads'),
    uiProject: path.resolve(__dirname, '..', 'ui-project')
  }
};

module.exports = config;
