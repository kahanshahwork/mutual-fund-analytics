"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/Topbar";
import { Search, Download, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import type { Scheme, SortConfig } from "@/types";

const PAGE_SIZE = 50;

export default function SchemeMasterPage() {
  const supabase = createClient();

  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterAmc, setFilterAmc] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [amcList, setAmcList] = useState<string[]>([]);
  const [categoryList, setCategoryList] = useState<string[]>([]);
  const [sort, setSort] = useState<SortConfig>({ column: "scheme_name", direction: "asc" });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load filter options once
  useEffect(() => {
    async function loadFilterOptions() {
      const { data: amcData } = await supabase
        .from("schemes")
        .select("amc")
        .eq("is_active", true)
        .not("amc", "is", null)
        .order("amc");

      const { data: catData } = await supabase
        .from("schemes")
        .select("category")
        .eq("is_active", true)
        .not("category", "is", null)
        .order("category");

      const uniqueAmcs = [...new Set(amcData?.map((r) => r.amc).filter(Boolean) as string[])];
      const uniqueCats = [...new Set(catData?.map((r) => r.category).filter(Boolean) as string[])];
      setAmcList(uniqueAmcs);
      setCategoryList(uniqueCats);
    }
    loadFilterOptions();
  }, []);

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("schemes")
      .select("*", { count: "exact" })
      .eq("is_active", true)
      .eq("option_type", "Growth")
      .eq("plan_type", "Regular");

    if (debouncedSearch) {
      query = query.ilike("scheme_name", `%${debouncedSearch}%`);
    }
    if (filterAmc) {
      query = query.eq("amc", filterAmc);
    }
    if (filterCategory) {
      query = query.eq("category", filterCategory);
    }

    query = query
      .order(sort.column, { ascending: sort.direction === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (!error) {
      setSchemes(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [debouncedSearch, filterAmc, filterCategory, sort, page]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filterAmc, filterCategory, sort]);

  useEffect(() => {
    fetchSchemes();
  }, [fetchSchemes]);

  function handleSort(column: string) {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  }

  async function handleExport() {
    let query = supabase
      .from("schemes")
      .select("scheme_code, scheme_name, amc, category, plan_type, option_type")
      .eq("is_active", true)
      .eq("option_type", "Growth")
      .eq("plan_type", "Regular")
      .order("scheme_name");

    if (debouncedSearch) query = query.ilike("scheme_name", `%${debouncedSearch}%`);
    if (filterAmc) query = query.eq("amc", filterAmc);
    if (filterCategory) query = query.eq("category", filterCategory);

    const { data } = await query;
    if (!data) return;

    const csv = [
      "Scheme Code,Scheme Name,AMC,Category,Plan,Type",
      ...data.map(
        (r) =>
          `${r.scheme_code},"${r.scheme_name}","${r.amc ?? ""}","${r.category ?? ""}",${r.plan_type},${r.option_type}`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scheme_master.csv";
    a.click();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Scheme Master"
        subtitle={`${total.toLocaleString()} schemes — Regular Growth only`}
        actions={
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
        }
      />

      <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search scheme name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <select
            value={filterAmc}
            onChange={(e) => setFilterAmc(e.target.value)}
            className="px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All AMCs</option>
            {amcList.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Categories</option>
            {categoryList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {(filterAmc || filterCategory || debouncedSearch) && (
            <button
              onClick={() => { setSearch(""); setFilterAmc(""); setFilterCategory(""); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted border-b border-border">
                  <SortableHeader label="Code" column="scheme_code" sort={sort} onSort={handleSort} width="w-20" />
                  <SortableHeader label="Scheme name" column="scheme_name" sort={sort} onSort={handleSort} />
                  <SortableHeader label="AMC" column="amc" sort={sort} onSort={handleSort} width="w-44" />
                  <SortableHeader label="Category" column="category" sort={sort} onSort={handleSort} width="w-40" />
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-20">Plan</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-20">Type</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-3 py-2.5">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : schemes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-12 text-center text-sm text-muted-foreground">
                      No schemes found. Run the Python pipeline to sync data.
                    </td>
                  </tr>
                ) : (
                  schemes.map((scheme) => (
                    <tr
                      key={scheme.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                        {scheme.scheme_code}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-foreground max-w-xs truncate" title={scheme.scheme_name}>
                        {scheme.scheme_name}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[176px]" title={scheme.amc ?? ""}>
                        {scheme.amc ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {scheme.category ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                          {scheme.plan_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                          {scheme.option_type}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              {total > 0
                ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total.toLocaleString()}`
                : "No results"}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-muted-foreground px-2">
                Page {page + 1} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  column,
  sort,
  onSort,
  width,
}: {
  label: string;
  column: string;
  sort: SortConfig;
  onSort: (col: string) => void;
  width?: string;
}) {
  const active = sort.column === column;
  return (
    <th
      onClick={() => onSort(column)}
      className={`px-3 py-2.5 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${width ?? ""}`}
    >
      <span className="flex items-center gap-1">
        {label}
        <ChevronsUpDown size={11} className={active ? "text-foreground" : "opacity-40"} />
      </span>
    </th>
  );
}
