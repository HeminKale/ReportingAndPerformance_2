"use client";

import { useDopamine } from "@/components/dashboard/animation-manager";

export function TaskListItem({ 
  task, 
  log, 
  dotColor 
}: { 
  task: any; 
  log: any; 
  dotColor: string 
}) {
  const { triggerXpGain } = useDopamine();

  const isApproved = log?.verification_status === 'approved';

  const handleClick = (e: React.MouseEvent) => {
    // Simulate XP gain on click if not already completed/approved
    if (!isApproved) {
      triggerXpGain(e.clientX, e.clientY, 10);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className="flex items-center justify-between rounded-2xl bg-white/80 p-4 shadow-sm border border-slate-100 hover:border-blue-100 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-4">
        <div className={`h-3 w-3 rounded-full flex-shrink-0 ${dotColor} group-hover:scale-110 transition-transform`} />
        <div>
          <p className="font-semibold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">{task.title}</p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{task.type} Task</p>
        </div>
      </div>
      {log && (
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ml-2 flex-shrink-0 ${
          isApproved 
            ? 'bg-emerald-100 text-emerald-800'
            : log.verification_status === 'rejected'
            ? 'bg-red-100 text-red-800'
            : log.verification_status === 'recalled'
            ? 'bg-amber-100 text-amber-900'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {log.verification_status}
        </span>
      )}
    </div>
  );
}
