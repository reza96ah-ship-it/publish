"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/jalali";
import * as Lucide from "lucide-react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { PanelHeader, EmptyState } from "./shared";

interface ActionItem {
  id: string;
  type: string;
  title: string;
  iconName: string;
  color: string;
  bg: string;
  border: string;
  time: string;
  isRead: boolean;
}
interface ActionCenterData {
  primary: { id: string; type: string; title: string; context: string; time: string; action: string } | null;
  secondary: ActionItem[];
}

export function ActionCenter() {
  const { data } = useQuery<ActionCenterData>({
    queryKey: ["dashboard-action-center"],
    queryFn: () => api.get<ActionCenterData>("/api/dashboard/action-center"),
    refetchInterval: 30000,
  });

  return (
    <div className="n-card p-5 h-full flex flex-col">
      <PanelHeader
        icon={AlertTriangle}
        title="مرکز اقدام"
        subtitle="موارد نیازمند توجه"
      />

      <div className="flex-1 overflow-y-auto thin-scrollbar -mx-1 px-1 space-y-2">
        {/* Primary critical task */}
        {data?.primary && (
          <div className="relative overflow-hidden rounded-lg border border-danger/20 bg-danger-soft p-3">
            <div className="absolute top-0 right-0 h-full w-[3px] bg-danger" />
            <div className="flex items-start gap-2 mb-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-danger text-white shrink-0">
                <AlertTriangle className="size-3.5" strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-[600] text-ink-primary leading-snug">{data.primary.title}</p>
                {data.primary.context && <p className="text-[11px] text-ink-secondary mt-0.5 leading-snug">{data.primary.context}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[10px] text-ink-tertiary">{relativeTime(new Date(data.primary.time))}</span>
              <button className="inline-flex items-center gap-1 text-[11px] font-[600] text-white bg-danger hover:bg-danger/90 rounded-md px-2.5 py-1 transition-colors">
                {data.primary.action}
                <ArrowLeft className="size-3" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

        {/* Secondary tasks */}
        {data?.secondary.map((item) => {
          const Icon = (Lucide as unknown as Record<string, Lucide.LucideIcon>)[item.iconName] ?? Lucide.Bell;
          return (
            <div
              key={item.id}
              className="n-card-compact flex items-center gap-2.5 p-2.5"
            >
              <span className={`flex size-7 items-center justify-center rounded-md ${item.bg} ${item.color} shrink-0`}>
                <Icon className="size-3.5" strokeWidth={2} />
              </span>
              <p className="flex-1 text-[11.5px] font-[500] text-ink-primary leading-snug">{item.title}</p>
              <span className="text-[10px] text-ink-tertiary shrink-0">{relativeTime(new Date(item.time))}</span>
            </div>
          );
        })}

        {(!data || (!data.primary && data.secondary.length === 0)) && (
          <EmptyState
            icon={Lucide.CheckCircle2}
            title="هیچ اقدام فوری وجود ندارد"
            message="همه چیز روند طبیعی خود را طی می‌کند."
          />
        )}
      </div>
    </div>
  );
}
