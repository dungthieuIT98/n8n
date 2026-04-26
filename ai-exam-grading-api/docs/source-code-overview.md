# Tổng quan Source Code - AI Exam Grading API

## Kiến trúc tổng thể

```
[Giáo viên / Sinh viên]
        ↓ UI (HTML/JS)
[Express API - Node.js]
        ↓ webhook
[n8n Workflow - AI]
        ↓
[PostgreSQL]
```

---

## Backend (`src/`)

### `config.js`
Đọc biến môi trường (`.env`): cổng server (3010), URL n8n webhook, kết nối PostgreSQL, giới hạn phân trang.

### `database.js`
- Quản lý connection pool PostgreSQL
- Định nghĩa `ENTITY_CONFIG` — cấu hình cho **5 entity**: `teachers`, `exams`, `submissions`, `grading_results`, `system_logs`
- Mỗi entity có: cột SELECT, JOIN, filter columns, search columns
- **`submissions`**: 
  - JOIN LATERAL với `grading_results` để lấy lần chấm mới nhất (`grading_attempt DESC LIMIT 1`)
  - JOIN với `exams` để có `teacher_id` và hỗ trợ teacher filtering
  - Filter columns bao gồm `teacher_id` cho teacher-based filtering
- **`grading_results`**: Entity mới chứa toàn bộ dữ liệu chấm điểm (điểm, `grading_detail` JSONB, feedback, review status, published_at...)
- **`system_logs`**: 
  - JOIN với exams và submissions
  - Filter columns bao gồm `created_by` cho teacher-based filtering
  - SELECT bao gồm `e.teacher_id` để hỗ trợ ownership checking
- Các hàm: `queryEntityList`, `queryEntityDetail`, `buildListQuery`, `buildFilters` → dùng cho API generic

### `upload.js`
Cấu hình `multer` — lưu file upload vào 3 thư mục:
- `uploads/exams/`
- `uploads/answers/`
- `uploads/submissions/`

Tên file = `timestamp-originalname`

### `helpers.js`
- Auth token bằng `crypto.randomUUID()` + in-memory Map (không dùng JWT/DB session)
- `decorateSubmission()` — gắn thêm `questions` từ `grading_detail.questions` (hoặc sinh dữ liệu giả nếu chưa có)
- `requireAuth` middleware — kiểm tra `Authorization: Bearer <token>`

### `index.js`
Entry point:
1. Chạy `bootstrapSchema` — tạo bảng từ file SQL nếu chưa có
2. Chạy `ensureDemoData` — tạo giáo viên + 2 đề thi + 2 bài nộp mẫu nếu DB trống
3. Khởi động Express, mount các route

### Routes

| File | Path | Chức năng |
|---|---|---|
| `auth.js` | `/api/auth/login`, `/me`, `/logout` | Đăng nhập giáo viên (so sánh `password_hash` plaintext) |
| `exams.js` | `/api/exams` | **CRUD đầy đủ + Teacher-filtered**:<br>• POST `/` - Tạo đề thi: INSERT DB → forward file lên n8n webhook `upload-exam-api`<br>• PUT `/:id` - Cập nhật thông tin exam (chỉ của teacher đang đăng nhập)<br>• DELETE `/:id` - Xóa mềm exam (archive)<br>• PATCH `/:id/status` - Đổi trạng thái (draft/ready/active/archived)<br>• POST `/:id/reprocess` - Tăng version và xử lý lại đề thi<br>• GET `/:id/submissions` - Lấy tất cả submissions của exam với latest grading result<br>• GET `/:id/students` - Lấy danh sách unique students đã nộp bài + statistics |
| `submissions.js` | `/api/submissions` | **Upload + Grading + History**:<br>• POST `/` - Nộp bài: forward PDF lên n8n `upload-answer-api` → AI chấm điểm<br>• POST `/:id/regrade` - Chấm lại: INSERT grading_results mới với grading_attempt+1<br>• POST `/:id/approve` - Publish kết quả: UPDATE grading_results SET status='published'<br>• GET `/:id/history` - Lấy toàn bộ lịch sử chấm điểm (all grading attempts) của 1 submission<br>• GET `/by-student?exam_id=X&student_code=Y` - Lấy tất cả submissions + grading history theo student và exam<br>• GET `/student-results` - Tra cứu bài đã publish (cho sinh viên) |
| `logs.js` | `/api/logs/:id/retry` | Retry log lỗi (giả lập) |
| `entities.js` | `/api/:entity`, `/api/:entity/:id`, `/api/search` | **API generic + Auto Teacher Filter**:<br>• GET `/api/:entity` - Danh sách entity với filter/search/phân trang<br>• GET `/api/:entity/:id` - Chi tiết entity theo ID<br>• Middleware `injectTeacherFilter` tự động thêm `teacher_id` filter cho exams/submissions<br>• Tự động filter `created_by` cho system_logs<br>• Tất cả routes yêu cầu `requireAuth` |

