# 01. Project Specification

## 1. Tong quan
He thong AI Exam Grading App la ung dung ho tro giao vien quan ly de thi, dap an, bai nop cua sinh vien va tu dong cham diem bang AI. He thong duoc thiet ke de chay voi `n8n` lam lop workflow, ket hop AI service va co so du lieu tap trung.

## 2. Muc tieu nghiep vu
- Giam thoi gian cham bai thu cong.
- Chuan hoa quy trinh tiep nhan de thi, dap an va bai lam.
- Cho phep trich xuat noi dung tu nhieu dinh dang file.
- Tao ket qua cham co cau truc, de tra cuu va doi soat.
- Cung cap giao dien rieng cho giao vien va sinh vien.

## 3. Pham vi du an
### Trong pham vi
- Dang nhap giao vien.
- Quan ly de thi, dap an theo lop, mon hoc, loai bai thi.
- Upload de thi va loi giai/dap an.
- Upload bai lam cua sinh vien.
- Tu dong extract noi dung file.
- Tu dong cham diem dua tren dap an mau.
- Hien thi ket qua tong hop va chi tiet.
- Tra cuu ket qua theo `student_code`, ho ten va `class_code`.

## 4. Vai tro nguoi dung
### Giao vien
- Dang nhap vao he thong.
- Tao va quan ly de thi.
- Upload de thi, dap an, file huong dan cham.
- Xem danh sach bai nop va ket qua cham.
- Xem chi tiet bai lam va phe duyet ket qua neu can.

### Sinh vien
- Upload bai thi theo mon hoc va loai bai thi.
- Tra cuu ket qua bang `student_code`, ho ten va `class_code`.
- Xem chi tiet tung cau dung/sai va giai thich.

### Quan tri he thong
- Theo doi log he thong va log workflow xu ly bai thi.
- Tra cuu tien trinh xu ly cua tung de thi, bai nop, va lan cham diem.
- Xu ly cac truong hop loi bang cach xem log va retry workflow khi can.

## 5. Dau vao chinh
### Dau vao tu giao vien
- File de thi
- File dap an hoac loi giai
- Mo ta de thi
- Lop hoc
- Mon hoc
- Loai bai thi
- `teacher_id`
- `api_key` hoac khoa tich hop AI

### Dau vao tu sinh vien
- File bai thi
- `student_code`
- Ho ten sinh vien
- `class_code`
- Ma mon hoc
- Loai bai thi

## 6. Dau ra chinh
- Noi dung dap an chuan hoa
- Noi dung bai lam da extract theo form
- Ket qua cham diem tong hop
- Ket qua cham chi tiet theo cau
- Trang thai xu ly tung file
- Log AI va workflow de audit

## 7. Gia tri cot loi
- Tu dong hoa quy trinh cham thi.
- Co the xu ly so luong lon bai thi theo lo.
- Minh bach ket qua cham nho luu chi tiet theo cau.
- Ho tro giang vien kiem soat va xac minh ket qua.

## 8. Yeu cau phi chuc nang
- Bao mat du lieu bai thi va thong tin nguoi dung.
- Ho tro retry khi OCR hoac AI extract that bai.
- Theo doi trang thai xu ly theo thoi gian thuc.
- Khong mat du lieu file goc khi workflow loi.
- Co kha nang mo rong cho nhieu mon hoc va nhieu loai bai thi.
