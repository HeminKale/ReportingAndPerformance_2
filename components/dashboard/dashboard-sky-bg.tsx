import { cn } from "@/lib/utils/cn";

interface DashboardSkyBgProps {
  currentHour: number;
}

export function DashboardSkyBg({ currentHour }: DashboardSkyBgProps) {
  const isMorning = currentHour >= 5 && currentHour < 12;
  const isAfternoon = currentHour >= 12 && currentHour < 17;
  const isEvening = currentHour >= 17 && currentHour < 21;
  const isNight = currentHour >= 21 || currentHour < 5;

  return (
    <div className={cn(
      "absolute left-0 top-0 h-[30vh] w-full overflow-hidden transition-colors duration-1000",
      isMorning && "bg-gradient-to-b from-sky-200 via-sky-100 to-orange-100",
      isAfternoon && "bg-gradient-to-b from-blue-400 via-blue-200 to-sky-100",
      isEvening && "bg-gradient-to-b from-indigo-900 via-purple-800 to-orange-400",
      isNight && "bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900"
    )}>
      {/* Decorative elements based on time */}
      
      {/* Sun/Moon */}
      <div className={cn(
        "absolute rounded-full blur-sm transition-all duration-1000",
        isMorning && "bottom-4 left-1/4 h-24 w-24 bg-gradient-to-tr from-yellow-300 to-orange-200 opacity-80",
        isAfternoon && "top-8 left-1/2 h-32 w-32 -translate-x-1/2 bg-gradient-to-tr from-yellow-100 to-yellow-50 opacity-90",
        isEvening && "bottom-0 left-1/3 h-28 w-28 bg-gradient-to-tr from-orange-500 to-red-400 opacity-90",
        isNight && "top-10 right-1/4 h-20 w-20 bg-gradient-to-tr from-slate-100 to-slate-300 opacity-80 shadow-[0_0_40px_rgba(255,255,255,0.3)]"
      )} />

      {/* Clouds / Stars */}
      {isNight ? (
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-screen" />
      ) : (
        <div className="absolute inset-0 overflow-hidden opacity-50">
           {/* Simple CSS clouds using absolute divs */}
           <div className="absolute left-[10%] top-[20%] h-8 w-24 rounded-full bg-white blur-md" />
           <div className="absolute left-[60%] top-[40%] h-12 w-32 rounded-full bg-white blur-md" />
           <div className="absolute left-[80%] top-[10%] h-10 w-28 rounded-full bg-white blur-lg" />
        </div>
      )}
      
      {/* Bottom overlay for smooth blend into content if needed, though card overlaps it */}
      <div className="absolute bottom-0 h-12 w-full bg-gradient-to-t from-background/40 to-transparent" />
    </div>
  );
}
