-- 오터랩 데이터베이스. Supabase 대시보드 > SQL Editor에 통째로 붙여 넣고 실행하세요.
-- 맨 아래 한 줄의 이메일만 소장님 이메일로 바꾸면 돼요.

-- 연구소의 모든 기록 (소식·초안·게시물·회의록·설정)을 종류(kind)와 id로 담아요
create table if not exists public.lab_items (
  kind text not null,          -- news, draft, post, meeting, setting
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);
create index if not exists lab_items_kind_idx on public.lab_items (kind);

-- 연구소 주인 (이 이메일로 로그인한 사람만 읽고 쓸 수 있어요)
create table if not exists public.lab_owner (
  email text primary key
);

alter table public.lab_items enable row level security;
alter table public.lab_owner enable row level security; -- 정책이 없어서 화면에서는 아무도 못 봐요

create or replace function public.is_lab_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lab_owner where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.is_lab_owner() to anon, authenticated;

drop policy if exists "owner reads" on public.lab_items;
drop policy if exists "owner writes" on public.lab_items;
create policy "owner reads" on public.lab_items for select to authenticated using (public.is_lab_owner());
create policy "owner writes" on public.lab_items for all to authenticated using (public.is_lab_owner()) with check (public.is_lab_owner());

-- ↓ 소장님 이메일로 바꿔서 실행하세요 (구글 로그인이나 이메일 링크 로그인에 쓸 주소)
insert into public.lab_owner (email) values ('me@example.com') on conflict do nothing;
