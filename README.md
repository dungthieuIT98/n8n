# n8n Docker Setup

Bo cau hinh nay chay n8n voi PostgreSQL build tu thu muc `../postgres-docker`.

## Chay

```powershell
cd c:\.D\data\setup\n8n
docker compose up -d --build
```

## Truy cap

- n8n: http://localhost:5678
- PostgreSQL: localhost:5433

## Thong tin database

- Database: `n8n`
- User: `n8n`
- Password: `n8n`

## Dung va xoa container

```powershell
docker compose down
```

Neu muon xoa ca volume du lieu:

```powershell
docker compose down -v
```