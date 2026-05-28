-- ============================================================
-- MF ADVISORY PLATFORM — SUPABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE 1: schemes
-- Master list of all mutual fund schemes (filtered: no IDCW, no Direct)
-- ============================================================
create table if not exists public.schemes (
  id              bigserial primary key,
  scheme_code     integer unique not null,
  scheme_name     text not null,
  amc             text,
  category        text,
  sub_category    text,
  plan_type       text check (plan_type in ('Regular', 'Direct')),
  option_type     text check (option_type in ('Growth', 'IDCW')),
  is_active       boolean default true,
  launch_date     date,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_schemes_amc on public.schemes(amc);
create index if not exists idx_schemes_category on public.schemes(category);
create index if not exists idx_schemes_plan_type on public.schemes(plan_type);
create index if not exists idx_schemes_is_active on public.schemes(is_active);

-- ============================================================
-- TABLE 2: nav_history
-- REMOVED: NAV history is stored locally in pipeline/data/nav.db
-- This keeps Supabase storage under 50MB (free tier)
-- ============================================================

-- ============================================================
-- TABLE 3: rolling_return_metrics
-- Precomputed rolling return statistics — updated daily
-- ============================================================
create table if not exists public.rolling_return_metrics (
  id                      bigserial primary key,
  scheme_code             integer not null references public.schemes(scheme_code) on delete cascade,
  rolling_period_years    integer not null check (rolling_period_years in (1, 3, 5, 7, 10)),
  avg_rolling_return      numeric(8, 4),
  median_rolling_return   numeric(8, 4),
  min_rolling_return      numeric(8, 4),
  max_rolling_return      numeric(8, 4),
  positive_return_pct     numeric(6, 2),
  benchmark_outperform_pct numeric(6, 2),
  consistency_score       numeric(6, 2),
  data_points             integer,
  computed_at             timestamptz default now(),
  unique(scheme_code, rolling_period_years)
);

create index if not exists idx_rolling_scheme on public.rolling_return_metrics(scheme_code);

-- ============================================================
-- TABLE 4: risk_metrics
-- Precomputed risk analytics — updated daily
-- ============================================================
create table if not exists public.risk_metrics (
  id                  bigserial primary key,
  scheme_code         integer not null references public.schemes(scheme_code) on delete cascade,
  period_years        integer not null check (period_years in (1, 3, 5, 10)),
  volatility          numeric(8, 4),
  sharpe_ratio        numeric(8, 4),
  sortino_ratio       numeric(8, 4),
  max_drawdown        numeric(8, 4),
  downside_deviation  numeric(8, 4),
  ulcer_index         numeric(8, 4),
  calmar_ratio        numeric(8, 4),
  computed_at         timestamptz default now(),
  unique(scheme_code, period_years)
);

create index if not exists idx_risk_scheme on public.risk_metrics(scheme_code);

-- ============================================================
-- TABLE 5: sip_metrics
-- Precomputed SIP analytics — updated daily
-- ============================================================
create table if not exists public.sip_metrics (
  id                      bigserial primary key,
  scheme_code             integer not null references public.schemes(scheme_code) on delete cascade,
  sip_period_years        integer not null check (sip_period_years in (1, 3, 5, 7, 10)),
  avg_sip_xirr            numeric(8, 4),
  median_sip_xirr         numeric(8, 4),
  best_sip_xirr           numeric(8, 4),
  worst_sip_xirr          numeric(8, 4),
  positive_sip_pct        numeric(6, 2),
  rolling_sip_consistency numeric(6, 2),
  computed_at             timestamptz default now(),
  unique(scheme_code, sip_period_years)
);

create index if not exists idx_sip_scheme on public.sip_metrics(scheme_code);

-- ============================================================
-- TABLE 6: fund_scores
-- Internal composite scoring — updated daily
-- ============================================================
create table if not exists public.fund_scores (
  id                      bigserial primary key,
  scheme_code             integer not null references public.schemes(scheme_code) on delete cascade unique,
  overall_score           numeric(6, 2),
  rolling_return_score    numeric(6, 2),
  risk_score              numeric(6, 2),
  consistency_score       numeric(6, 2),
  sip_score               numeric(6, 2),
  drawdown_score          numeric(6, 2),
  advisor_preference_boost numeric(6, 2) default 0,
  rank_in_category        integer,
  computed_at             timestamptz default now()
);

create index if not exists idx_scores_overall on public.fund_scores(overall_score desc);
create index if not exists idx_scores_scheme on public.fund_scores(scheme_code);

-- ============================================================
-- TABLE 7: preferred_funds
-- Advisor-marked preferred funds (boost ranking)
-- ============================================================
create table if not exists public.preferred_funds (
  id              bigserial primary key,
  scheme_code     integer not null references public.schemes(scheme_code) on delete cascade,
  advisor_id      uuid references auth.users(id) on delete cascade,
  preference_weight numeric(4, 2) default 1.0 check (preference_weight between 0.5 and 3.0),
  notes           text,
  added_at        timestamptz default now(),
  unique(scheme_code, advisor_id)
);

create index if not exists idx_preferred_advisor on public.preferred_funds(advisor_id);

-- ============================================================
-- TABLE 8: client_profiles
-- Advisor client data for recommendation engine
-- ============================================================
create table if not exists public.client_profiles (
  id                uuid primary key default uuid_generate_v4(),
  advisor_id        uuid not null references auth.users(id) on delete cascade,
  client_name       text not null,
  client_email      text,
  age               integer,
  annual_income     numeric(15, 2),
  tax_bracket       text check (tax_bracket in ('0%', '5%', '10%', '20%', '30%')),
  risk_profile      text check (risk_profile in ('Conservative', 'Moderate', 'Aggressive', 'Very Aggressive')),
  investment_horizon_years integer,
  investment_type   text check (investment_type in ('SIP', 'Lumpsum', 'Both')),
  monthly_sip_amount numeric(15, 2),
  lumpsum_amount    numeric(15, 2),
  goals             jsonb default '[]',
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_clients_advisor on public.client_profiles(advisor_id);

-- ============================================================
-- TABLE 9: client_portfolios
-- Client fund holdings for portfolio analyzer
-- ============================================================
create table if not exists public.client_portfolios (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.client_profiles(id) on delete cascade,
  advisor_id      uuid not null references auth.users(id) on delete cascade,
  scheme_code     integer not null references public.schemes(scheme_code),
  holding_type    text check (holding_type in ('SIP', 'Lumpsum')),
  start_date      date not null,
  monthly_amount  numeric(15, 2),
  lumpsum_amount  numeric(15, 2),
  units_held      numeric(18, 4),
  is_active       boolean default true,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_portfolio_client on public.client_portfolios(client_id);
create index if not exists idx_portfolio_advisor on public.client_portfolios(advisor_id);

-- ============================================================
-- TABLE 10: nav_sync_log
-- Track daily sync status for monitoring page
-- ============================================================
create table if not exists public.nav_sync_log (
  id              bigserial primary key,
  sync_date       date not null,
  schemes_synced  integer default 0,
  schemes_failed  integer default 0,
  nav_rows_added  integer default 0,
  status          text check (status in ('running', 'completed', 'failed')) default 'running',
  error_details   text,
  started_at      timestamptz default now(),
  completed_at    timestamptz
);

create index if not exists idx_sync_log_date on public.nav_sync_log(sync_date desc);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
alter table public.schemes enable row level security;

create policy "Authenticated users can read rolling_return_metrics"
  on public.rolling_return_metrics for select
  to authenticated using (true);

create policy "Authenticated users can read risk_metrics"
  on public.risk_metrics for select
  to authenticated using (true);

create policy "Authenticated users can read sip_metrics"
  on public.sip_metrics for select
  to authenticated using (true);

create policy "Authenticated users can read fund_scores"
  on public.fund_scores for select
  to authenticated using (true);

create policy "Authenticated users can read nav_sync_log"
  on public.nav_sync_log for select
  to authenticated using (true);

-- Preferred funds — advisor sees only their own
create policy "Advisors manage own preferred funds"
  on public.preferred_funds for all
  to authenticated
  using (advisor_id = auth.uid())
  with check (advisor_id = auth.uid());

-- Client profiles — advisor sees only their own clients
create policy "Advisors manage own clients"
  on public.client_profiles for all
  to authenticated
  using (advisor_id = auth.uid())
  with check (advisor_id = auth.uid());

-- Client portfolios — advisor sees only their own
create policy "Advisors manage own portfolios"
  on public.client_portfolios for all
  to authenticated
  using (advisor_id = auth.uid())
  with check (advisor_id = auth.uid());

-- Service role bypass (for Python pipeline writes)
-- The pipeline uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS automatically

-- ============================================================
-- HELPER FUNCTION: updated_at trigger
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_schemes_updated_at
  before update on public.schemes
  for each row execute function public.handle_updated_at();

create trigger set_clients_updated_at
  before update on public.client_profiles
  for each row execute function public.handle_updated_at();

create trigger set_portfolios_updated_at
  before update on public.client_portfolios
  for each row execute function public.handle_updated_at();
