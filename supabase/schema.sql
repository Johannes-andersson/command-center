-- ============================================================
-- Command Center: Supabase schema
-- Run this in Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Todos
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  category text default 'ai-brand',
  priority text default 'medium',
  completed boolean default false,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Kanban cards
create table if not exists public.kanban_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  content_type text,
  platform text,
  status text not null default 'idea',
  position integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Calendar events
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  event_date date not null,
  event_time time,
  platform text,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sources (research / inspiration links)
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  url text,
  notes text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- AI tools catalog
create table if not exists public.ai_tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text,
  url text,
  cost text,
  use_case text,
  rating integer check (rating between 1 and 5),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Row-Level Security: each user can only see and edit their own rows
-- ============================================================

alter table public.todos enable row level security;
alter table public.kanban_cards enable row level security;
alter table public.calendar_events enable row level security;
alter table public.sources enable row level security;
alter table public.ai_tools enable row level security;

-- Helper to create the four standard policies on a table
do $$
declare
  t text;
begin
  foreach t in array array['todos','kanban_cards','calendar_events','sources','ai_tools'] loop
    execute format('drop policy if exists "own_select" on public.%I', t);
    execute format('drop policy if exists "own_insert" on public.%I', t);
    execute format('drop policy if exists "own_update" on public.%I', t);
    execute format('drop policy if exists "own_delete" on public.%I', t);

    execute format('create policy "own_select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own_insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own_update" on public.%I for update using (auth.uid() = user_id)', t);
    execute format('create policy "own_delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ============================================================
-- Auto-update updated_at on row changes
-- ============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array['todos','kanban_cards','calendar_events','sources','ai_tools'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ============================================================
-- Indexes for common queries
-- ============================================================

create index if not exists todos_user_idx on public.todos(user_id, completed, due_date);
create index if not exists kanban_user_status_idx on public.kanban_cards(user_id, status, position);
create index if not exists calendar_user_date_idx on public.calendar_events(user_id, event_date);
create index if not exists sources_user_idx on public.sources(user_id, created_at desc);
create index if not exists ai_tools_user_idx on public.ai_tools(user_id, rating desc nulls last);
