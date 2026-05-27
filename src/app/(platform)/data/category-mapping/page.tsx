"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/Topbar";
import { Search, Save, RefreshCw, Tag, AlertCircle, CheckCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryRow {
  raw: string;
  count: number;
  mapped: string;
  edited: boolean;
}

// ─── Preset canonical categories (from blueprint + sync_schemes.py) ───────────

const CANONICAL_CATEGORIES = [
  // Equity
  "Large Cap",
  "Mid Cap",
  "Small Cap",
  "Large & Mid Cap",
  "Multi Cap",
  "Flexi Cap",
  "Focused",
  "ELSS",
  "Dividend Yield",
  "Value/Contra",
  "Thematic",
  "Sectoral",
  // Hybrid
  "Aggressive Hybrid",
  "Conservative Hybrid",
  "Balanced Advantage",
  "Multi Asset Allocation",
  "Equity Savings",
  "Arbitrage",
  // Debt
  "Liquid",
  "Overnight",
  "Ultra Short Duration",
  "Low Duration",
  "Short Duration",
  "Medium Duration",
  "Long Duration",
  "Gilt",
  "Credit Risk",
  "Corporate Bond",
  "Banking and PSU",
  "Dynamic Bond",
  "Floater",
  "Money Market",
  // Others
  "International",
  "Gold",
  "Fund of Funds",
  "Index Fund",
  "ETF",
  "Hybrid",
  "Other",
].sort();

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CategoryMappingPage() {
  const supabase = createClient();

  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [editedCount, setEditedCount] = useState(0);

  const loadCategories = useCallback(async () => {
    setLoading(true);

    // Get all distinct categories and counts from schemes
    const { data } = await supabase
      .from("schemes")
      .select("category")
      .eq("is_active", true)
      .not("category", "is", null);

    if (!data) {
      setLoading(false);
      return;
    }

    // Aggregate counts
    const counts: Record<string, number> = {};
    for (const row of data) {
      const cat = row.category ?? "Unknown";
      counts[cat] = (counts[cat] ?? 0) + 1;
    }

    // Build rows — current value = already mapped (same as raw for now)
    const built: CategoryRow[] = Object.entries(counts)
      .sort((a, b) => b[1] - a[1]) // sort by count desc
      .map(([raw, count]) => ({
        raw,
        count,
        mapped: raw, // can be changed
        edited: false,
      }));

    setRows(built);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    setEditedCount(rows.filter((r) => r.edited).length);
  }, [rows]);

  function handleMappingChange(raw: string, newMapped: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.raw === raw
          ? { ...r, mapped: newMapped, edited: newMapped !== r.raw }
          : r
      )
    );
    setSaveStatus("idle");
  }

  async function handleSave() {
    const edited = rows.filter((r) => r.edited);
    if (!edited.length) return;

    setSaving(true);
    setSaveStatus("idle");

    try {
      // For each edited mapping, update all schemes with the old category
      for (const row of edited) {
        const { error } = await supabase
          .from("schemes")
          .update({ category: row.mapped })
          .eq("category", row.raw)
          .eq("is_active", true);
        if (error) throw error;
      }
      setSaveStatus("saved");
      // Reload
      await loadCategories();
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.raw.toLowerCase().includes(search.toLowerCase()) ||
      r.mapped.toLowerCase().includes(search.toLowerCase())
  );

  const totalSchemes = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Category Mapping"
        subtitle={`${rows.length} categories · ${totalSchemes.toLocaleString()} schemes`}
        actions={
          <div className="flex items-center gap-2">
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle size={12} /> Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle size={12} /> Save failed
              </span>
            )}
            <button
              onClick={loadCategories}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors"
            >
              <RefreshCw size={12} /> Refresh
            </button>
            <button
              onClick={handleSave}
              disabled={saving || editedCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={12} />
              {saving ? "Saving..." : `Save ${editedCount > 0 ? `(${editedCount})` : ""}`}
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2.5">
          <Tag size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800 space-y-0.5">
            <p className="font-medium">Normalize category labels</p>
            <p className="text-blue-700">
              Map raw categories from the MFAPI scheme names to your internal
              canonical labels. Changes update all matching schemes in the
              database. This improves analytics, rankings, and recommendations.
            </p>
          </div>
        </div>

        {/* Search + stats */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Filter categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {editedCount > 0 && (
            <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              {editedCount} unsaved change{editedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-8">
                    #
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Raw Category (from scheme names)
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-24">
                    Schemes
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Map to Canonical Category
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground w-20">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-2.5">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      {rows.length === 0
                        ? "No categories found. Run: npm run mf:schemes"
                        : "No matching categories."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => (
                    <tr
                      key={row.raw}
                      className={`border-b border-border transition-colors ${
                        row.edited ? "bg-amber-50/50" : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-foreground font-mono">
                          {row.raw}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-xs text-muted-foreground">
                          {row.count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={row.mapped}
                          onChange={(e) =>
                            handleMappingChange(row.raw, e.target.value)
                          }
                          className="w-full px-2 py-1 text-xs border border-input rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {/* Keep raw value option if not in canonical list */}
                          {!CANONICAL_CATEGORIES.includes(row.raw) && (
                            <option value={row.raw}>{row.raw} (original)</option>
                          )}
                          {CANONICAL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.edited ? (
                          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                            Modified
                          </span>
                        ) : CANONICAL_CATEGORIES.includes(row.raw) ? (
                          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                            ✓ Canonical
                          </span>
                        ) : (
                          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            Raw
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer stats */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {rows.length} categories shown
            </span>
            <span className="text-xs text-muted-foreground">
              {rows.filter((r) => CANONICAL_CATEGORIES.includes(r.mapped)).length}{" "}
              / {rows.length} mapped to canonical categories
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
