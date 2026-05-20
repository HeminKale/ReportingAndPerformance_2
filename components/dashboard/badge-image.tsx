"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

export function badgeAssetSrc(rankName: string) {
  return `/assets/badges/${rankName}.png`;
}

/** Unrevealed assets use `_unrevealed` (Beginner) or `__unrevealed` (other ranks). */
export function unrevealedBadgeAssetSrc(rankName: string) {
  return rankName === "Beginner"
    ? `/assets/badges/Beginner_unrevealed.png`
    : `/assets/badges/${rankName}__unrevealed.png`;
}

type BadgeImageProps = {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
};

export function BadgeImage({ src, alt, className, fallbackSrc }: BadgeImageProps) {
  const [activeSrc, setActiveSrc] = useState(src);

  return (
    <img
      src={activeSrc}
      alt={alt}
      className={cn("object-contain", className)}
      onError={(e) => {
        if (fallbackSrc && activeSrc !== fallbackSrc) {
          setActiveSrc(fallbackSrc);
          return;
        }
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
