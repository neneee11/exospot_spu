-- ExoSpot database schema (Supabase / PostgreSQL)
-- ไม่มีตารางเก็บภาพหรือวิดีโอ: เก็บเฉพาะตัวเลขสรุปผล (PDPA)

-- ---------- ผู้ป่วย ----------
create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  nickname                text not null,
  full_name               text not null,
  age                     int  not null check (age between 40 and 120),
  sex                     text not null check (sex in ('female', 'male', 'other')),
  height_cm               numeric(5,1) not null,
  weight_kg               numeric(5,1) not null,
  affected_side           text not null check (affected_side in ('left', 'right', 'both')),
  patient_group           text not null check (patient_group in ('pre_op', 'post_op')),
  surgery_date            date,
  comorbidities           text[] not null default '{}',
  walking_aid             text not null default 'none' check (walking_aid in ('none', 'cane', 'walker')),
  baseline_pain           int  not null check (baseline_pain between 0 and 10),
  consent_at              timestamptz not null,
  line_link_code          text unique not null,
  caregiver_line_user_id  text,
  settings                jsonb not null default '{"voice": true, "persona": "warm", "voiceCommands": false, "autoNotify": true}',
  created_at              timestamptz not null default now()
);

-- ---------- โปรแกรมฝึกและเกณฑ์จากนักกายภาพ ----------
create table if not exists public.exercise_plans (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  exercise     text not null,
  target_reps  int  not null check (target_reps between 1 and 50),
  sets         int  not null check (sets between 1 and 10),
  per_day      int  not null check (per_day between 1 and 6),
  thresholds   jsonb not null,
  approved_by  text,
  updated_at   timestamptz not null default now(),
  unique (user_id, exercise)
);

-- ---------- ผลการฝึกแต่ละรอบ ----------
create table if not exists public.sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  exercise         text not null,
  started_at       timestamptz not null,
  duration_sec     int  not null,
  target_reps      int  not null,
  completed_reps   int  not null,
  correct_reps     int  not null,
  correct_percent  int  not null,
  alerts           jsonb not null,
  avg_rep_sec      numeric(5,1) not null,
  rom_min          int,
  rom_max          int,
  pain_before      int check (pain_before between 0 and 10),
  pain_after       int check (pain_after between 0 and 10),
  feeling          text check (feeling in ('easy', 'ok', 'tired')),
  created_at       timestamptz not null default now()
);
create index if not exists sessions_user_started_idx on public.sessions (user_id, started_at desc);

-- ---------- รายละเอียดรายครั้ง (สำหรับนักกายภาพ) ----------
create table if not exists public.rep_events (
  id            bigint generated always as identity primary key,
  session_id    uuid not null references public.sessions (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  rep           int  not null,
  duration_sec  numeric(5,1) not null,
  min_angle     int  not null,
  max_angle     int  not null,
  worst_state   text not null check (worst_state in ('G', 'Y', 'R', 'O')),
  issues        text[] not null default '{}'
);
create index if not exists rep_events_session_idx on public.rep_events (session_id);

-- ---------- Row Level Security: แต่ละคนเห็นเฉพาะข้อมูลตัวเอง ----------
alter table public.profiles       enable row level security;
alter table public.exercise_plans enable row level security;
alter table public.sessions       enable row level security;
alter table public.rep_events     enable row level security;

drop policy if exists "own profile" on public.profiles;
drop policy if exists "own plans" on public.exercise_plans;
drop policy if exists "own sessions" on public.sessions;
drop policy if exists "own reps" on public.rep_events;

create policy "own profile"  on public.profiles       for all using (id = auth.uid())      with check (id = auth.uid());
create policy "own plans"    on public.exercise_plans for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own sessions" on public.sessions       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own reps"     on public.rep_events     for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ผู้ใช้ตั้ง caregiver_line_user_id เองไม่ได้ (ตั้งได้จาก LINE webhook ที่ใช้ service role เท่านั้น)
create or replace function public.protect_caregiver_link()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.caregiver_line_user_id := null;
    elsif new.caregiver_line_user_id is distinct from old.caregiver_line_user_id then
      new.caregiver_line_user_id := old.caregiver_line_user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_caregiver_link on public.profiles;
create trigger protect_caregiver_link
  before insert or update on public.profiles
  for each row execute function public.protect_caregiver_link();
