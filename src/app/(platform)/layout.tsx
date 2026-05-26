/**
 * BATCH 2 FIX — dashboard/layout.tsx
 *
 * PROBLEM (Batch 1 bug):
 * The Sidebar + auth guard only wrapped /dashboard/* routes.
 * All other routes (/mutual-funds/*, /portfolio/*, /data/*, /recommendation/*)
 * rendered without the Sidebar and without authentication protection.
 *
 * FIX:
 * Move the Sidebar layout one level UP to the root layout, OR use a
 * Next.js Route Group so all platform pages share the same shell.
 *
 * RECOMMENDED APPROACH — Route Group:
 * Rename this file's parent from `dashboard/` to a route group `(platform)/`
 * and move all platform pages inside it. See MIGRATION GUIDE below.
 *
 * ─────────────────────────────────────────────────────────────
 * MIGRATION GUIDE (one-time refactor)
 * ─────────────────────────────────────────────────────────────
 *
 * Current structure (broken):
 *   src/app/
 *     layout.tsx                   ← root layout (no sidebar)
 *     page.tsx                     ← redirects to /dashboard
 *     dashboard/
 *       layout.tsx                 ← has sidebar + auth (ONLY covers /dashboard/*)
 *       page.tsx
 *     mutual-funds/                ← NO sidebar, NO auth ❌
 *     portfolio/                   ← NO sidebar, NO auth ❌
 *     data/                        ← NO sidebar, NO auth ❌
 *     recommendation/              ← NO sidebar, NO auth ❌
 *
 * Correct structure (fixed):
 *   src/app/
 *     layout.tsx                   ← root layout (unchanged)
 *     page.tsx                     ← redirects to /dashboard
 *     login/
 *       page.tsx                   ← stays outside (no sidebar)
 *     (platform)/                  ← Route Group (no URL segment)
 *       layout.tsx                 ← ← ← THIS FILE (sidebar + auth)
 *       dashboard/
 *         page.tsx
 *       mutual-funds/
 *         fund-overview/page.tsx
 *         ...
 *       portfolio/
 *       data/
 *       recommendation/
 *
 * HOW TO APPLY:
 *   1. Create folder: src/app/(platform)/
 *   2. Move this layout.tsx into src/app/(platform)/layout.tsx
 *   3. Move dashboard/, mutual-funds/, portfolio/, data/, recommendation/
 *      folders into src/app/(platform)/
 *   4. Delete the old src/app/dashboard/layout.tsx
 *   5. URLs are unchanged — (platform) is invisible in the URL.
 *
 * ─────────────────────────────────────────────────────────────
 */

import { Sidebar } from "@/components/layout/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-56">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
