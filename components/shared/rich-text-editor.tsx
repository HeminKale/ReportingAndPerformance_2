"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Bold, Italic, Underline as UnderlineIcon, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const COLORS = [
  { label: "Default", value: "inherit" },
  { label: "Red", value: "#ef4444" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#22c55e" },
  { label: "Orange", value: "#f97316" },
  { label: "Purple", value: "#a855f7" },
];

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[150px] p-3 focus:outline-none text-sm",
      },
    },
  });

  useEffect(() => {
    if (editor && value === "") {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="rounded-md border">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5 bg-muted/30">
        <Button
          type="button"
          variant={editor.isActive("bold") ? "default" : "ghost"}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "default" : "ghost"}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("underline") ? "default" : "ghost"}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "default" : "ghost"}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </Button>

        {/* Divider */}
        <div className="h-5 w-px bg-border mx-1" />

        {/* Color swatches */}
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            className="h-5 w-5 rounded-full border border-border/50 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ backgroundColor: c.value === "inherit" ? "#374151" : c.value }}
            onClick={() =>
              c.value === "inherit"
                ? editor.chain().focus().unsetColor().run()
                : editor.chain().focus().setColor(c.value).run()
            }
          />
        ))}
      </div>

      {/* Editor area */}
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <p className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground select-none">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
