-- Minimal schema for AI Exam Grading API (PostgreSQL)

CREATE TABLE IF NOT EXISTS teachers (
  id              SERIAL PRIMARY KEY,
  teacher_code    TEXT UNIQUE,
  full_name       TEXT,
  email           TEXT UNIQUE,
  username        TEXT UNIQUE,
  password_hash   TEXT,
  status          TEXT DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Master data: classes / subjects / exam periods

CREATE TABLE IF NOT EXISTS classes (
  id          SERIAL PRIMARY KEY,
  class_code  TEXT UNIQUE NOT NULL,
  class_name  TEXT,
  grade       INT,
  status      TEXT DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id            SERIAL PRIMARY KEY,
  subject_code  TEXT UNIQUE NOT NULL,
  subject_name  TEXT NOT NULL,
  status        TEXT DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_periods (
  id           SERIAL PRIMARY KEY,
  period_code  TEXT UNIQUE NOT NULL,
  period_name  TEXT NOT NULL,
  description  TEXT,
  start_date   DATE,
  end_date     DATE,
  status       TEXT DEFAULT 'active',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exams (
  id                      SERIAL PRIMARY KEY,
  exam_code               TEXT UNIQUE,
  version                 INT DEFAULT 1,
  title                   TEXT,
  description             TEXT,
  class_code              TEXT,
  subject_code            TEXT,
  subject_name            TEXT,
  exam_type               TEXT,
  exam_round              TEXT,
  class_id                INT REFERENCES classes(id) ON DELETE SET NULL,
  subject_id              INT REFERENCES subjects(id) ON DELETE SET NULL,
  exam_period_id          INT REFERENCES exam_periods(id) ON DELETE SET NULL,
  teacher_id              INT REFERENCES teachers(id) ON DELETE SET NULL,
  question_file_path      TEXT,
  answer_file_path        TEXT,
  answer_extract          JSONB,
  answer_extract_file_path TEXT,
  status                  TEXT DEFAULT 'draft',
  created_by              INT,
  updated_by              INT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- In case exams table already existed before these columns were added
ALTER TABLE IF EXISTS exams ADD COLUMN IF NOT EXISTS class_id INT REFERENCES classes(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS exams ADD COLUMN IF NOT EXISTS subject_id INT REFERENCES subjects(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS exams ADD COLUMN IF NOT EXISTS exam_period_id INT REFERENCES exam_periods(id) ON DELETE SET NULL;

  CREATE TABLE IF NOT EXISTS submissions (
    id                  SERIAL PRIMARY KEY,
    exam_id             INT REFERENCES exams(id) ON DELETE CASCADE,
    student_code        TEXT,
    student_name        TEXT,
    class_code          TEXT,
    subject_code        TEXT,
    submission_file_path TEXT,
    submission_extract  JSONB,
    submitted_at        TIMESTAMPTZ DEFAULT NOW(),
    status              TEXT DEFAULT 'uploaded',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS grading_results (
  id               SERIAL PRIMARY KEY,

  -- liên kết chính
  submission_id    INT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,

  -- thông tin lần chấm
  attempt_no       INT DEFAULT 1,
  grading_type     TEXT, -- ai/manual/auto

  -- kết quả
  total_score      NUMERIC,
  max_score        NUMERIC,
  ai_confidence    NUMERIC,
  grading_detail   JSONB,
  general_feedback TEXT,

  -- trạng thái
  status           TEXT DEFAULT 'graded', -- graded / error / pending
  error_message    TEXT,

  -- người chấm
  graded_by        INT,
  graded_by_name   TEXT,
  graded_at        TIMESTAMPTZ DEFAULT NOW(),

  -- review (nếu có)
  reviewed_by      INT,
  reviewed_at      TIMESTAMPTZ,
  review_status    TEXT, -- approved / rejected
  review_notes     TEXT,

  -- publish
  published_at     TIMESTAMPTZ,

  -- audit
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS grading_results_submission_attempt_idx
  ON grading_results(submission_id, attempt_no DESC);

-- Migration (nếu bảng cũ đã tồn tại):
-- ALTER TABLE grading_results RENAME COLUMN grading_attempt TO attempt_no;
-- ALTER TABLE grading_results ALTER COLUMN submission_id SET NOT NULL;
-- ALTER TABLE grading_results ALTER COLUMN status SET DEFAULT 'graded';
-- ALTER TABLE grading_results DROP COLUMN IF EXISTS exam_id;
-- ALTER TABLE grading_results DROP COLUMN IF EXISTS exam_code;
-- ALTER TABLE grading_results DROP COLUMN IF EXISTS exam_title;
-- ALTER TABLE grading_results DROP COLUMN IF EXISTS class_code;
-- ALTER TABLE grading_results DROP COLUMN IF EXISTS subject_code;
-- ALTER TABLE grading_results DROP COLUMN IF EXISTS student_code;
-- ALTER TABLE grading_results DROP COLUMN IF EXISTS student_name;
-- ALTER TABLE grading_results DROP COLUMN IF EXISTS notes;
-- ALTER TABLE grading_results DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE grading_results DROP COLUMN IF EXISTS updated_by;

CREATE TABLE IF NOT EXISTS system_logs (
  id                   SERIAL PRIMARY KEY,
  log_type              TEXT,
  ref_table             TEXT,
  ref_id                INT,
  exam_id               INT REFERENCES exams(id) ON DELETE SET NULL,
  submission_id         INT REFERENCES submissions(id) ON DELETE SET NULL,
  student_code          TEXT,
  student_name          TEXT,
  class_code            TEXT,
  workflow_execution_id TEXT,
  model_name            TEXT,
  status                TEXT,
  message               TEXT,
  request_payload       JSONB,
  response_payload      JSONB,
  error_message         TEXT,
  created_by            INT,
  updated_by            INT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);


