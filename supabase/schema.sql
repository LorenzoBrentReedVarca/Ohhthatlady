-- ============================================================================
--  Contact form storage for ailenetungalatugna.com
--  Run this once in the Supabase dashboard → SQL Editor → New query → Run.
-- ============================================================================

create table if not exists public.contact_messages (
  id         bigserial primary key,
  name       text        not null check (char_length(trim(name))    between 1 and 120),
  email      text        not null check (email ~* '^[^\s@]+@[^\s@]+\.[a-z]{2,}$'),
  message    text        not null check (char_length(trim(message)) between 10 and 2000),
  created_at timestamptz not null default now(),
  notified   boolean     not null default false
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

-- ----------------------------------------------------------------------------
--  Row Level Security
--  Anonymous visitors may INSERT and nothing else. They cannot read, update or
--  delete any row — including their own. Only the service role (the dashboard,
--  and your Edge Function) can read the table.
-- ----------------------------------------------------------------------------

alter table public.contact_messages enable row level security;

drop policy if exists "anon can submit contact messages" on public.contact_messages;
create policy "anon can submit contact messages"
  on public.contact_messages
  for insert
  to anon
  with check (true);

-- No SELECT / UPDATE / DELETE policy is defined on purpose: with RLS enabled
-- and no matching policy, those operations are denied for anon and authenticated.

grant insert on public.contact_messages to anon;
grant usage, select on sequence public.contact_messages_id_seq to anon;

-- ============================================================================
--  Site visits — a lightweight log of who checks the website.
--  Written once per browser session (see script.js), no cookies, no IP
--  address, no third-party tracker. Just enough to see that someone visited,
--  roughly when, roughly from where they clicked in, and what device.
-- ============================================================================

create table if not exists public.page_visits (
  id          bigserial primary key,
  visited_at  timestamptz not null default now(),
  path        text        not null default '/',
  referrer    text,
  user_agent  text,
  language    text,
  viewport    text
);

create index if not exists page_visits_visited_at_idx
  on public.page_visits (visited_at desc);

alter table public.page_visits enable row level security;

drop policy if exists "anon can log a visit" on public.page_visits;
create policy "anon can log a visit"
  on public.page_visits
  for insert
  to anon
  with check (true);

-- Same as contact_messages: insert-only for anon. No SELECT/UPDATE/DELETE
-- policy exists, so visitors can never read the visit log back — only you,
-- via the dashboard, can.

grant insert on public.page_visits to anon;
grant usage, select on sequence public.page_visits_id_seq to anon;
