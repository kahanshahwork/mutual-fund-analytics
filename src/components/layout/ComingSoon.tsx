import { Topbar } from "@/components/layout/Topbar";
import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  subtitle?: string;
  batch?: string;
}

export function ComingSoon({ title, subtitle, batch }: ComingSoonProps) {
  return (
    <div>
      <Topbar title={title} subtitle={subtitle} />
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <Construction size={22} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {batch ? `Coming in ${batch}` : "Coming soon"}
          </p>
        </div>
      </div>
    </div>
  );
}
