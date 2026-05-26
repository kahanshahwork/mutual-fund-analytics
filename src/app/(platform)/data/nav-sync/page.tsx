import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import type { NavSyncLog } from "@/types";

export default async function NavSyncPage() {
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("nav_sync_log")
    .select("*")
    .order("sync_date", { ascending: false })
    .limit(30);

  const { count: totalNav } = await supabase
    .from("nav_history")
    .select("id", { count: "exact", head: true });

  const { count: totalSchemes } = await supabase
    .from("schemes")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const lastLog = logs?.[0] ?? null;

  return (
    <div>
      <Topbar title="NAV Sync Status" subtitle="Data pipeline monitoring" />
      <div className="p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total NAV rows" value={totalNav?.toLocaleString() ?? "0"} />
          <StatCard label="Active schemes" value={totalSchemes?.toLocaleString() ?? "0"} />
          <StatCard
            label="Last sync date"
            value={
              lastLog
                ? new Date(lastLog.sync_date).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })
                : "Never"
            }
          />
          <StatCard
            label="Last sync status"
            value={lastLog?.status ?? "No syncs yet"}
            valueClass={
              lastLog?.status === "completed"
                ? "text-green-600"
                : lastLog?.status === "failed"
                ? "text-red-600"
                : "text-muted-foreground"
            }
          />
        </div>

        {/* Sync log table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Sync history</h2>
            <span className="text-xs text-muted-foreground">Last 30 syncs</span>
          </div>
          {!logs || logs.length === 0 ? (
            <div className="py-16 text-center">
              <RefreshCw size={24} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No syncs yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Run sync_nav.py to start populating data.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Schemes synced</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">NAV rows added</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Failed</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Started</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: NavSyncLog) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2.5 text-xs text-foreground">
                      {new Date(log.sync_date).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right text-foreground">
                      {log.schemes_synced.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right text-foreground">
                      {log.nav_rows_added.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right text-red-600">
                      {log.schemes_failed > 0 ? log.schemes_failed : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(log.started_at).toLocaleTimeString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-medium ${valueClass ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircle size={11} /> Completed
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <XCircle size={11} /> Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
      <Clock size={11} /> Running
    </span>
  );
}
