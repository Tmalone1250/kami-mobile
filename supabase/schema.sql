-- ==============================================================================
-- PROJECT KAMI: DIRECTIVE 06 - SUPABASE & THE TRUTH ENGINE SCHEMA
-- Run this script in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

-- 1. USERS TABLE
create table if not exists public.users (
  id text primary key, -- Privy DID (e.g. 'did:privy:...') or wallet address
  wallet_address text,
  kami_balance numeric(12, 2) not null default 0.00,
  total_swipes integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. PROMPT STATS TABLE (Community Consensus Metrics)
create table if not exists public.prompt_stats (
  prompt_id text primary key,
  total_swipes integer not null default 0,
  left_swipes integer not null default 0,
  right_swipes integer not null default 0,
  consensus_direction text check (consensus_direction in ('left', 'right', 'tie')),
  consensus_percentage integer default 50,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. SWIPES TABLE (Individual Instinct Ledger)
create table if not exists public.swipes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  prompt_id text not null,
  swipe_direction text not null check (swipe_direction in ('left', 'right')),
  agreed_with_consensus boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_swipes_user_prompt on public.swipes (user_id, prompt_id);
create index if not exists idx_swipes_prompt_id on public.swipes (prompt_id);

-- 4. RPC FUNCTION: record_swipe_and_get_consensus
create or replace function public.record_swipe_and_get_consensus(
  p_user_id text,
  p_prompt_id text,
  p_swipe_direction text
)
returns json
language plpgsql
security definer
as $$
declare
  v_total integer;
  v_left integer;
  v_right integer;
  v_majority_direction text;
  v_majority_pct integer;
  v_user_agreed boolean;
begin
  -- Ensure user profile exists
  insert into public.users (id, kami_balance, total_swipes)
  values (p_user_id, 0.00, 0)
  on conflict (id) do nothing;

  -- Upsert prompt stats with incremented counts
  insert into public.prompt_stats (prompt_id, total_swipes, left_swipes, right_swipes)
  values (
    p_prompt_id,
    1,
    case when p_swipe_direction = 'left' then 1 else 0 end,
    case when p_swipe_direction = 'right' then 1 else 0 end
  )
  on conflict (prompt_id) do update
  set
    total_swipes = prompt_stats.total_swipes + 1,
    left_swipes = prompt_stats.left_swipes + case when p_swipe_direction = 'left' then 1 else 0 end,
    right_swipes = prompt_stats.right_swipes + case when p_swipe_direction = 'right' then 1 else 0 end,
    updated_at = timezone('utc'::text, now())
  returning total_swipes, left_swipes, right_swipes
  into v_total, v_left, v_right;

  -- Calculate community consensus
  if v_left > v_right then
    v_majority_direction := 'left';
    v_majority_pct := round((v_left::numeric / v_total::numeric) * 100);
  elsif v_right > v_left then
    v_majority_direction := 'right';
    v_majority_pct := round((v_right::numeric / v_total::numeric) * 100);
  else
    v_majority_direction := 'tie';
    v_majority_pct := 50;
  end if;

  -- Did user match the majority?
  if v_majority_direction = 'tie' then
    v_user_agreed := true;
  else
    v_user_agreed := (p_swipe_direction = v_majority_direction);
  end if;

  -- Update consensus cache on prompt_stats
  update public.prompt_stats
  set
    consensus_direction = v_majority_direction,
    consensus_percentage = v_majority_pct
  where prompt_id = p_prompt_id;

  -- Store immutable swipe record
  insert into public.swipes (user_id, prompt_id, swipe_direction, agreed_with_consensus)
  values (p_user_id, p_prompt_id, p_swipe_direction, v_user_agreed);

  -- Increment user's total swipe count
  update public.users
  set total_swipes = total_swipes + 1,
      updated_at = timezone('utc'::text, now())
  where id = p_user_id;

  -- Return consensus metrics back to the mobile UI
  return json_build_object(
    'consensus_percentage', v_majority_pct,
    'agreed_with_majority', v_user_agreed,
    'majority_direction', v_majority_direction,
    'total_swipes', v_total
  );
end;
$$;

-- 5. RPC FUNCTION: claim_kami_rewards
create or replace function public.claim_kami_rewards(
  p_user_id text,
  p_reward_amount numeric
)
returns json
language plpgsql
security definer
as $$
declare
  v_new_balance numeric;
begin
  insert into public.users (id, kami_balance, total_swipes)
  values (p_user_id, p_reward_amount, 0)
  on conflict (id) do update
  set
    kami_balance = users.kami_balance + p_reward_amount,
    updated_at = timezone('utc'::text, now())
  returning kami_balance into v_new_balance;

  return json_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
alter table public.users enable row level security;
alter table public.prompt_stats enable row level security;
alter table public.swipes enable row level security;

-- Allow anon & authenticated read/write access for the client app
create policy "Allow read users" on public.users for select using (true);
create policy "Allow insert/update users" on public.users for all using (true) with check (true);

create policy "Allow read prompt_stats" on public.prompt_stats for select using (true);
create policy "Allow insert/update prompt_stats" on public.prompt_stats for all using (true) with check (true);

create policy "Allow read swipes" on public.swipes for select using (true);
create policy "Allow insert swipes" on public.swipes for insert with check (true);

-- Grant RPC execution permissions
grant execute on function public.record_swipe_and_get_consensus to anon, authenticated, service_role;
grant execute on function public.claim_kami_rewards to anon, authenticated, service_role;

-- ==============================================================================
-- DIRECTIVE 08: USER PROFILE & STORAGE EXPANSION
-- ==============================================================================

-- Add profile columns to public.users if not already present
alter table public.users add column if not exists username text unique;
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists bio text;

-- Ensure avatars storage bucket exists and is public
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Drop existing avatar storage policies if they exist to avoid duplicate conflicts
drop policy if exists "Allow avatar uploads" on storage.objects;
drop policy if exists "Allow avatar updates" on storage.objects;
drop policy if exists "Allow public avatar reads" on storage.objects;
drop policy if exists "Allow avatar deletes" on storage.objects;

-- Storage RLS policies for avatars bucket (supporting anon/Privy client uploads)
create policy "Allow avatar uploads"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'avatars');

create policy "Allow avatar updates"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'avatars');

