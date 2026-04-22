-- ===============================================
-- GRADING RESULTS TABLE (Lịch sử chấm điểm)
-- ===============================================

-- Bảng này lưu lịch sử chấm điểm, mỗi lần chấm tạo 1 record mới
-- Cho phép chấm lại nhiều lần cho cùng 1 submission
--
-- LƯU Ý: Bảng submissions CHỈ lưu thông tin bài nộp của học sinh,
-- KHÔNG lưu điểm số. Tất cả thông tin chấm điểm nằm trong bảng này.

CREATE TABLE IF NOT EXISTS grading_results (
  id BIGSERIAL PRIMARY KEY,
  
  -- Foreign keys
  submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  
  -- Thông tin exam (denormalized để query nhanh)
  exam_code VARCHAR(100),
  exam_title VARCHAR(255),
  class_code VARCHAR(50),
  subject_code VARCHAR(50),
  
  -- Thông tin student (denormalized)
  student_code VARCHAR(50) NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  
  -- Thông tin chấm điểm
  grading_attempt INTEGER NOT NULL DEFAULT 1,  -- Lần chấm thứ mấy
  grading_type VARCHAR(30) DEFAULT 'auto',  -- 'auto' (AI), 'manual' (teacher), 're-grade'
  
  -- Kết quả chấm
  total_score NUMERIC(5,2) NOT NULL,  -- Tổng điểm đạt được
  max_score NUMERIC(5,2),  -- Tổng điểm tối đa
  ai_confidence NUMERIC(5,2),  -- Độ tin cậy của AI (0-100)
  
  -- Chi tiết chấm từng câu (JSON)
  grading_detail JSONB NOT NULL,
  
  -- Nhận xét chung
  general_feedback TEXT,
  notes TEXT,
  
  -- Thông tin người chấm
  graded_by BIGINT DEFAULT 0,  -- 0 = system (AI), >0 = teacher_id
  graded_by_name VARCHAR(255),
  graded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Review information (giáo viên review lại)
  reviewed_by BIGINT REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_status VARCHAR(30) DEFAULT 'pending',  -- 'pending', 'approved', 'recheck', 'rejected'
  review_notes TEXT,
  
  -- Status
  status VARCHAR(30) DEFAULT 'completed',  -- 'completed', 'error', 'pending', 'published'
  error_message TEXT,
  
  -- Published
  published_at TIMESTAMP,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by BIGINT REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_by BIGINT REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT grading_results_total_score_check CHECK (total_score >= 0),
  CONSTRAINT grading_results_grading_attempt_check CHECK (grading_attempt > 0),
  CONSTRAINT grading_results_percentage_check CHECK (percentage >= 0 AND percentage <= 100),
  CONSTRAINT grading_results_max_score_check CHECK (max_score IS NULL OR max_score > 0),
  CONSTRAINT grading_results_ai_confidence_check CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 100)),
  CONSTRAINT grading_results_grading_type_check CHECK (grading_type IN ('auto', 'manual', 're-grade', 'teacher')),
  CONSTRAINT grading_results_review_status_check CHECK (review_status IN ('pending', 'approved', 'recheck', 'rejected')),
  CONSTRAINT grading_results_status_check CHECK (status IN ('pending', 'completed', 'error', 'published'))
);
-- ===============================================
-- INDEXES
-- ===============================================

CREATE INDEX IF NOT EXISTS idx_grading_results_submission_id 
ON grading_results(submission_id);

CREATE INDEX IF NOT EXISTS idx_grading_results_exam_id 
ON grading_results(exam_id);

CREATE INDEX IF NOT EXISTS idx_grading_results_student_code 
ON grading_results(student_code);

CREATE INDEX IF NOT EXISTS idx_grading_results_class_code 
ON grading_results(class_code);

CREATE INDEX IF NOT EXISTS idx_grading_results_graded_at 
ON grading_results(graded_at DESC);

CREATE INDEX IF NOT EXISTS idx_grading_results_grading_type 
ON grading_results(grading_type);

CREATE INDEX IF NOT EXISTS idx_grading_results_status 
ON grading_results(status);

CREATE INDEX IF NOT EXISTS idx_grading_results_review_status 
ON grading_results(review_status);

