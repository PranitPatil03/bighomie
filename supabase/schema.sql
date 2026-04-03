-- Big Homie core schema + RLS
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.generate_referral_code(base_name text, user_id uuid)
returns text
language plpgsql
as $$
declare
  clean text;
  candidate text;
  i int := 0;
begin
  clean := regexp_replace(upper(coalesce(base_name, 'HOMIE')), '[^A-Z0-9]', '', 'g');
  clean := substring(clean from 1 for 6);

  if clean is null or clean = '' then
    clean := 'HOMIE';
  end if;

  loop
    if i = 0 then
      candidate := clean || substring(replace(user_id::text, '-', '') from 1 for 4);
    else
      candidate := clean || lpad((floor(random() * 10000))::int::text, 4, '0');
    end if;

    exit when not exists(select 1 from public.profiles p where p.referral_code = candidate);
    i := i + 1;
    if i > 20 then
      candidate := clean || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4);
      exit;
    end if;
  end loop;

  return candidate;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  goal text,
  is_vet boolean default false,
  referral_code text unique not null,
  referral_code_used text,
  referred_by uuid references public.profiles(id),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  stripe_connect_account_id text,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'pro_monthly', 'pro_annual')),
  pro_status text default 'inactive' check (pro_status in ('inactive', 'active', 'canceled')),
  checkin_credits integer not null default 0,
  onboarding_completed_at timestamptz,
  last_checkin_payment_at timestamptz,
  last_checkin_completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.checkins (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_text text not null,
  summary_json jsonb,
  transaction_count integer,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_checkins_user_created on public.checkins(user_id, created_at desc);

create table if not exists public.referrals (
  id bigserial primary key,
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null references public.profiles(id) on delete cascade,
  referral_code text,
  amount_cents integer not null default 100,
  status text not null default 'pending' check (status in ('pending', 'available', 'paid')),
  pending_until timestamptz,
  paid_at timestamptz,
  stripe_transfer_id text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (referred_user_id)
);

create index if not exists idx_referrals_referrer on public.referrals(referrer_user_id, status, created_at desc);
create index if not exists idx_referrals_pending on public.referrals(status, pending_until);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name text;
  raw_referral text;
  generated text;
begin
  full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
  raw_referral := upper(coalesce(new.raw_user_meta_data->>'referral_code_used', ''));

  generated := public.generate_referral_code(full_name, new.id);

  insert into public.profiles (
    id,
    full_name,
    referral_code,
    referral_code_used
  ) values (
    new.id,
    full_name,
    generated,
    nullif(raw_referral, '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.checkins enable row level security;
alter table public.referrals enable row level security;

-- profiles policies
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- checkins policies
create policy "checkins_select_own"
on public.checkins
for select
to authenticated
using (auth.uid() = user_id);

create policy "checkins_insert_own"
on public.checkins
for insert
to authenticated
with check (auth.uid() = user_id);

-- referrals policies
create policy "referrals_select_related"
on public.referrals
for select
to authenticated
using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);
