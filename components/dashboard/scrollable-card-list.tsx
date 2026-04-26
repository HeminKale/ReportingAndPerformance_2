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
  const [canScroll, setCanScroll] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setCanScroll(scrollHeight > clientHeight && scrollTop < scrollHeight - clientHeight - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [children]);

  useEffect(() => {
    let scrollInterval: NodeJS.Timeout;
    if (isHovering && canScroll && scrollRef.current) {
      scrollInterval = setInterval(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollBy({ top: 3, behavior: "auto" });
          checkScroll();
        }
      }, 16);
    }
    return () => clearInterval(scrollInterval);
  }, [isHovering, canScroll]);

  return (
    <div className={cn("relative flex flex-col", className)}>
      <div
        ref={scrollRef}
        className="overflow-y-hidden"
        style={{ maxHeight }}
        onScroll={checkScroll}
      >
        <div className="flex flex-col gap-3 pb-2">
          {children}
        </div>
      </div>
      
      {canScroll && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white/95 via-white/80 to-transparent flex items-end justify-center pb-2 cursor-s-resize pointer-events-auto"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 shadow-sm border border-slate-200 animate-bounce">
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      )}
    </div>
  );
}
