-- Run this in Supabase SQL Editor.
-- This schema is what api/admin.js now expects.

create extension if not exists pgcrypto;

create table if not exists public.admin_secrets (
  id uuid primary key default gen_random_uuid(),
  secret_admin_password text not null default 'Aquackeck123',
  master_password text not null default 'watercheck123',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_secrets
  add column if not exists secret_admin_password text;

alter table public.admin_secrets
  add column if not exists master_password text;

alter table public.admin_secrets
  add column if not exists updated_at timestamptz not null default now();

update public.admin_secrets
set
  secret_admin_password = 'Aquackeck123',
  master_password = 'watercheck123',
  updated_at = now();

insert into public.admin_secrets (secret_admin_password, master_password, updated_at)
select 'Aquackeck123', 'watercheck123', now()
where not exists (select 1 from public.admin_secrets);
