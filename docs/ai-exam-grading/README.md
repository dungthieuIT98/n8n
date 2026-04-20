# AI Exam Grading App with n8n

## Muc tieu
Bo tai lieu nay mo ta mot ung dung tu dong cham diem bai thi bang AI va `n8n`, bao gom quy trinh nghiep vu, dac ta chuc nang, giao dien chinh, thiet ke co so du lieu, va kien truc workflow.

## Pham vi bai toan
- Giao vien dang nhap vao he thong.
- Giao vien tai len de thi, dap an, mo ta, `teacher_id`, `api_key` hoac thong tin tich hop AI.
- He thong tu dong extract noi dung file, chuan hoa du lieu va luu vao database.
- Sinh vien tai len bai thi theo mon hoc.
- He thong extract bai lam cua sinh vien, dua ve form du lieu chuan.
- AI doi chieu bai lam voi dap an mau va thuc hien cham diem.
- Giao vien theo doi ket qua cham theo lop, mon hoc, loai bai thi.
- Sinh vien tra cuu ket qua bang `student_code`, ho ten va `class_code`.
- Sinh vien xem chi tiet bai thi de biet cau nao dung, cau nao sai va giai thich ngan gon.

## Cau truc tai lieu
- `01-project-spec.md`: Tong quan du an, muc tieu, vai tro, pham vi.
- `02-functional-requirements.md`: Dac ta chuc nang chi tiet.
- `03-page-spec.md`: Dac ta cac man hinh chinh.
- `04-database-design.md`: Thiet ke co so du lieu va goi y schema.
- `05-n8n-workflow-architecture.md`: Kien truc workflow `n8n` va luong tu dong hoa.

## Nguyen tac thiet ke
- Tach ro du lieu de thi, dap an, bai nop, ket qua extract va ket qua cham.
- Luu vet toan bo lan xu ly AI de co the audit.
- Ho tro nhieu loai file: PDF, DOCX, anh scan, file zip.
- Co kha nang xu ly lai khi extract loi hoac can cham lai.
- Dam bao giao vien va sinh vien chi xem duoc du lieu duoc phep truy cap.

## Doi tuong su dung
- Giao vien
- Sinh vien
- Quan tri he thong

## Cong nghe de xuat
- `n8n`: dieu phoi workflow upload, extract, cham diem, thong bao.
- `PostgreSQL`: luu tru du lieu nghiep vu.
- Object storage hoac local storage: luu file goc va file da xu ly.
- AI/LLM service: OCR, extract cau tra loi, doi chieu dap an, sinh giai thich.
