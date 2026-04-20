# 04. Database Design

## 1. Muc tieu thiet ke
Co so du lieu can tap trung vao cac thuc the nghiep vu chinh: giao vien, de thi, bai nop, va log he thong. Thay vi tach nhieu bang trung gian cho file, extract, va ket qua cham, he thong luu truc tiep cac file va metadata xu ly ngay tren bang `exams` va `submissions`. Cac thong tin `class`, `subject`, va sinh vien duoc luu truc tiep tren ban ghi nghiep vu. Thiet ke uu tien don gian, de truy vet, va phu hop voi workflow `n8n` da co san.

## 2. Cac bang chinh

### 2.1 teachers
Luu thong tin giao vien dang nhap he thong.

| Truong | Kieu goi y | Mo ta |
| --- | --- | --- |
| id | uuid | Khoa chinh |
| teacher_code | varchar(50) | Ma giao vien |
| full_name | varchar(255) | Ho ten |
| email | varchar(255) | Email dang nhap |
| password_hash | text | Mat khau ma hoa |
| status | varchar(30) | active, locked, inactive |
| created_at | timestamp | Ngay tao |
| updated_at | timestamp | Ngay cap nhat |

### 2.2 exams
Luu thong tin de thi do giao vien tao, bao gom file de thi, file dap an mau, va file extract dap an.

| Truong | Kieu goi y | Mo ta |
| --- | --- | --- |
| id | uuid | Khoa chinh |
| exam_code | varchar(50) | Ma de thi |
| version | integer | Phien ban hien tai cua de thi, mac dinh 1 |
| title | varchar(255) | Ten de thi |
| description | text | Mo ta |
| class_code | varchar(50) | Ma lop ap dung |
| subject_code | varchar(50) | Ma mon hoc |
| subject_name | varchar(255) | Ten mon hoc |
| exam_type | varchar(50) | giua_ky, cuoi_ky, quiz, practice |
| exam_round | varchar(50) | Dot thi |
| teacher_id | uuid | FK den teachers |
| question_file_path | text | Duong dan file de thi |
| answer_file_path | text | Duong dan file dap an mau |
| answer_extract_file_path | jsonb | JSON extract dap an da chuan hoa |
| status | varchar(30) | draft, processing, ready, archived |
| created_at | timestamp | Ngay tao |
| updated_at | timestamp | Ngay cap nhat |

`version` duoc tang len moi khi giao vien cap nhat file de thi hoac file dap an. He thong khong can co nut kich hoat cham diem rieng, vi workflow cham diem duoc tu dong chay sau khi bai nop duoc extract thanh cong.

### 2.3 submissions
Luu bai nop cua sinh vien, file extract, va ket qua cham tong hop ngay tren cung 1 ban ghi.

| Truong | Kieu goi y | Mo ta |
| --- | --- | --- |
| id | uuid | Khoa chinh |
| exam_id | uuid | FK den exams |
| student_code | varchar(50) | Ma sinh vien dung de tra cuu |
| student_name | varchar(255) | Ho ten sinh vien |
| class_code | varchar(50) | Ma lop cua sinh vien |
| subject_code | varchar(50) | Ma mon hoc cua bai nop |
| submission_file_path | text | Duong dan file bai nop goc |
| submission_extract_file_path | text | Duong dan file JSON extract bai lam |
| grading_result_file_path | text | Duong dan file JSON ket qua cham tong hop, bao gom chi tiet tung cau |
| total_score | numeric(5,2) | Diem tong sau khi cham |
| max_score | numeric(5,2) | Diem toi da |
| ai_confidence | numeric(5,2) | Do tin cay lan cham |
| submitted_at | timestamp | Thoi gian nop |
| source_type | varchar(30) | web, mobile, import |
| status | varchar(30) | uploaded, extracting, extracted, grading, graded, published, failed |
| published_at | timestamp | Thoi diem cong bo ket qua |
| reviewed_by | uuid | FK den teachers, neu co kiem duyet |
| reviewed_at | timestamp | Thoi diem kiem duyet |
| notes | text | Ghi chu |

### 2.4 system_logs
Luu log workflow AI, xu ly file va tien trinh `n8n` trong 1 bang trung tam.

