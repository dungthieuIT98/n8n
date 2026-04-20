# 02. Functional Requirements

## 1. Module giao vien
### 1.1 Dang nhap giao vien
- Giao vien dang nhap bang email/username va mat khau.
- He thong phan quyen theo vai tro `teacher`.
- Ho tro reset mat khau va khoa tai khoan khi dang nhap sai nhieu lan.

### 1.2 Upload de thi va dap an
- Giao vien co mot trang de tai len:
  - File de thi
  - File dap an hoac loi giai
  - Mo ta de thi
  - `teacher_id`
  - `api_key` neu can truyen cho AI service
  - Lop hoc
  - Mon hoc
  - Loai bai thi
- He thong cho phep upload cac dinh dang `pdf`, `docx`, `png`, `jpg`, `zip`.
- Sau khi upload lan dau, he thong tao ban ghi de thi voi `version = 1`.
- `n8n` tu dong kich hoat workflow extract file va luu ket qua vao database.

### 1.3 Quan ly de thi
- Giao vien xem danh sach de thi theo bo loc:
  - Lop
  - Mon hoc
  - Loai bai thi
  - Trang thai extract
  - Ngay tao
- Giao vien xem chi tiet de thi, dap an da extract va thong tin `version` hien tai.
- Giao vien duoc phep cap nhat lai file de thi/dap an; moi lan cap nhat thi tang `version` tren ban ghi `exams`.

## 2. Module sinh vien
### 2.1 Upload bai thi
- Sinh vien upload bai thi theo mon hoc.
- Truong thong tin bat buoc:
  - `student_code`
  - Ho ten
  - `class_code`
  - Ma mon hoc
  - Loai bai thi
  - File bai nop
- He thong doi chieu mon hoc va loai bai thi voi de thi ton tai.
- Sau khi nop, he thong tao ban ghi submission va day vao workflow xu ly.

### 2.2 Extract bai thi sinh vien
- AI/OCR doc file bai thi cua sinh vien.
- He thong chuyen doi ket qua sang form chuan, vi du:
  - Cau hoi
  - Cau tra loi cua sinh vien
  - Dap an sinh vien chon hoac noi dung tu luan
  - Do tin cay khi extract
- Neu extract loi, he thong ghi log va cho phep xu ly lai.

## 3. Module cham diem AI
### 3.1 Cham diem tu dong
- Sau khi bai nop extract thanh cong, he thong tu dong day tiep sang workflow cham diem, khong can giao vien kich hoat thu cong.
- He thong lay dap an mau cua de thi tuong ung.
- He thong doi chieu bai lam da extract voi dap an.
- Ho tro hai kieu cham diem:
  - Trac nghiem: so khop dap an dung/sai.
  - Tu luan co cau truc: cham theo rubric, tu khoa, y chinh, muc do tuong dong.
- AI tra ve:
  - Diem tong
  - Diem tung cau
  - Ket qua dung/sai
  - Giai thich ngan gon
  - Do tin cay cua lan cham

### 3.2 Kiem duyet ket qua
- Giao vien co the xem ket qua truoc khi cong bo.
- Giao vien duoc phep danh dau `approved`, `recheck`, `rejected`.
- He thong luu nguoi kiem duyet va thoi diem kiem duyet.

## 4. Module hien thi ket qua giao vien
### 4.1 Trang ket qua cham
- Hien thi danh sach bai thi da cham.
- Bo loc theo:
  - Lop
  - Mon hoc
  - Loai bai thi
  - Dot thi
  - Sinh vien
  - Trang thai cham
- Cac cot chinh:
  - `student_code`
  - Ho ten
  - Mon hoc
  - Loai bai thi
  - Diem tong
  - Trang thai
  - Thoi gian nop
  - Thoi gian cham
- Giao vien co the vao chi tiet bai lam de xem ket qua tung cau.

## 5. Module tra cuu ket qua cho sinh vien
### 5.1 Trang tra cuu ket qua
- Sinh vien nhap:
  - `student_code`
  - Ho ten
  - `class_code`
- He thong tra ve danh sach bai thi phu hop.
- Moi ket qua hien thi:
  - Diem tong
  - Trang thai cong bo
  - Ngay cham
  - Ghi chu neu co

### 5.2 Trang chi tiet bai thi
- Sinh vien xem chi tiet tung cau.
- Thong tin hien thi:
  - Cau hoi
  - Cau tra loi cua sinh vien
  - Dap an dung
  - Ket qua dung/sai
  - Diem cua cau
  - Giai thich ngan gon
- Neu la cau tu luan, hien thi rubric tom tat neu duoc phep.

## 6. Module he thong va van hanh
### 6.1 Quan ly xu ly file
- Luu file goc, file da tach text, metadata, log xu ly.
- Ho tro retry workflow extract va cham diem.
- Theo doi trang thai: `uploaded`, `extracting`, `extracted`, `grading`, `graded`, `published`, `failed`.

### 6.2 Audit va log
- He thong co 1 bang log trung tam de ghi nhan toan bo qua trinh xu ly.
- Moi log can cho biet workflow nao dang chay, du lieu nao dang duoc xu ly, buoc nao thanh cong hoac that bai.
- Luu cac thong tin toi thieu: loai job, doi tuong tham chieu, trang thai, thong diep log, chi tiet loi, thoi gian tao.
- Luu lich su moi lan goi AI hoac workflow retry de co the truy vet lai qua trinh cham diem.

### 6.3 Man hinh xem log
- Co 1 man hinh rieng de hien thi log he thong.
- Cho phep loc theo loai job, trang thai, thoi gian, ma de thi, `student_code`, `class_code`, `workflow_execution_id`.
- Cho phep mo chi tiet de xem tung buoc xu ly va loi neu co.
- Tu man hinh nay co the kich hoat retry doi voi cac job that bai neu duoc cap quyen.

### 6.4 Bao mat va phan quyen
- Giao vien chi xem de thi va bai nop thuoc pham vi duoc phan quyen.
- Sinh vien chi xem duoc ket qua cua chinh minh.
- Log khong duoc de lo thong tin nhay cam nhu khoa truy cap day du hoac du lieu khong can thiet.
