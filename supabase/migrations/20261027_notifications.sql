-- Papalita Notifications: run in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.customer_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, body text not null, type text not null default 'general',
 url text default '#/notifications', read_at timestamptz, created_at timestamptz not null default now(),
 dedupe_key text unique
);
create index if not exists customer_notifications_user_date on public.customer_notifications(user_id,created_at desc);
alter table public.customer_notifications enable row level security;
drop policy if exists "customer read own notifications" on public.customer_notifications;
create policy "customer read own notifications" on public.customer_notifications for select to authenticated using (user_id=auth.uid());
drop policy if exists "customer update own notifications" on public.customer_notifications;
create policy "customer update own notifications" on public.customer_notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique, p256dh text not null, auth text not null,
 user_agent text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "customer read own push subscription" on public.push_subscriptions;
create policy "customer read own push subscription" on public.push_subscriptions for select to authenticated using (user_id=auth.uid());
drop policy if exists "customer create own push subscription" on public.push_subscriptions;
create policy "customer create own push subscription" on public.push_subscriptions for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "customer update own push subscription" on public.push_subscriptions;
create policy "customer update own push subscription" on public.push_subscriptions for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "customer delete own push subscription" on public.push_subscriptions;
create policy "customer delete own push subscription" on public.push_subscriptions for delete to authenticated using (user_id=auth.uid());

create table if not exists public.customer_vouchers (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 code text not null, description text, expires_at timestamptz not null,
 reminder_sent_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists customer_vouchers_due on public.customer_vouchers(expires_at) where reminder_sent_at is null;
alter table public.customer_vouchers enable row level security;
drop policy if exists "customer read own vouchers" on public.customer_vouchers;
create policy "customer read own vouchers" on public.customer_vouchers for select to authenticated using (user_id=auth.uid());
-- Intentionally no client-side INSERT on vouchers, notifications or push delivery.
-- Admin/server should insert using service role; never expose service role key in GitHub.
