"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toPersianDigits, relativeTime } from "@/lib/jalali";
import { PlatformIcon, PanelHeader, LinkAction, EmptyState } from "./shared";
import { Radio, AlertTriangle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface PulseJob {
  id: string;
  title: string;
  desc: string;
  platform: string;
  platformName: string;
  status: string;
  type: string;
  schedule: string | null;
  processLabel: string;
  progress: number;
  assignee: string;
  assigneeAvatar: string;
  campaign: string;
  thumbnail: string;
  platformColor: string;
  platformBg: string;
}

export function PublishingPulse() {
  const { data } = useQuery<PulseJob[]>({
    queryKey: ["dashboard-pulse"],
    queryFn: () => api.get<PulseJob[]>("/api/dashboard/pulse"),
    refetchInterval: 10000,
  });
  const setActiveView = useAppStore((s) => s.setActiveView);

  return (
    <div className="n-card p-5 h-full flex flex-col">
      <PanelHeader
        icon={Radio}
        title="نبض انتشار"
        subtitle="وضعیت لحظه‌ای انتشارها"
        action={<LinkAction onClick={() => setActiveView("calendar")}>مشاهده صف ←</LinkAction>}
      />

      <div className="flex-1 overflow-y-auto thin-scrollbar -mx-1 px-1 space-y-1.5">
        {data?.map((job) => (
          <PulseItem key={job.id} job={job} />
        ))}
        {(!data || data.length === 0) && (
          <EmptyState
            icon={Clock3}
            title="هیچ انتشار فعالی وجود ندارد"
            message="انتشارهای در حال انجام و برنامه‌ریزی‌شده اینجا نمایش داده می‌شوند."
          />
        )}
      </div>
    </div>
  );
}

function PulseItem({ job }: { job: PulseJob }) {
  const Icon = job.type === "live" ? RefreshCw : job.type === "action" ? AlertTriangle : job.type === "success" ? CheckCircle2 : Clock3;
  const iconColor = job.type === "live" ? "text-accent" : job.type === "action" ? "text-danger" : job.type === "success" ? "text-success" : "text-info";
  const iconBg = job.type === "live" ? "bg-accent-soft" : job.type === "action" ? "bg-danger-soft" : job.type === "success" ? "bg-success-soft" : "bg-info-soft";

  return (
    <div className="n-card-compact flex items-start gap-2.5 p-2.5">
      {/* thumbnail */}
      <div className="relative shrink-0">
        {job.thumbnail ? (
          <img src={job.thumbnail} alt="" className="size-10 rounded-md object-cover" />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-md bg-surface-hover">
            <PlatformIcon platform={job.platform} className="size-5" />
          </div>
        )}
        <span className={`absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full ${iconBg} ring-2 ring-white`}>
          <Icon className={`size-2.5 ${iconColor} ${job.type === "live" ? "animate-spin" : ""}`} strokeWidth={2.5} />
        </span>
      </div>

      {/* content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <PlatformIcon platform={job.platform} className="size-3.5" />
          <span className="text-[10.5px] font-[500] text-ink-tertiary truncate">{job.platformName}</span>
          <span className={`text-[10px] font-[600] ${iconColor} ms-auto`}>{job.status}</span>
        </div>
        <p className="text-[12.5px] font-[600] text-ink-primary truncate leading-snug">{job.title}</p>
        <p className="text-[11px] text-ink-tertiary truncate leading-tight">{job.campaign}</p>

        {/* progress */}
        {job.type === "live" && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${job.progress}%` }} />
            </div>
            <span className="text-[10px] font-[600] text-ink-secondary num-tabular">{toPersianDigits(job.progress)}٪</span>
          </div>
        )}
        {job.type !== "live" && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-tertiary">
            <Clock3 className="size-2.5" strokeWidth={2} />
            <span>{job.schedule ? relativeTime(new Date(job.schedule)) : job.processLabel}</span>
          </div>
        )}
      </div>

      {/* assignee */}
      {job.assigneeAvatar && (
        <img src={job.assigneeAvatar} alt={job.assignee} title={job.assignee} className="size-6 rounded-full ring-2 ring-white shrink-0" />
      )}
    </div>
  );
}
