# Auto Grade Submissions Workflow

## Mục đích
Workflow tự động chấm điểm các bài nộp (submissions) chưa được chấm mỗi 1 giờ.

## Trigger
- **Type**: Schedule Trigger (Cron)
- **Interval**: Mỗi 1 giờ
- **Cron Expression**: `0 * * * *` (chạy vào phút 0 của mỗi giờ)

## Luồng xử lý

### 1. Schedule Trigger
- Kích hoạt workflow mỗi 1 giờ
- Node: `Schedule Trigger`

### 2. Get Ungraded Submissions
- Lấy danh sách submissions chưa được chấm điểm
- Điều kiện: `status = 'submitted'` hoặc `graded_at IS NULL` hoặc `score IS NULL`
- JOIN với bảng `exams` để lấy thông tin đề thi
- Node: `Get Ungraded Submissions` (Postgres)
- SQL:
```sql
SELECT 
  s.id AS submission_id,
  s.exam_id,
  s.student_id,
  s.submission_extract_file_path,
  s.status AS submission_status,
  e.exam_code,
  e.title AS exam_title,
  e.answer_extract_file_path,
  e.class_code
FROM submissions s
INNER JOIN exams e ON s.exam_id = e.id
WHERE 
  (s.status = 'submitted' OR s.graded_at IS NULL)
  AND s.submission_extract_file_path IS NOT NULL
  AND e.answer_extract_file_path IS NOT NULL
ORDER BY s.created_at ASC
LIMIT 10;
```

### 3. Check if any submissions
- Kiểm tra xem có submission nào không
- Nếu không có → dừng workflow
- Node: `Check if any submissions` (IF node)

### 4. Loop Through Submissions
- Duyệt qua từng submission
- Node: `Loop Submissions` (Loop Over Items)

### 5. Extract Answer Key & Student Answer
- Lấy answer key từ `answer_extract_file_path` (JSON từ exam)
- Lấy student answer từ `submission_extract_file_path` (JSON từ submission)
- Node: `Extract Answer Key & Student Answer` (Code)

### 6. Call GPT to Grade
- Gọi GPT-4 để chấm điểm
- Input:
  - Answer key (expected answers + rubrics)
  - Student answers
- Output: JSON với điểm số và feedback cho từng câu
- Node: `GPT Grade Submission` (OpenAI)
- Model: GPT-4.1-mini

### 7. Calculate Total Score
- Tính tổng điểm từ kết quả chấm
- Chuẩn hóa JSON kết quả chấm
- Node: `Calculate Total Score` (Code)

### 8. Update Submission Score
- Cập nhật điểm số vào bảng `grading_results`
- INSERT INTO `grading_results`:
  - `submission_id`, `exam_id`
  - `student_code`, `student_name`
  - `exam_code`, `exam_title`, `class_code`, `subject_code`
  - `total_score`, `max_score`
  - `grading_detail` (jsonb - chi tiết điểm từng câu)
  - `grading_attempt` (tự động increment)
  - `graded_by` = 0 (system)
  - `graded_by_name` = 'System (AI)'
  - `status` = 'completed'
- Node: `Insert Grading Result` (Postgres)

### 9. Log Grading Result
- Ghi log vào `system_logs`
- Node: `Log Grading Result` (Postgres)

## Schema Database

### Table: submissions
**Chỉ chứa thông tin bài nộp của học sinh, KHÔNG chứa điểm số**

```sql
CREATE TABLE IF NOT EXISTS submissions (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES exams(id),
  student_code VARCHAR(50) NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  class_code VARCHAR(50),
  subject_code VARCHAR(50),
  submission_file_path TEXT,  -- File gốc
  submission_extract TEXT,  -- JSON extracted từ OCR
  submitted_at TIMESTAMP,
  status VARCHAR(30) DEFAULT 'uploaded',  -- 'uploaded', 'extracting', 'extracted', 'failed'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**LƯU Ý:** 
- Bảng submissions KHÔNG lưu điểm số (total_score, max_score, percentage)
- KHÔNG lưu thông tin chấm điểm (graded_at, graded_by, review_status)
- Tất cả thông tin chấm điểm nằm trong bảng `grading_results`

### Table: grading_results
**Lưu lịch sử chấm điểm, cho phép chấm lại nhiều lần**

```sql
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
  updated_by BIGINT REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE SET NULL,)
```
  

## Grading Prompt cho GPT

Prompt sẽ nhận:
- **Answer Key** (từ exam.answer_extract_file_path):
```json
{
  "questions": [
    {
      "question_no": "1",
      "expected_answer": "...",
      "rubrics": [{"key": "...", "score": 0.5}],
      "max_score": 2
    }
  ],
  "total_max_score": 10
}
```

- **Student Answer** (từ submission.submission_extract_file_path):
```json
{
  "questions": [
    {
      "question_no": "1",
      "student_answer": "..."
    }
  ]
}
```

Output mong muốn:
```json
{
  "graded_questions": [
    {
      "question_no": "1",
      "max_score": 2,
      "earned_score": 1.5,
      "feedback": "Đúng 3/4 ý chính",
      "rubric_scores": [
        {"key": "Ý 1", "score": 0.5, "earned": 0.5},
        {"key": "Ý 2", "score": 0.5, "earned": 0.5},
        {"key": "Ý 3", "score": 0.5, "earned": 0.5},
        {"key": "Ý 4", "score": 0.5, "earned": 0}
      ]
    }
  ],
  "total_score": 8.5,
  "total_max_score": 10
}
```

## Error Handling

- Nếu submission không có `submission_extract_file_path` → bỏ qua
- Nếu exam không có `answer_extract_file_path` → bỏ qua
- Nếu GPT API fail → log error và tiếp tục submission tiếp theo
- Nếu update database fail → log error

## Notes

- Workflow chạy batch 10 submissions mỗi lần để tránh overload
- Có thể điều chỉnh LIMIT trong query nếu cần
- Schedule có thể thay đổi tùy nhu cầu (mỗi 30 phút, mỗi 2 giờ, etc.)
