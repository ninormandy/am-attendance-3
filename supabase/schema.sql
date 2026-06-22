-- Run this once in your Supabase project's SQL editor (Database > SQL Editor).

create extension if not exists "pgcrypto";

create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_id text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists weeks (
  id uuid primary key default gen_random_uuid(),
  week_number int not null unique,
  question text not null,
  status text not null default 'closed' check (status in ('closed', 'open')),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only one week can ever be "open" (taking attendance) at a time.
create unique index if not exists one_open_week_idx on weeks ((status)) where status = 'open';

create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references weeks(id) on delete cascade,
  student_id text not null,
  student_name text not null,
  answer text,
  seconds_taken int,
  submitted_at timestamptz not null default now(),
  unique (week_id, student_id)
);

create index if not exists attendance_week_idx on attendance_records(week_id);

-- Row Level Security: the app only ever talks to Supabase from server-side
-- API routes using the service_role key, which bypasses RLS. Enabling RLS
-- with no policies means the public/anon key (if it were ever exposed)
-- cannot read or write anything in these tables.
alter table admins enable row level security;
alter table students enable row level security;
alter table weeks enable row level security;
alter table attendance_records enable row level security;
