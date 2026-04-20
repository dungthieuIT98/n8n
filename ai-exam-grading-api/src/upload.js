const fs = require('node:fs/promises');
const path = require('node:path');
const multer = require('multer');

const config = require('./config');

const uploadStorage = multer.diskStorage({
  destination: async (_request, file, callback) => {
    try {
      const folderName = file.fieldname === 'answer_file'
        ? 'answers'
        : file.fieldname === 'submission_file'
          ? 'submissions'
          : 'exams';
      const targetDir = path.join(config.paths.uploads, folderName);
      await fs.mkdir(targetDir, { recursive: true });
      callback(null, targetDir);
    } catch (error) {
      callback(error);
    }
  },
  filename: (_request, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
    callback(null, `${Date.now()}-${safeName}`);
  }
});

module.exports = multer({ storage: uploadStorage });