### Teacher-Filtered APIs

**Tất cả data chỉ hiển thị của teacher đang đăng nhập** (từ `request.session.teacher.id`):

#### 1. Danh sách submissions theo teacher
```
GET /api/submissions?teacher_id=auto_injected
- Auto-inject teacher_id filter trong entities.js
- JOIN với exams.teacher_id để lọc
```

#### 2. Danh sách students đã nộp bài theo exam
```
GET /api/exams/:id/students
- Verify exam.teacher_id = session.teacher.id
- GROUP BY student_code
- Return: student_code, student_name, submission_count, best_score, published_score
```

#### 3. Lịch sử nộp bài theo student + exam
```
GET /api/submissions/by-student?exam_id=X&student_code=Y
- Verify exam ownership
- LEFT JOIN ALL grading_results (không chỉ latest)
- Return: tất cả submissions + grading attempts
```

#### 4. CRUD exams với status management
```
PUT /api/exams/:id - Update exam info
DELETE /api/exams/:id - Soft delete (archive)
PATCH /api/exams/:id/status - Change status (draft/ready/active/archived)
- Tất cả đều có WHERE teacher_id = session.teacher.id
```

#### 5. System logs của teacher
```
GET /api/system_logs?created_by=auto_injected
- Auto-inject created_by filter trong entities.js
- Chỉ hiển thị logs do teacher tạo
```

#### 6. Lịch sử chấm điểm của submission
```
GET /api/submissions/:id/history
- Verify exam ownership qua JOIN
- Return ALL grading_results ORDER BY grading_attempt DESC
```

---

## UI (`ui-project/`)

Toàn bộ là **vanilla JS**, không framework, dùng `fetch` để gọi API.

### Các file JS core

| File | Tên global | Vai trò |
|---|---|---|
| `app-state.js` | `window.AppState` | Quản lý session: lưu token + teacher vào `localStorage`, redirect nếu chưa đăng nhập |
| `api.js` | `window.AppApi` | Wrapper `fetch`: tự gắn `Authorization` header, expose các hàm `list`, `detail`, `createExam`, `submitExamSubmission`... |
| `common.js` | `window.AppUI` | Các helper render: `renderStatus`, `renderQuestionList`, `renderSubmissionDetail`, danh sách options cho select box |
| `layout.js` | `window.AppLayout` | Render header/nav, xử lý modal, logout |
| `mock-data.js` | `window.MockData` | Dữ liệu giả dùng khi develop offline |

### Các trang

| Trang | Dành cho | Chức năng |
|---|---|---|
| `login.html` | Giáo viên | Đăng nhập |
| `index.html` | Giáo viên | Dashboard: tổng quan số đề thi, bài nộp, kết quả đã publish, log lỗi |
| `upload.html` | Giáo viên | Upload đề thi + đáp án (PDF/txt) → gửi lên n8n |
| `exams.html` | Giáo viên | Danh sách đề thi, filter, xem chi tiết + bài nộp theo đề, reprocess |
| `results.html` | Giáo viên | Danh sách bài nộp, filter, xem chi tiết điểm từng câu, regrade, approve/publish |
| `logs.html` | Giáo viên | Xem system log của workflow, retry log lỗi |
| `submission.html` | Sinh viên | Nộp bài PDF — chọn đề thi, điền thông tin, upload |
| `student.html` | Sinh viên | Tra cứu kết quả bằng mã sinh viên / họ tên / lớp |

