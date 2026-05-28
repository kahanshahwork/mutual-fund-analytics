// ============================================================
// DATABASE TYPES
// ============================================================

export interface Scheme {
  id: number;
  scheme_code: number;
  scheme_name: string;
  amc: string | null;
  category: string | null;
  sub_category: string | null;
  plan_type: "Regular" | "Direct" | null;
  option_type: "Growth" | "IDCW" | null;
  is_active: boolean;
  launch_date: string | null;
  created_at: string;
  updated_at: string;
}

// NavHistory removed — NAV data stored locally in pipeline/data/nav.db

export interface RollingReturnMetrics {
  id: number;
  scheme_code: number;
  rolling_period_years: 1 | 3 | 5 | 7 | 10;
  avg_rolling_return: number | null;
  median_rolling_return: number | null;
  min_rolling_return: number | null;
  max_rolling_return: number | null;
  positive_return_pct: number | null;
  benchmark_outperform_pct: number | null;
  consistency_score: number | null;
  data_points: number | null;
  computed_at: string;
}

export interface RiskMetrics {
  id: number;
  scheme_code: number;
  period_years: 1 | 3 | 5 | 10;
  volatility: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  max_drawdown: number | null;
  downside_deviation: number | null;
  ulcer_index: number | null;
  calmar_ratio: number | null;
  computed_at: string;
}

export interface SipMetrics {
  id: number;
  scheme_code: number;
  sip_period_years: 1 | 3 | 5 | 7 | 10;
  avg_sip_xirr: number | null;
  median_sip_xirr: number | null;
  best_sip_xirr: number | null;
  worst_sip_xirr: number | null;
  positive_sip_pct: number | null;
  rolling_sip_consistency: number | null;
  computed_at: string;
}

export interface FundScore {
  id: number;
  scheme_code: number;
  overall_score: number | null;
  rolling_return_score: number | null;
  risk_score: number | null;
  consistency_score: number | null;
  sip_score: number | null;
  drawdown_score: number | null;
  advisor_preference_boost: number;
  rank_in_category: number | null;
  computed_at: string;
}

export interface PreferredFund {
  id: number;
  scheme_code: number;
  advisor_id: string;
  preference_weight: number;
  notes: string | null;
  added_at: string;
  scheme?: Scheme;
}

export interface ClientProfile {
  id: string;
  advisor_id: string;
  client_name: string;
  client_email: string | null;
  age: number | null;
  annual_income: number | null;
  tax_bracket: "0%" | "5%" | "10%" | "20%" | "30%" | null;
  risk_profile: "Conservative" | "Moderate" | "Aggressive" | "Very Aggressive" | null;
  investment_horizon_years: number | null;
  investment_type: "SIP" | "Lumpsum" | "Both" | null;
  monthly_sip_amount: number | null;
  lumpsum_amount: number | null;
  goals: ClientGoal[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientGoal {
  name: string;
  target_amount: number;
  years_remaining: number;
  priority: "High" | "Medium" | "Low";
}

export interface ClientPortfolio {
  id: string;
  client_id: string;
  advisor_id: string;
  scheme_code: number;
  holding_type: "SIP" | "Lumpsum" | null;
  start_date: string;
  monthly_amount: number | null;
  lumpsum_amount: number | null;
  units_held: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  scheme?: Scheme;
}

export interface NavSyncLog {
  id: number;
  sync_date: string;
  schemes_synced: number;
  schemes_failed: number;
  nav_rows_added: number;
  status: "running" | "completed" | "failed";
  error_details: string | null;
  started_at: string;
  completed_at: string | null;
}

// ============================================================
// UI / FILTER TYPES
// ============================================================

export interface SchemeFilters {
  search: string;
  amc: string;
  category: string;
  planType: string;
}

export interface FundWithMetrics extends Scheme {
  latest_nav?: number;
  nav_date?: string;
  score?: FundScore;
  risk?: RiskMetrics;
}

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  column: string;
  direction: SortDirection;
}
