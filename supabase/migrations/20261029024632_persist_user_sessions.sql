create table if not exists public.user_sessions (
  id bigint generated always as identity primary key,
  token_hash text not null unique,
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  constraint user_sessions_token_hash_length_check check (char_length(token_hash) = 64),
  constraint user_sessions_expiry_check check (expires_at > created_at)
);

create index if not exists user_sessions_user_id_idx
  on public.user_sessions (user_id);

create index if not exists user_sessions_expires_at_idx
  on public.user_sessions (expires_at);

alter table public.user_sessions enable row level security;

-- Authentication is performed by the Express server over its direct PostgreSQL
-- connection. Browser-facing Supabase roles must never read session digests.
revoke all on table public.user_sessions from anon, authenticated;
