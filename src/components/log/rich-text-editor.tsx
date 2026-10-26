"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Strikethrough } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/format";

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Keep focus in the editor so the selection isn't lost.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded transition",
        active ? "bg-fg text-bg" : "text-muted hover:bg-surface-3 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
    }),
  });
  const chain = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap gap-0.5 border-b border-line p-1">
      <ToolButton label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolButton>
      <ToolButton label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolButton>
      <ToolButton label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </ToolButton>
      <span className="mx-1 w-px self-stretch bg-line" />
      <ToolButton label="Heading" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-4" />
      </ToolButton>
      <ToolButton label="Subheading" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="size-4" />
      </ToolButton>
      <ToolButton label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List className="size-4" />
      </ToolButton>
      <ToolButton label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </ToolButton>
      <ToolButton label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </ToolButton>
      <ToolButton
        label="Link"
        active={state.link}
        onClick={() => {
          if (state.link) {
            chain().unsetLink().run();
            return;
          }
          const url = window.prompt("Link URL");
          if (url) chain().setLink({ href: url.startsWith("http") ? url : `https://${url}` }).run();
        }}
      >
        <Link2 className="size-4" />
      </ToolButton>
    </div>
  );
}

/** Formatted review editor. Writes HTML into a hidden input so it submits with the form. */
export function RichTextEditor({
  name,
  defaultValue,
  placeholder,
}: {
  name: string;
  defaultValue: string | null;
  placeholder: string;
}) {
  const [html, setHtml] = useState(defaultValue ?? "");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder }),
    ],
    content: defaultValue ?? "",
    immediatelyRender: false,
    editorProps: { attributes: { class: "review-content min-h-36 px-4 py-3 text-[15px]" } },
    onUpdate: ({ editor: e }) => setHtml(e.isEmpty ? "" : e.getHTML()),
  });

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-bg focus-within:border-fg/40">
      <input type="hidden" name={name} value={html} />
      {editor ? <Toolbar editor={editor} /> : <div className="h-[41px] border-b border-line" />}
      <EditorContent editor={editor} />
    </div>
  );
}