---

## Luồng chính

### 1. Giáo viên tạo đề thi
```
Upload đề + đáp án (PDF)
  → API INSERT exams (status=processing)
  → Forward file sang n8n webhook "upload-exam-api"
  → n8n dùng AI extract câu hỏi + rubric
  → UPDATE exams SET answer_extract=..., status='ready'
```

### 2. Sinh viên nộp bài
```
Upload bài làm (PDF)
  → API INSERT submissions (status='uploaded')
  → Forward file sang n8n webhook "upload-answer-api"
  → n8n OCR bài làm → AI chấm từng câu
  → INSERT grading_results (grading_detail JSONB = chi tiết điểm từng câu)
  → UPDATE submissions SET status='extracted'
```

### 3. Giáo viên duyệt kết quả
```
Xem bài trong results.html
  → API JOIN submissions + grading_results (lấy lần chấm mới nhất)
  → Regrade nếu cần: INSERT grading_results với grading_attempt mới
  → Approve: UPDATE grading_results SET review_status='approved', published_at=NOW(), status='published'
```

### 4. Sinh viên tra cứu
```
Nhập mã SV / họ tên / lớp trên student.html
  → GET /api/student-results
  → Chỉ trả về bài có status='published'
  → Hiển thị điểm + chi tiết từng câu (từ grading_detail)
```

---

## Ghi chú kỹ thuật

- **Auth**: Token random UUID lưu in-memory Map — mất khi restart server
- **Password**: So sánh plaintext, chưa hash (chỉ dùng cho demo)
- **n8n webhook**: Gọi bằng Node.js `http`/`https` native, không dùng axios
- **grading_detail**: JSONB trong bảng `grading_results`, chứa mảng `questions` với điểm chi tiết từng câu
- **LATERAL JOIN**: `submissions` JOIN `grading_results` lấy lần chấm mới nhất (`ORDER BY grading_attempt DESC LIMIT 1`)

---

## Changelog

### 2026-04-25: Teacher-Filtered APIs Implementation

**Files Modified:**
1. **src/routes/exams.js**
   - ✅ Added `PUT /:id` - Update exam details (teacher ownership check)
   - ✅ Added `DELETE /:id` - Soft delete exam (set status='archived')
   - ✅ Added `PATCH /:id/status` - Change exam status (draft/ready/active/archived)
   - ✅ Added `GET /:id/submissions` - Get all submissions for an exam with latest grading result
   - ✅ Added `GET /:id/students` - Get unique list of students who submitted, with statistics
   - ✅ Imported `decorateSubmission` from helpers

2. **src/routes/submissions.js**
   - ✅ Added `GET /:id/history` - Get complete grading history (all attempts) for a submission
   - ✅ Added `GET /by-student?exam_id=X&student_code=Y` - Get all submissions + grading history by student and exam
   - Both endpoints verify exam ownership through JOIN with exams table

3. **src/database.js**
   - ✅ Updated `submissions` entity config:
     - Added `teacher_id` to filterColumns
     - Added `e.teacher_id` to SELECT list
   - ✅ Updated `system_logs` entity config:
     - Added `created_by` to filterColumns
     - Added `l.created_by` to SELECT list
     - Added `e.teacher_id` to SELECT list (from exam JOIN)

4. **src/routes/entities.js**
   - ✅ Added `requireAuth` middleware to all entity routes
   - ✅ Implemented `injectTeacherFilter` middleware:
     - Auto-injects `teacher_id` filter for entities that support it (exams, submissions)
     - Auto-injects `created_by` filter for system_logs
   - ✅ Applied middleware to GET `/:entity` route

**Security Improvements:**
- All new APIs require authentication via `requireAuth` middleware
- Teacher can only access data they own through:
  - WHERE teacher_id = session.teacher.id (for exams)
  - JOIN with exams table for ownership verification (for submissions)
  - Auto-injected filters in generic entity routes

**New API Endpoints Summary:**
- 5 new exam management endpoints (CRUD + students list)
- 2 new submission history endpoints
- Auto-filtering for all entity list APIs based on logged-in teacher
- Complete grading history tracking with `grading_attempt` support

**Status:** ✅ All changes completed, no compilation errors
