# 03. Page Specification

## 1. Trang dang nhap giao vien
### Muc tieu
Xac thuc giao vien truoc khi truy cap he thong quan ly de thi va ket qua cham.

### Thanh phan chinh
- Truong email/username
- Truong mat khau
- Nut dang nhap

### Hanh vi
- Dang nhap thanh cong chuyen den dashboard giao vien.
- Tai khoan khong co quyen se bi tu choi truy cap.

## 2. Trang giao vien upload de thi va loi giai
### Muc tieu
Cho phep giao vien tao de thi moi va dua dap an vao he thong.

### Truong thong tin
- Ten de thi
- Mo ta de thi
- Lop hoc
- Mon hoc
- Loai bai thi ( giữa kỳ, cuối kỳ, 15p,....)
- `teacher_id`
- File de thi
- File dap an/loi giai

### Chuc nang
- Kiem tra du lieu bat buoc truoc khi upload.
- Hien thi trang thai xu ly sau upload:
  - Da tai len
  - Loi

## 3. Trang quan ly de thi cua giao vien
### Muc tieu
Quan ly danh sach de thi theo lop, mon hoc va loai.

### Thanh phan chinh
- Bo loc theo lop, mon, loai, dot thi, trang thai
- Bang danh sach de thi
- Nut xem chi tiet
- Nut cap nhat de thi/dap an

### Cot du lieu
- Ma de thi
- Version
- Ten de thi
- Lop
- Mon hoc
- Loai bai thi
- So bai nop
- Trang thai
- Ngay tao
- Nguoi tao

## 4. Trang ket qua cham bai cua hoc sinh cho giao vien
### Muc tieu
Cho phep giao vien xem toan bo ket qua cham cua sinh vien.

### Thanh phan chinh
- Bo loc theo lop, mon hoc, loai bai thi, dot thi, trang thai
- Bang ket qua cham
- nut tai bai cua hoc sinh
- Nut cham lai
- Nut phe duyet ket qua
- Nut xuat file ket qua

### Hanh vi
- Sau khi sinh vien nop bai va extract thanh cong, he thong tu dong cham diem.
- Giao vien chi can vao man hinh nay de xem, phe duyet, hoac cham lai khi can.

### Cot du lieu
- `student_code`
- Ho ten
- Lop
- Mon hoc
- Loai bai thi
- Diem tong
- Trang thai cham
- Do tin cay AI
- Thoi gian nop
- Thoi gian cham

## 5. Trang tra cuu ket qua cho sinh vien
### Muc tieu
Cho phep sinh vien tim ket qua bai thi dua tren thong tin co san.

### Truong tim kiem
- `student_code`
- Ho ten
- `class_code`

### Ket qua hien thi
- Ten bai thi
- Mon hoc
- Loai bai thi
- Diem tong
- Trang thai cong bo
- Thoi gian cham
- Nut xem chi tiet

## 6. Trang chi tiet bai thi cua sinh vien
### Muc tieu
Cho phep sinh vien xem tung cau de biet bai cua minh dung sai nhu the nao.

### Thanh phan chinh
- Thong tin tong quan bai thi
- Diem tong
- Danh sach cau hoi
- Ket qua moi cau
- Giai thich ngan gon cua AI
- File bai nop goc hoac ban preview neu can

### Hien thi moi cau
- So thu tu cau
- Noi dung cau hoi
- Cau tra loi cua sinh vien
- Dap an dung
- Ket qua dung/sai
- Diem cua cau
- Giai thich

## 7. Trang xem log he thong
### Muc tieu
Theo doi qua trinh xu ly workflow, xem loi va truy vet tung job.

### Thanh phan chinh
- Bo loc theo loai job, trang thai, khoang thoi gian
- Tim kiem theo ma de thi, `student_code`, `class_code`, `workflow_execution_id`
- Bang log he thong
- Nut xem chi tiet log
- Nut retry workflow doi voi log loi

### Cot du lieu
- Thoi gian tao log
- Loai job
- Doi tuong tham chieu
- Ma de thi hoac ma bai nop
- `student_code` neu co
- `class_code` neu co
- Trang thai
- Thong diep log
- `workflow_execution_id`
- Hanh dong xem chi tiet

## 8. Dieu huong de xuat
- Giao vien: Dang nhap -> Dashboard -> Upload de thi -> Quan ly de thi -> Xem ket qua cham
- Sinh vien: Tra cuu ket qua -> Xem danh sach ket qua -> Xem chi tiet bai thi
