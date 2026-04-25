# 05. n8n Workflow Architecture

## 1. Muc tieu
Su dung `n8n` de dieu phoi cac workflow upload, extract, cham diem, cong bo ket qua, retry va theo doi loi cho he thong cham thi tu dong.

## 2. Kien truc tong the
He thong gom 4 lop chinh:
- Frontend/Web app cho giao vien va sinh vien
- API/backend de nhan request va thao tac database
- `n8n` workflow engine de xu ly bat dong bo
- AI/OCR service de extract va cham diem

## 3. Workflow chinh

### 3.1 Workflow upload de thi va dap an
**Trigger**
- Webhook hoac API call sau khi giao vien upload file.

**Buoc xu ly**
1. Xac thuc giao vien.
2. Luu metadata de thi vao bang `exams`.
3. Luu file de thi va file dap an vao storage, cap nhat `question_file_path` va `answer_file_path` trong `exams`.
4. Goi workflow extract dap an da co san.
5. Luu file de thi va file dap an goc len Drive/storage, cap nhat `question_file_path` va `answer_file_path` bang URL truy cap file.
6. Luu JSON extract dap an truc tiep trong `exams.answer_extract`.
8. Cap nhat trang thai de thi thanh `ready` neu thanh cong.
9. Ghi log vao `system_logs`.

**Loi va retry**
- Neu OCR that bai, cap nhat `processing -> failed`.
- Cho phep retry thu cong tu trang giao vien hoac tu dashboard van hanh.

### 3.2 Workflow upload bai thi sinh vien
**Trigger**
- Webhook/API khi sinh vien nop bai.

**Buoc xu ly**
1. Xac thuc va kiem tra de thi ton tai theo mon hoc, loai bai thi.
2. Tao ban ghi `submissions` voi thong tin sinh vien, lop, mon hoc.
3. Luu file bai nop vao storage va cap nhat `submission_file_path`.
4. Goi workflow extract bai thi sinh vien da co san.
5. Luu file JSON extract bai lam vao storage va cap nhat `submission_extract`.
6. Day job tiep sang workflow cham diem.

### 3.3 Workflow cham diem AI
**Trigger**
- Sau khi file extract bai lam cua sinh vien da san sang trong `submissions`.

**Buoc xu ly**
1. Lay JSON dap an mau truc tiep tu `exams.answer_extract`.
2. Lay file JSON bai lam da extract tu `submissions.submission_extract`.
3. Xac dinh loai bai thi: trac nghiem hay tu luan.
4. Goi AI grading service voi prompt mau.
5. Nhan ve ket qua cham tong hop va chi tiet tung cau trong cung 1 JSON.
6. Luu file JSON ket qua cham vao storage va cap nhat `submissions.grading_result_file_path`.
7. Cap nhat cac truong tong hop tren `submissions`: `total_score`, `max_score`, `ai_confidence`, `status = graded`.
8. Neu cau hinh tu dong cong bo, gan `published_at`.
9. Ghi log vao `system_logs`.

### 3.4 Workflow cong bo ket qua
**Trigger**
- Sau khi giao vien phe duyet hoac sau khi cham xong neu cho phep auto publish.

**Buoc xu ly**
1. Kiem tra trang thai `approved` hoac cau hinh auto publish.
2. Cap nhat `published_at`.
3. Gui email hoac thong bao neu can.
4. Dong bo ket qua sang trang tra cuu cua sinh vien.

### 3.5 Workflow cham lai
**Trigger**
- Giao vien bam `recheck` hoac `regrade`.

**Buoc xu ly**
1. Lay lai file dap an extract va file bai lam extract.
2. Tao lan cham moi.
3. Ghi de file JSON ket qua cham tong hop hoac luu version moi neu can.
4. Cap nhat lai cac truong diem tong hop tren `submissions` va ghi log.

## 4. Node de xuat trong n8n
- `Webhook`: nhan request upload.
- `HTTP Request`: goi OCR service, AI service, storage service.
- `Function` hoac `Code`: chuan hoa payload.
- `If`: phan nhanh theo loai bai thi hoac trang thai.
- `Postgres`: doc/ghi database.
- `Set`: tao payload cho cac buoc tiep theo.
- `Error Trigger`: xu ly loi he thong.
- `Execute Workflow`: tach workflow con cho extract va grading.

## 5. Prompt/contract AI de xuat
### Extract de thi
- Dau vao: file text OCR hoac chunk van ban.
- Dau ra JSON:
```json
{
  "questions": [
    {
      "question_no": "1",
      "question_text": "...",
      "question_type": "multiple_choice",
      "options": ["A", "B", "C", "D"],
      "expected_answer": "B",
      "max_score": 1
    }
  ]
}
```

### Extract bai lam sinh vien
- Dau vao: file OCR cua bai nop.
- Dau ra JSON:
```json
{
  "student_answers": [
    {
      "question_no": "1",
      "answer": "B",
      "confidence": 0.97
    }
  ]
}
```

### Cham diem
- Dau vao: dap an mau + bai lam da chuan hoa.
- Dau ra JSON:
```json
{
  "total_score": 8.5,
  "max_score": 10,
  "items": [
    {
      "question_no": "1",
      "is_correct": true,
      "score": 1,
      "max_score": 1,
      "explanation": "Sinh vien chon dung dap an B"
    }
  ],
  "confidence": 0.93
}
```

## 6. Quy tac retry
- Retry toi da 3 lan cho OCR.
- Retry toi da 2 lan cho AI grading neu output sai schema.
- Neu vuot nguong retry, chuyen job sang `failed` va dua vao hang doi can xu ly tay.

## 7. Theo doi va van hanh
- Co 1 man hinh xem log de theo doi workflow thanh cong/that bai.
- Luu `workflow_execution_id` de truy vet trong `n8n`.
- Moi workflow can ghi log theo cac moc: bat dau, dang xu ly, thanh cong, that bai.
- Can co canh bao khi ti le loi OCR hoac AI vuot nguong.

## 8. Bao mat va secret
- `api_key` cua giao vien nen duoc luu o secret store, khong truyen qua frontend sau lan dau.
- Webhook cua `n8n` can co xac thuc.
- Gioi han truy cap node va credentials trong `n8n` theo moi truong.
