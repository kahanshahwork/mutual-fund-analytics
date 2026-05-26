import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import {
  Database,
  TrendingUp,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

async function getDashboardStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [schemesResult, syncResult] = await Promise.all([
    supabase.from("schemes").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("nav_sync_log").select("*").order("sync_date", { ascending: false }).limit(1).single(),
  ]);

  return {
    totalSchemes: schemesResult.count ?? 0,
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
            label="Analytics engine"
            value="Ready"
            sub="Precomputed metrics"
          />
          <StatCard
            icon={<AlertCircle size={18} className="text-muted-foreground" />}
            label="Data pipeline"
            value="Local"
            sub="Run pipeline to sync"
          />
        </div>

        {/* Setup checklist */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-foreground mb-4">Setup checklist</h2>
          <div className="space-y-3">
            <ChecklistItem done label="Next.js project scaffold" />
            <ChecklistItem done label="Supabase schema created" />
            <ChecklistItem done label="Authentication configured" />
            <ChecklistItem done={stats.totalSchemes > 0} label="Scheme master synced (run the Python pipeline)" />
            <ChecklistItem done={false} label="NAV history loaded (run the Python pipeline)" />
            <ChecklistItem done={false} label="Analytics computed (run compute_metrics.py)" />
          </div>
        </div>

        {/* Pipeline instructions */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-foreground mb-1">Next step — run the data pipeline</h2>
          <p className="text-xs text-muted-foreground mb-4">
            The Python pipeline fetches all schemes and NAV data from mfapi.in and stores them in Supabase.
            Run this once to populate the database, then schedule it daily.
          </p>
          <div className="bg-muted rounded-md p-3 font-mono text-xs text-foreground space-y-1">
            <p className="text-muted-foreground"># Navigate to python pipeline directory</p>
            <p>cd python-pipeline</p>
            <p className="text-muted-foreground mt-2"># Install dependencies</p>
            <p>pip install -r requirements.txt</p>
            <p className="text-muted-foreground mt-2"># Copy and fill in your Supabase credentials</p>
            <p>cp .env.example .env</p>
            <p className="text-muted-foreground mt-2"># Run scheme sync first</p>
            <p>python sync_schemes.py</p>
            <p className="text-muted-foreground mt-2"># Then sync NAV history</p>
            <p>python sync_nav.py</p>
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
  sub: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        {icon}
      </div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-medium text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
          done
            ? "bg-green-500 border-green-500"
            : "border-border bg-background"
        }`}
      >
        {done && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <span className={`text-sm ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
        {label}
      </span>
    </div>
  );
}
