"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { useCallback } from "react";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NashrinoEditorProps {
  content?: string;
  onChange?: (html: string, text: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

/**
 * NashrinoEditor — Tiptap-based rich-text editor for Persian social-media captions.
 *
 * Features:
 * - RTL Persian support (dir="rtl", lang="fa")
 * - Formatting toolbar (bold, italic, H2, lists, quote, code, link)
 * - Character count with limit warning
 * - Markdown shortcuts (type ** for bold, ## for H2, > for quote, etc.)
 * - Link insertion
 * - Undo/redo
 * - Placeholder text
 *
 * Per R4 research: Tiptap is the best choice for نشرینو (headless, ProseMirror-based,
 * excellent RTL support, extensible). Replaces the plain <Textarea>.
 */
export function NashrinoEditor({
  content = "",
  onChange,
  placeholder = "متن کپشن…",
  maxLength = 2200,
  className,
}: NashrinoEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-accent underline underline-offset-2",
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          "cursor-text before:content-[attr(data-placeholder)] before:text-ink-tertiary before:float-right before:h-0",
      }),
      CharacterCount.configure({
        limit: maxLength,
      }),
    ],
    content,
    immediatelyRender: false, // SSR-safe for Next.js
    editorProps: {
      attributes: {
        dir: "rtl",
        lang: "fa",
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "min-h-[200px] px-4 py-3",
          "focus:outline-none",
          "text-[13.5px] leading-relaxed text-ink-primary",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      onChange?.(html, text);
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("لینک را وارد کنید:", previousUrl ?? "https://");

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div className={cn("n-control min-h-[240px] p-4", className)}>
        <div className="animate-pulse space-y-2">
          <div className="h-3 w-3/4 bg-surface-hover rounded" />
          <div className="h-3 w-1/2 bg-surface-hover rounded" />
        </div>
      </div>
    );
  }

  const charCount = editor.storage.characterCount?.characters() ?? 0;
  const wordCount = editor.storage.characterCount?.words() ?? 0;
  const isOverLimit = charCount > maxLength;
  const isNearLimit = charCount > maxLength * 0.9 && !isOverLimit;

  return (
    <div className={cn("n-control overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-1.5 bg-surface-subtle">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          label="ضخیم"
        >
          <Bold className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          label="کج"
        >
          <Italic className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          label="عنوان"
        >
          <Heading2 className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          label="لیست نقطه‌ای"
        >
          <List className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          label="لیست شماره‌دار"
        >
          <ListOrdered className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          label="نقل قول"
        >
          <Quote className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          label="کد"
        >
          <Code className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={setLink} active={editor.isActive("link")} label="لینک">
          <LinkIcon className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          label="برگردان"
        >
          <Undo className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          label="تکرار"
        >
          <Redo className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Footer: character count */}
      <div className="flex items-center justify-between border-t border-border px-3 py-1.5 bg-surface-subtle">
        <span className="text-[10px] text-ink-tertiary">
          {wordCount} واژه
        </span>
        <span
          className={cn(
            "text-[10px] num-tabular font-[600]",
            isOverLimit ? "text-danger" : isNearLimit ? "text-warning" : "text-ink-tertiary",
          )}
        >
          {charCount.toLocaleString("fa-IR")} / {maxLength.toLocaleString("fa-IR")}
        </span>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "n-focus-ring flex size-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-accent-soft text-accent"
          : "text-ink-tertiary hover:bg-surface-hover hover:text-ink-secondary",
        disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
      )}
    >
      {children}
    </button>
  );
}
