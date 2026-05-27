import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import {
  Database,
  TrendingUp,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

async function getDashboardStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [schemesResult, navResult, syncResult, rollingResult] = await Promise.all([
    supabase.from("schemes").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("nav_history").select("id", { count: "exact", head: true }),
    supabase.from("nav_sync_log").select("*").order("sync_date", { ascending: false }).limit(1).single(),
    supabase.from("rolling_return_metrics").select("id", { count: "exact", head: true }),
  ]);

  return {
    totalSchemes: schemesResult.count ?? 0,
    totalNavRows: navResult.count ?? 0,
    rollingMetricsCount: rollingResult.count ?? 0,
    lastSync: syncResult.data ?? null,
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const stats = await getDashboardStats(supabase);

  const lastSyncStatus = stats.lastSync?.status ?? "No sync yet";
  const lastSyncDate = stats.lastSync?.sync_date
    ? new Date(stats.lastSync.sync_date).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "Never";

  const analyticsReady = stats.rollingMetricsCount > 0;

  return (
    <div>
      <Topbar
        title="Dashboard"
        subtitle={`Welcome back, ${user?.email}`}
      />

      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Database size={18} className="text-muted-foreground" />}
            label="Total schemes"
            value={stats.totalSchemes > 0 ? stats.totalSchemes.toLocaleString() : "—"}
            sub="After filters applied"
          />
          <StatCard
            icon={<RefreshCw size={18} className="text-muted-foreground" />}
            label="Last NAV sync"
            value={lastSyncDate}
            sub={lastSyncStatus}
          />
          <StatCard
            icon={<TrendingUp size={18} className="text-muted-foreground" />}
            label="NAV rows stored"
            value={stats.totalNavRows > 0 ? stats.totalNavRows.toLocaleString() : "—"}
            sub="Historical daily NAVs"
          />
          <StatCard
            icon={<AlertCircle size={18} className="text-muted-foreground" />}
            label="Analytics engine"
            value={analyticsReady ? "Ready" : "Pending"}
            sub={analyticsReady ? `${stats.rollingMetricsCount.toLocaleString()} rolling records` : "Run: npm run mf:compute"}
          />
        </div>

        {/* Setup checklist */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-foreground mb-4">Setup checklist</h2>
          <div className="space-y-3">
            <ChecklistItem done label="Next.js project scaffold" />
            <ChecklistItem done label="Supabase schema created" />
            <ChecklistItem done label="Authentication configured" />
            <ChecklistItem done={stats.totalSchemes > 0} label="Scheme master synced — run: npm run mf:schemes" />
            <ChecklistItem done={stats.totalNavRows > 0} label="NAV history loaded — run: npm run mf:nav" />
            <ChecklistItem done={analyticsReady} label="Analytics computed — run: npm run mf:compute" />
          </div>
        </div>

        {/* Quick links to live pages */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-foreground mb-4">Available analytics</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { label: "Fund Overview", href: "/mutual-funds/fund-overview", ready: true },
              { label: "CAGR Analytics", href: "/mutual-funds/cagr", ready: true },
              { label: "Rolling Returns", href: "/mutual-funds/rolling-returns", ready: true },
              { label: "Scheme Master", href: "/data/scheme-master", ready: true },
              { label: "NAV Sync Status", href: "/data/nav-sync", ready: true },
              { label: "Category Mapping", href: "/data/category-mapping", ready: true },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center justify-between px-3 py-2 rounded-md border border-border text-xs hover:bg-accent transition-colors"
              >
                <span className="text-foreground font-medium">{item.label}</span>
                <span className="text-emerald-600 text-[10px]">Live</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
        {done ? (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
        )}
      </div>
      <span className={`text-xs ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}
