"use client";

export function BadgeImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-10 w-10 object-contain"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
