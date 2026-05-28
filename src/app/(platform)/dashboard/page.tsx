import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { Database, TrendingUp, RefreshCw, CheckCircle } from "lucide-react";

async function getDashboardStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [schemesResult, syncResult, rollingResult] = await Promise.all([
    supabase.from("schemes").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("nav_sync_log").select("*").order("sync_date", { ascending: false }).limit(1).single(),
    supabase.from("rolling_return_metrics").select("id", { count: "exact", head: true }),
  ]);
  return {
    totalSchemes:        schemesResult.count ?? 0,
    rollingMetricsCount: rollingResult.count ?? 0,
    lastSync:            syncResult.data ?? null,
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const stats = await getDashboardStats(supabase);

  const analyticsReady = stats.rollingMetricsCount > 0;
  const lastSyncDate   = stats.lastSync?.sync_date
    ? new Date(stats.lastSync.sync_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Never";

  return (
    <div>
      <Topbar title="Dashboard" subtitle={`Welcome back, ${user?.email}`} />
      <div className="p-6 space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            icon={<Database size={18} className="text-muted-foreground" />}
            label="Total schemes"
            value={stats.totalSchemes > 0 ? stats.totalSchemes.toLocaleString() : "—"}
            sub="Regular Growth only"
          />
          <StatCard
            icon={<RefreshCw size={18} className="text-muted-foreground" />}
            label="Last NAV sync"
            value={lastSyncDate}
            sub={stats.lastSync?.status ?? "No sync yet"}
          />
          <StatCard
            icon={<TrendingUp size={18} className="text-muted-foreground" />}
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
            <ChecklistItem done={analyticsReady} label="Analytics computed — run: npm run mf:nav:full then npm run mf:compute" />
            <ChecklistItem done={false} label="Daily automation scheduled — Windows Task Scheduler → npm run mf:daily" />
          </div>
        </div>

        {/* Daily pipeline */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-foreground mb-1">Daily pipeline</h2>
          <p className="text-xs text-muted-foreground mb-4">Runs automatically every evening. Can also be triggered manually.</p>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center gap-3 bg-muted/40 rounded px-3 py-2">
              <span className="text-muted-foreground w-20">Step 1</span>
              <span className="text-foreground">npm run mf:nav</span>
              <span className="text-muted-foreground ml-auto">Fetch today's NAV → local SQLite</span>
            </div>
            <div className="flex items-center gap-3 bg-muted/40 rounded px-3 py-2">
              <span className="text-muted-foreground w-20">Step 2</span>
              <span className="text-foreground">npm run mf:compute</span>
              <span className="text-muted-foreground ml-auto">Compute analytics → Supabase</span>
            </div>
          </div>
        </div>

        {/* Live pages */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-foreground mb-4">Available pages</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { label: "Fund Overview",    href: "/mutual-funds/fund-overview",  live: true  },
              { label: "CAGR Analytics",   href: "/mutual-funds/cagr",           live: true  },
              { label: "Rolling Returns",  href: "/mutual-funds/rolling-returns", live: true },
              { label: "Scheme Master",    href: "/data/scheme-master",          live: true  },
              { label: "NAV Sync Status",  href: "/data/nav-sync",               live: true  },
              { label: "Category Mapping", href: "/data/category-mapping",       live: true  },
              { label: "SIP Returns",      href: "/mutual-funds/sip-returns",    live: false },
              { label: "Risk Analytics",   href: "/mutual-funds/risk",           live: false },
              { label: "Rankings",         href: "/mutual-funds/rankings",       live: false },
            ].map((item) => (
              <a key={item.href} href={item.href}
                className="flex items-center justify-between px-3 py-2 rounded-md border border-border text-xs hover:bg-accent transition-colors">
                <span className="text-foreground font-medium">{item.label}</span>
                <span className={item.live ? "text-emerald-600" : "text-muted-foreground"}>
                  {item.live ? "Live" : "Soon"}
                </span>
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
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
            <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-current"/>
        )}
      </div>
      <span className={`text-xs ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}