CREATE INDEX IF NOT EXISTS idx_grading_results_published_at 
ON grading_results(published_at);

-- Index phức hợp để query lần chấm mới nhất
CREATE INDEX IF NOT EXISTS idx_grading_results_submission_attempt 
ON grading_results(submission_id, grading_attempt DESC);

-- ===============================================
-- FUNCTION: Auto increment grading_attempt
-- ===============================================

CREATE OR REPLACE FUNCTION set_grading_attempt()
RETURNS TRIGGER AS $$
BEGIN
  -- Tự động set grading_attempt = max + 1 cho submission này
  SELECT COALESCE(MAX(grading_attempt), 0) + 1
  INTO NEW.grading_attempt
  FROM grading_results
  WHERE submission_id = NEW.submission_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger để auto set grading_attempt
DROP TRIGGER IF EXISTS trigger_set_grading_attempt ON grading_results;
CREATE TRIGGER trigger_set_grading_attempt
BEFORE INSERT ON grading_results
FOR EACH ROW
EXECUTE FUNCTION set_grading_attempt();

-- ===============================================
-- FUNCTION: Auto calculate percentage
-- ===============================================

CREATE OR REPLACE FUNCTION calculate_percentage()
RETURNS TRIGGER AS $$
BEGIN
  -- Tự động tính percentage từ total_score và max_score
  IF NEW.max_score IS NOT NULL AND NEW.max_score > 0 THEN
    NEW.percentage := ROUND((NEW.total_score / NEW.max_score * 100)::numeric, 2);
  ELSE
    NEW.percentage := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger để auto calculate percentage
DROP TRIGGER IF EXISTS trigger_calculate_percentage ON grading_results;
CREATE TRIGGER trigger_calculate_percentage
BEFORE INSERT OR UPDATE ON grading_results
FOR EACH ROW
EXECUTE FUNCTION calculate_percentage();

-- ===============================================
-- VIEW: Latest Grading Results
-- ===============================================

-- View để lấy kết quả chấm mới nhất của mỗi submission
CREATE OR REPLACE VIEW latest_grading_results AS
SELECT DISTINCT ON (gr.submission_id)
  gr.id,
  gr.submission_id,
  gr.exam_id,
  gr.exam_code,
  gr.exam_title,
  gr.class_code,
  gr.subject_code,
  gr.student_code,
  gr.student_name,
  gr.grading_attempt,
  gr.grading_type,
  gr.total_score,
  gr.max_score,
  gr.percentage,
  gr.ai_confidence,
  gr.grading_detail,
  gr.grading_result_file_path,
  gr.general_feedback,
  gr.notes,
  gr.graded_by,
  gr.graded_by_name,
  gr.graded_at,
  gr.reviewed_by,
  gr.reviewed_at,
  gr.review_status,
  gr.review_notes,
  gr.status,
  gr.published_at
FROM grading_results gr
ORDER BY gr.submission_id, gr.grading_attempt DESC, gr.graded_at DESC;

-- ===============================================
-- SAMPLE DATA FORMAT
-- ===============================================

-- Format của grading_detail (JSON):
/*
{
  "graded_questions": [
    {
      "question_no": "1",
      "max_score": 2,
      "earned_score": 1.5,
      "feedback": "Đúng 3/4 ý chính. Thiếu ý về...",
      "rubric_scores": [
        {"key": "Ý 1", "score": 0.5, "earned": 0.5, "comment": "Đúng"},
        {"key": "Ý 2", "score": 0.5, "earned": 0.5, "comment": "Đúng"},
        {"key": "Ý 3", "score": 0.5, "earned": 0.5, "comment": "Đúng"},
        {"key": "Ý 4", "score": 0.5, "earned": 0, "comment": "Thiếu"}
      ]
    }
  ],
  "total_score": 8.5,
  "total_max_score": 10,
  "graded_at": "2026-04-21T10:30:00Z"
}
*/

-- ===============================================
-- SAMPLE QUERIES
-- ===============================================