create policy "Allow public avatar reads"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');

create policy "Allow avatar deletes"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'avatars');

-- ==============================================================================
-- DIRECTIVE 11: THE CURATOR PROFILE & COSMETICS EXPANSION
-- ==============================================================================

alter table public.users add column if not exists dominant_trait text default 'Novice Curator';
alter table public.users add column if not exists equipped_border text default 'default';
alter table public.users add column if not exists equipped_banner text default 'mango_gradient';
alter table public.users add column if not exists equipped_stamp text default 'standard';
alter table public.users add column if not exists current_streak integer default 4;

-- ==============================================================================
-- DIRECTIVE 11 REVISION: COMPOSITE CURATOR SCORE & LIFETIME EARNINGS
-- ==============================================================================

alter table public.users add column if not exists lifetime_earned_kami numeric(12, 2) not null default 0.00;

create or replace function public.claim_kami_rewards(
  p_user_id text,
  p_reward_amount numeric
)
returns json
language plpgsql
security definer
as $$
declare
  v_new_balance numeric;
  v_lifetime_balance numeric;
begin
  insert into public.users (id, kami_balance, total_swipes, lifetime_earned_kami)
  values (p_user_id, p_reward_amount, 0, p_reward_amount)
  on conflict (id) do update
  set
    kami_balance = users.kami_balance + p_reward_amount,
    lifetime_earned_kami = coalesce(users.lifetime_earned_kami, 0) + p_reward_amount,
    updated_at = timezone('utc'::text, now())
  returning kami_balance, lifetime_earned_kami into v_new_balance, v_lifetime_balance;

  return json_build_object(
    'success', true, 
    'new_balance', v_new_balance,
    'lifetime_earned_kami', v_lifetime_balance
  );
end;
$$;

drop view if exists public.curator_leaderboard cascade;

create view public.curator_leaderboard as
select
  u.id,
  u.wallet_address,
  coalesce(u.username, 'Curator_' || substring(u.id from 1 for 6)) as username,
  u.avatar_url,
  coalesce(u.dominant_trait, 'Novice Curator') as dominant_trait,
  coalesce(u.equipped_border, 'default') as equipped_border,
  coalesce(u.equipped_banner, 'mango_gradient') as equipped_banner,
  coalesce(u.equipped_stamp, 'standard') as equipped_stamp,
  coalesce(u.kami_balance, 0) as kami_balance,
  coalesce(u.lifetime_earned_kami, 0) as lifetime_earned_kami,
  coalesce(u.total_swipes, 0) as total_swipes,
  coalesce(u.current_streak, 0) as current_streak,
  coalesce(u.prompts_forged, 0) as prompts_forged,
  coalesce(u.creator_swipes_received, 0) as creator_swipes_received,
  (
    floor(coalesce(u.lifetime_earned_kami, 0) * 100) +
    (coalesce(u.total_swipes, 0) * 10) +
    (coalesce(u.current_streak, 0) * 25) +
    (coalesce(u.creator_swipes_received, 0) * 5) +
    (coalesce(u.prompts_forged, 0) * 15)
  )::integer as curator_score,
  (
    (coalesce(u.creator_swipes_received, 0) * 10) +
    (coalesce(u.prompts_forged, 0) * 25)
  )::integer as architect_score,
  row_number() over (
    order by
      (
        floor(coalesce(u.lifetime_earned_kami, 0) * 100) +
        (coalesce(u.total_swipes, 0) * 10) +
        (coalesce(u.current_streak, 0) * 25) +
        (coalesce(u.creator_swipes_received, 0) * 5) +
        (coalesce(u.prompts_forged, 0) * 15)
      ) desc,
      coalesce(u.lifetime_earned_kami, 0) desc,
      coalesce(u.total_swipes, 0) desc,
      u.created_at asc
  )::integer as global_rank,
  row_number() over (
    order by
      (
        (coalesce(u.creator_swipes_received, 0) * 10) +
        (coalesce(u.prompts_forged, 0) * 25)
      ) desc,
      coalesce(u.creator_swipes_received, 0) desc,
      coalesce(u.prompts_forged, 0) desc,
      u.created_at asc
  )::integer as architect_rank
from public.users u;

grant select on public.curator_leaderboard to anon, authenticated, service_role;
