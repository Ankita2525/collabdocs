-- CollabDocs schema. Run in the Supabase SQL editor (idempotent).
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_shares (
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create index if not exists documents_owner_idx on documents(owner_id);
create index if not exists document_shares_user_idx on document_shares(user_id);
create index if not exists sessions_user_idx on sessions(user_id);

-- The app connects with a server-side connection string only. Lock out the
-- public Supabase REST API (anon/authenticated keys) from these tables.
alter table users enable row level security;
alter table sessions enable row level security;
alter table documents enable row level security;
alter table document_shares enable row level security;
