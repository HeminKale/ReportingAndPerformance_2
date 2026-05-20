"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

interface ProfilePhotoUploadProps {
  userId: string;
  isTopPerformer: boolean;
  initialPhotoUrl: string;
  /** The storage path stored in users.avatar_url, if any (e.g. "profile-photos/user-id/avatar"). */
  storagePath: string | null;
  userName: string;
}

export function ProfilePhotoUpload({
  userId,
  isTopPerformer,
  initialPhotoUrl,
  storagePath,
  userName,
}: ProfilePhotoUploadProps) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [currentPath, setCurrentPath] = useState(storagePath);
  const [uploading, setUploading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const BUCKET = "employee-documents";

  const handleClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected
    e.target.value = "";

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `profile-photos/${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Generate a fresh 7-day signed URL for immediate display
      const { data: signedData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      // Persist the storage path (not the expiring URL) in users.avatar_url
      await supabase
        .from("users")
        .update({ avatar_url: path })
        .eq("id", userId);

      setCurrentPath(path);
      if (signedData?.signedUrl) setPhotoUrl(signedData.signedUrl);
    } catch {
      // silently fail — existing photo stays visible
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentPath) return;
    setUploading(true);
    try {
      await supabase.storage.from(BUCKET).remove([currentPath]);
      await supabase
        .from("users")
        .update({ avatar_url: null })
        .eq("id", userId);
      setCurrentPath(null);
      setPhotoUrl(
        `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(userName)}&backgroundColor=e2e8f0`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="absolute top-0 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 z-20">
      {/* Avatar circle */}
      <div
        className="relative h-full w-full cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
      >
        <div className="h-full w-full overflow-hidden rounded-full border-[4px] border-white bg-slate-100 shadow-xl backdrop-blur-sm">
          <img
            src={photoUrl}
            alt="Profile"
            className={cn(
              "h-full w-full object-cover transition-opacity duration-200",
              (hovered || uploading) && "opacity-60"
            )}
          />
        </div>

        {/* Hover overlay */}
        {(hovered || uploading) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full">
            {uploading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Camera className="h-7 w-7 text-white drop-shadow-md" />
            )}
          </div>
        )}

        {/* Remove button — shown on hover when a real photo exists */}
        {hovered && currentPath && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -bottom-1 -right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white shadow-md hover:bg-rose-600 transition-colors"
            title="Remove photo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
