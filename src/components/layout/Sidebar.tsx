"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  RotateCcw,
  PiggyBank,
  Shield,
  ArrowDownCircle,
  GitCompare,
  Trophy,
  Grid3x3,
  Calendar,
  Briefcase,
  Activity,
  PieChart,
  AlertTriangle,
  Waves,
  UserCheck,
  Target,
  Brain,
  Star,
  Users,
  Database,
  RefreshCw,
  Tag,
  ChevronDown,
  ChevronRight,
  TrendingDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    label: "Mutual Fund Analytics",
    icon: <TrendingUp size={16} />,
    items: [
      { label: "Fund Overview", href: "/mutual-funds/fund-overview", icon: <BarChart2 size={14} /> },
      { label: "CAGR Analytics", href: "/mutual-funds/cagr", icon: <TrendingUp size={14} /> },
      { label: "Rolling Returns", href: "/mutual-funds/rolling-returns", icon: <RotateCcw size={14} /> },
      { label: "SIP Returns", href: "/mutual-funds/sip-returns", icon: <PiggyBank size={14} /> },
      { label: "Risk Analytics", href: "/mutual-funds/risk", icon: <Shield size={14} /> },
      { label: "Drawdown Analysis", href: "/mutual-funds/drawdown", icon: <ArrowDownCircle size={14} /> },
      { label: "Fund Comparison", href: "/mutual-funds/comparison", icon: <GitCompare size={14} /> },
      { label: "Rankings", href: "/mutual-funds/rankings", icon: <Trophy size={14} /> },
      { label: "Category Analytics", href: "/mutual-funds/category", icon: <Grid3x3 size={14} /> },
      { label: "Calendar Returns", href: "/mutual-funds/calendar", icon: <Calendar size={14} /> },
    ],
  },
  {
    label: "Portfolio Analyzer",
    icon: <Briefcase size={16} />,
    items: [
      { label: "Portfolio Dashboard", href: "/portfolio/dashboard", icon: <LayoutDashboard size={14} /> },
      { label: "Performance", href: "/portfolio/performance", icon: <Activity size={14} /> },
      { label: "Allocation Analysis", href: "/portfolio/allocation", icon: <PieChart size={14} /> },
      { label: "Risk Analysis", href: "/portfolio/risk", icon: <AlertTriangle size={14} /> },
      { label: "Drawdowns", href: "/portfolio/drawdowns", icon: <TrendingDown size={14} /> },
    ],
  },
  {
    label: "Recommendation Engine",
    icon: <Brain size={16} />,
    items: [
      { label: "Client Profiling", href: "/recommendation/profiling", icon: <UserCheck size={14} /> },
      { label: "Goal Planning", href: "/recommendation/goals", icon: <Target size={14} /> },
      { label: "Risk Profiling", href: "/recommendation/risk-profiling", icon: <Waves size={14} /> },
      { label: "Fund Recommendation", href: "/recommendation/recommendations", icon: <Brain size={14} /> },
      { label: "Preferred Funds", href: "/recommendation/preferred-funds", icon: <Star size={14} /> },
    ],
  },
  {
    label: "Data Management",
    icon: <Database size={16} />,
    items: [
      { label: "Scheme Master", href: "/data/scheme-master", icon: <Database size={14} /> },
      { label: "NAV Sync Status", href: "/data/nav-sync", icon: <RefreshCw size={14} /> },
      { label: "Category Mapping", href: "/data/category-mapping", icon: <Tag size={14} /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [openGroups, setOpenGroups] = useState<string[]>([
    "Mutual Fund Analytics",
  ]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-sidebar border-r border-sidebar-border flex flex-col z-30">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M3 14L7 6L11 11L14 8L17 14H3Z" fill="hsl(var(--sidebar-background))" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-sidebar-primary leading-none">MF Advisory</p>
            <p className="text-[10px] text-sidebar-foreground/50 leading-none mt-0.5">Platform</p>
          </div>
        </div>
      </div>

      {/* Dashboard link */}
      <div className="px-2 pt-3 pb-1">
        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
            pathname === "/dashboard"
              ? "bg-sidebar-accent text-sidebar-primary font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-primary"
          }`}
        >
          <LayoutDashboard size={15} />
          Dashboard
        </Link>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {navigation.map((group) => {
          const isOpen = openGroups.includes(group.label);
          const isGroupActive = group.items.some((item) =>
            pathname.startsWith(item.href)
          );

          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors mt-1 ${
                  isGroupActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  {group.icon}
                  {group.label}
                </span>
                {isOpen ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
              </button>

              {isOpen && (
                <div className="ml-3 pl-3 border-l border-sidebar-border space-y-0.5 mt-0.5 mb-1">
                  {group.items.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-primary"
                        }`}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User / Logout */}
      <div className="px-2 pb-3 border-t border-sidebar-border pt-3 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
        >
          <Users size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