-- Insert mẫu 1 kết quả chấm
INSERT INTO grading_results (
  submission_id,
  exam_id,
  exam_code,
  exam_title,
  class_code,
  subject_code,
  student_code,
  student_name,
  grading_type,
  total_score,
  max_score,
  ai_confidence,
  grading_detail,
  general_feedback,
  graded_by,
  graded_by_name,
  status
) VALUES (
  1,  -- submission_id
  1,  -- exam_id
  'EXAM001',
  'Đề thi Toán học',
  'CNTT-K17',
  'TOAN101',
  'SV001',
  'Nguyen Van A',
  'auto',
  8.5,
  10,
  95.0,
  '{"graded_questions": [{"question_no": "1", "max_score": 2, "earned_score": 1.5}], "total_score": 8.5}'::jsonb,
  'Bài làm tốt, cần chú ý thêm về...',
  0,
  'System (AI)',
  'completed'
);

-- Lấy kết quả chấm mới nhất của 1 submission
SELECT * FROM latest_grading_results
WHERE submission_id = 1;

-- Lấy tất cả lịch sử chấm của 1 submission
SELECT 
  id,
  grading_attempt,
  total_score,
  max_score,
  percentage,
  grading_type,
  graded_by_name,
  graded_at,
  review_status,
  status
FROM grading_results
WHERE submission_id = 1
ORDER BY grading_attempt DESC;

-- Lấy kết quả chấm của 1 exam
SELECT 
  gr.student_code,
  gr.student_name,
  gr.total_score,
  gr.max_score,
  gr.percentage,
  gr.grading_attempt,
  gr.graded_at,
  gr.review_status
FROM latest_grading_results gr
WHERE gr.exam_id = 1
ORDER BY gr.student_code;

-- Thống kê điểm theo exam
SELECT 
  exam_code,
  exam_title,
  class_code,
  COUNT(*) as total_graded,
  ROUND(AVG(total_score)::numeric, 2) as avg_score,
  MAX(total_score) as max_score_achieved,
  MIN(total_score) as min_score_achieved,
  ROUND(AVG(percentage)::numeric, 2) as avg_percentage
FROM latest_grading_results
WHERE exam_id = 1
GROUP BY exam_code, exam_title, class_code;

-- Đếm số lần chấm lại
SELECT 
  submission_id,
  student_code,
  student_name,
  COUNT(*) as total_attempts,
  MAX(grading_attempt) as latest_attempt
FROM grading_results
GROUP BY submission_id, student_code, student_name
HAVING COUNT(*) > 1
ORDER BY total_attempts DESC;

-- Lấy submissions chưa được chấm lần nào
SELECT 
  s.id as submission_id,
  s.student_code,
  s.student_name,
  e.exam_code,
  e.title as exam_title
FROM submissions s
JOIN exams e ON s.exam_id = e.id
LEFT JOIN grading_results gr ON s.id = gr.submission_id
WHERE gr.id IS NULL
  AND s.submission_extract_file_path IS NOT NULL
  AND e.answer_extract_file_path IS NOT NULL
ORDER BY s.created_at;

-- So sánh điểm giữa các lần chấm
SELECT 
  gr1.submission_id,
  gr1.student_code,
  gr1.student_name,
  gr1.grading_attempt as attempt,
  gr1.total_score as score,
  gr1.grading_type,
  gr1.graded_by_name,
  gr1.graded_at,
  LAG(gr1.total_score) OVER (PARTITION BY gr1.submission_id ORDER BY gr1.grading_attempt) as previous_score,
  gr1.total_score - LAG(gr1.total_score) OVER (PARTITION BY gr1.submission_id ORDER BY gr1.grading_attempt) as score_diff
FROM grading_results gr1
WHERE gr1.submission_id = 1
ORDER BY gr1.grading_attempt;

-- ===============================================
-- LƯU Ý VỀ SUBMISSIONS TABLE
-- ===============================================

-- Bảng submissions CHỈ chứa thông tin bài nộp của học sinh:
-- - id, exam_id
-- - student_code, student_name
-- - submission_file_path (file gốc)
-- - submission_extract_file_path (JSON extracted)
-- - status ('uploaded', 'extracting', 'extracted', 'failed')
-- - created_at, updated_at
--
-- KHÔNG chứa bất kỳ thông tin chấm điểm nào:
-- - Không có total_score, max_score, percentage
-- - Không có graded_at, graded_by
-- - Không có review_status, reviewed_by
-- - Không có published_at
--
-- Tất cả thông tin chấm điểm nằm trong bảng grading_results.
