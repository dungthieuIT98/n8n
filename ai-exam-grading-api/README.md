# AI Exam Grading API

Backend service JavaScript su dung `Express` va `PostgreSQL` de phuc vu API `get/search` cho du lieu trong ung dung AI exam grading.

## Cau hinh mac dinh

Mac dinh service duoc cau hinh theo container Docker `setup-app-postgres` trong `n8n/docker-compose.yml`:

- Host: `localhost`
- Port: `5544`
- Database: `app`
- User: `app`
- Password: `app`

Service tu dong bootstrap schema bang cach doc file `../docs/ai-exam-grading/database-postgres.sql` khi khoi dong.

## Cai dat

```powershell
cd c:\.D\data\setup\n8n\ai-exam-grading-api
npm install
```

## Chay service

```powershell
npm start
```

Mac dinh API chay tai `http://localhost:3010`.

Frontend duoc serve cung server nay. Mo web tai:

- `http://localhost:3010/login.html`
- `http://localhost:3010/index.html`

Tai khoan demo mac dinh:

- Email: `teacher01@school.edu.vn`
- Username: `teacher01`
- Mat khau: `Demo123`

## Bien moi truong

Xem file `.env.example`.

## Endpoint chinh

- `GET /health`
- `GET /api`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/admin/reset-demo-data`
- `GET /api/teachers`
- `GET /api/teachers/:id`
- `GET /api/exams`
- `GET /api/exams/:id`
- `POST /api/exams`
- `POST /api/exams/:id/reprocess`
- `GET /api/submissions`
- `GET /api/submissions/:id`
- `POST /api/submissions/:id/regrade`
- `POST /api/submissions/:id/approve`
- `GET /api/system_logs`
- `GET /api/system_logs/:id`
- `GET /api/logs`
- `GET /api/logs/:id`
- `POST /api/logs/:id/retry`
- `GET /api/student-results?student_code=SV2026001&class_code=12A1`
- `GET /api/search?entity=exams&q=math`
- `GET /api/search?entities=exams,submissions&q=nguyen`

## Query params ho tro

- `q`: full text search tren cac cot chinh cua tung entity
- `page`: trang hien tai, mac dinh `1`
- `limit`: so ban ghi moi trang, mac dinh `20`, toi da `100`

Mot so bo loc duoc ho tro tuy entity:

- `teachers`: `status`, `teacher_code`, `email`, `username`
- `exams`: `status`, `teacher_id`, `class_code`, `subject_code`, `exam_type`, `exam_round`
- `submissions`: `status`, `review_status`, `exam_id`, `class_code`, `student_code`, `subject_code`
- `system_logs`: `status`, `log_type`, `ref_table`, `exam_id`, `submission_id`, `student_code`, `class_code`