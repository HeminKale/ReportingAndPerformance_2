"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ScrollableCardListProps {
  children: React.ReactNode[];
  maxHeight?: string;
  className?: string;
}

export function ScrollableCardList({
  children,
  maxHeight = "300px",
  className,
}: ScrollableCardListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down" | null>(null);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setCanScrollUp(scrollTop > 10);
      setCanScrollDown(scrollHeight > clientHeight && scrollTop < scrollHeight - clientHeight - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const current = scrollRef.current;
    if (current) {
      current.addEventListener("scroll", checkScroll);
      return () => current.removeEventListener("scroll", checkScroll);
    }
  }, [children]);

  useEffect(() => {
    let scrollInterval: NodeJS.Timeout;
    if (scrollDirection && scrollRef.current) {
      scrollInterval = setInterval(() => {
        if (scrollRef.current) {
          const step = scrollDirection === "down" ? 4 : -4;
          scrollRef.current.scrollBy({ top: step, behavior: "auto" });
          checkScroll();
        }
      }, 16);
    }
    return () => clearInterval(scrollInterval);
  }, [scrollDirection]);

  return (
    <div className={cn("relative flex flex-col group/scroll", className)}>
      {canScrollUp && (
        <div 
          className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-white/95 via-white/80 to-transparent flex items-start justify-center pt-2 cursor-n-resize pointer-events-auto z-20 opacity-0 group-hover/scroll:opacity-100 transition-opacity"
          onMouseEnter={() => setScrollDirection("up")}
          onMouseLeave={() => setScrollDirection(null)}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md border border-slate-200">
            <ChevronDown className="h-4 w-4 text-slate-500 rotate-180" />
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="overflow-y-hidden scroll-smooth"
        style={{ maxHeight }}
      >
        <div className="flex flex-col gap-3 pb-2 pt-2">
          {children}
        </div>
      </div>
      
      {canScrollDown && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/95 via-white/80 to-transparent flex items-end justify-center pb-2 cursor-s-resize pointer-events-auto z-20 opacity-0 group-hover/scroll:opacity-100 transition-opacity"
          onMouseEnter={() => setScrollDirection("down")}
          onMouseLeave={() => setScrollDirection(null)}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md border border-slate-200">
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      )}
    </div>
  );
}