| Truong | Kieu goi y | Mo ta |
| --- | --- | --- |
| id | uuid | Khoa chinh |
| log_type | varchar(50) | exam_extract, submission_extract, grading, publish, retry |
| ref_table | varchar(50) | exams, submissions |
| ref_id | uuid | Khoa tham chieu du lieu |
| exam_id | uuid | FK den exams, neu co |
| submission_id | uuid | FK den submissions, neu co |
| student_code | varchar(50) | Ma sinh vien, neu co |
| student_name | varchar(255) | Ho ten sinh vien, neu co |
| class_code | varchar(50) | Ma lop, neu co |
| workflow_execution_id | varchar(100) | ID tu n8n |
| model_name | varchar(100) | Model AI |
| status | varchar(30) | queued, running, success, failed |
| message | text | Thong diep log ngan |
| request_payload | jsonb | Request rut gon |
| response_payload | jsonb | Response rut gon |
| error_message | text | Loi neu co |
| created_at | timestamp | Ngay tao |

## 3. Quan he chinh
- `teachers` 1 - n `exams`
- `exams` 1 - n `submissions`
- `exams` 1 - n `system_logs`
- `submissions` 1 - n `system_logs`

## 4. Index de xuat
- `teachers(email)` unique
- `exams(subject_code, class_code, exam_type, exam_round)`
- `submissions(exam_id, student_code)`
- `submissions(student_code, student_name, class_code)`
- `submissions(status, submitted_at)`
- `system_logs(ref_table, ref_id, created_at)`
- `system_logs(status, log_type, created_at)`
- `system_logs(workflow_execution_id)`

## 5. Trang thai du lieu de xuat
### Trang thai exam
- `draft`
- `processing`
- `ready`
- `archived`

### Trang thai submission
- `uploaded`
- `extracting`
- `extracted`
- `grading`
- `graded`
- `failed`

### Trang thai grading
- Dung chung voi `submissions.status` va file ket qua cham tong hop.

## 6. Goi y PostgreSQL DDL rut gon
```sql
create table teachers (
  id uuid primary key,
  teacher_code varchar(50) unique not null,
  full_name varchar(255) not null,
  email varchar(255) unique not null,
  password_hash text not null,
  status varchar(30) not null default 'active',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table exams (
  id uuid primary key,
  exam_code varchar(50) unique not null,
  version integer not null default 1,
  title varchar(255) not null,
  description text,
  class_code varchar(50),
  subject_code varchar(50),
  subject_name varchar(255),
  exam_type varchar(50) not null,
  exam_round varchar(50),
  teacher_id uuid references teachers(id),
  question_file_path text,
  answer_file_path text,
  answer_extract_file_path text,
  status varchar(30) not null default 'draft',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table submissions (
  id uuid primary key,
  exam_id uuid not null references exams(id),
  student_code varchar(50) not null,
  student_name varchar(255) not null,
  class_code varchar(50) not null,
  subject_code varchar(50),
  submission_file_path text,
  submission_extract_file_path text,
  grading_result_file_path text,
  total_score numeric(5,2),
  max_score numeric(5,2),
  ai_confidence numeric(5,2),
  submitted_at timestamp not null default now(),
  source_type varchar(30) default 'web',
  status varchar(30) not null default 'uploaded',
  published_at timestamp,
  reviewed_by uuid references teachers(id),
  reviewed_at timestamp,
  notes text
);

create table system_logs (
  id uuid primary key,
  log_type varchar(50) not null,
  ref_table varchar(50) not null,
  ref_id uuid,
  exam_id uuid references exams(id),
  submission_id uuid references submissions(id),
  student_code varchar(50),
  student_name varchar(255),
  class_code varchar(50),
  workflow_execution_id varchar(100),
  model_name varchar(100),
  status varchar(30) not null,
  message text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamp not null default now()
);
```

## 7. Luu y bao mat
- Tach quyen doc ket qua cua sinh vien va quyen quan ly cua giao vien.
- Log he thong can an thong tin nhay cam neu can luu de audit.
- Cac file JSON extract va file JSON ket qua cham can duoc phan quyen truy cap phu hop.
