# AM Attendance — ระบบเช็คชื่อนักเรียน

ระบบเช็คชื่อนักเรียนแบบ full-stack สร้างด้วย **Next.js 14 + Supabase (Postgres)**

---

## สิ่งที่ต้องมี

- Node.js 18+
- บัญชี [Supabase](https://supabase.com) (ฟรี)
- (สำหรับ deploy) บัญชี [Vercel](https://vercel.com)

---

## การตั้งค่าครั้งแรก

### 1. สร้าง Supabase Project

1. ไปที่ [supabase.com](https://supabase.com) แล้วสร้างโปรเจกต์ใหม่
2. รอจนโปรเจกต์พร้อม (ประมาณ 1 นาที)

### 2. รัน Schema SQL

1. ใน Supabase Dashboard ไปที่ **Database → SQL Editor**
2. วางเนื้อหาจากไฟล์ `supabase/schema.sql` ทั้งหมด แล้วกด **Run**

### 3. ตั้งค่า Environment Variables

```bash
cp .env.local.example .env.local
```

เปิดไฟล์ `.env.local` แล้วกรอกข้อมูล:

| ตัวแปร | ที่มา |
|--------|-------|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role (secret) |
| `JWT_SECRET` | สร้างเองด้วยคำสั่ง `openssl rand -hex 32` |

> ⚠️ **สำคัญ:** `SUPABASE_SERVICE_ROLE_KEY` ต้องไม่มีคำนำหน้า `NEXT_PUBLIC_` และห้ามเปิดเผยให้ browser เห็น

### 4. ติดตั้ง Dependencies

```bash
npm install
```

### 5. สร้าง Admin Account

สร้าง hash ของรหัสผ่าน:

```bash
node scripts/hash-password.js "รหัสผ่านของคุณ"
```

คัดลอก hash ที่ได้ แล้วรันใน **Supabase SQL Editor**:

```sql
INSERT INTO admins (username, password_hash)
VALUES ('admin', 'วางhashที่ได้ตรงนี้');
```

(เปลี่ยน `admin` เป็นชื่อผู้ใช้ที่ต้องการ)

### 6. รัน Development Server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

---

## การใช้งาน

ระบบทำงานตาม flow ดังนี้:

```
ผู้ดูแลเข้าสู่ระบบ (/admin/login)
  → เพิ่มนักเรียน (/admin/students)
  → สร้างสัปดาห์ + คำถาม (/admin/dashboard)
  → เปิดการเช็คชื่อ (/admin/week/[id])
  → แชร์ลิงก์หน้าแรก (/) ให้นักเรียน
  → นักเรียนกรอกรหัส → ตอบคำถาม → เช็คชื่อ
  → Dashboard อัปเดตทุก 3 วินาที
  → ปิดการเช็คชื่อ
  → Export Excel
  → สร้างสัปดาห์ถัดไป
```

### หน้าต่างๆ

| URL | คำอธิบาย |
|-----|----------|
| `/` | หน้าเช็คชื่อสำหรับนักเรียน |
| `/admin/login` | เข้าสู่ระบบผู้ดูแล |
| `/admin/dashboard` | รายการสัปดาห์ทั้งหมด |
| `/admin/students` | จัดการรายชื่อนักเรียน |
| `/admin/week/[id]` | Dashboard สัปดาห์ (live polling) |

### Excel Export

กดปุ่ม **↓ Export Excel** ในหน้าสัปดาห์ได้เลย ไฟล์จะมีรายชื่อนักเรียน**ทุกคน** (ทั้งที่มาและขาด) พร้อมสถานะ เวลา และคำตอบ

---

## การ Deploy บน Vercel

1. Push โค้ดขึ้น GitHub
2. ไปที่ [vercel.com](https://vercel.com) → **New Project** → Import จาก GitHub
3. ใน **Environment Variables** เพิ่ม 3 ตัวแปรเดียวกับ `.env.local`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
4. กด **Deploy**

---

## โครงสร้างโปรเจกต์

```
am-attendance/
├── lib/
│   ├── supabaseAdmin.js    # Supabase client (server-side only)
│   ├── auth.js             # JWT session helpers
│   └── withAdminAuth.js    # API route auth wrapper
├── components/
│   └── AdminShell.js       # Admin layout (nav + header)
├── styles/
│   └── globals.css         # Design system tokens + components
├── scripts/
│   └── hash-password.js    # Bcrypt hash generator for admin setup
├── supabase/
│   └── schema.sql          # Database schema
├── pages/
│   ├── index.js            # Student check-in page
│   ├── admin/
│   │   ├── login.js
│   │   ├── dashboard.js    # Week list
│   │   ├── students.js     # Student CRUD
│   │   └── week/[id].js    # Live attendance dashboard
│   └── api/
│       ├── admin/          # login, logout, session
│       ├── students/       # CRUD
│       ├── weeks/          # list, create, open, close, export
│       └── attendance/     # current, lookup, submit
└── middleware.js           # Cookie-presence redirect for /admin/*
```

---

## ความปลอดภัย

- ทุก API route ที่เป็น admin ต้องผ่าน `withAdminAuth` (ตรวจสอบ JWT จริงๆ)
- `middleware.js` ทำ redirect เร็ว แต่ไม่ใช่ตัวตรวจสอบหลัก
- Supabase ใช้ service_role key เท่านั้น — RLS เปิดอยู่แต่ไม่มี policy สำหรับ anon
- Session cookie: httpOnly, sameSite=lax, secure (production), อายุ 8 ชั่วโมง
- รหัสผ่าน admin ถูก hash ด้วย bcrypt (salt rounds = 10)
