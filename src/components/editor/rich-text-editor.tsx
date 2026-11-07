"use client";

import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Quote, Redo2, Underline, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/components/uploader/upload-file";
import { cn } from "@/lib/utils";

/** fileId-aware image node: the stored JSON keeps the file id; src is derived. */
const FileImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fileId: { default: null },
    };
  },
});

export function RichTextEditor({
  initial,
  onChange,
  placeholder = "Soạn nội dung…",
  allowImages = true,
  minimal = false,
  ariaLabel = "Nội dung",
}: {
  initial: unknown;
  onChange: (json: unknown) => void;
  placeholder?: string;
  allowImages?: boolean;
  minimal?: boolean;
  ariaLabel?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] } }),
      Placeholder.configure({ placeholder }),
      ...(allowImages ? [FileImage.configure({ inline: false, allowBase64: false })] : []),
    ],
    content: (initial as object) ?? "",
    editorProps: { attributes: { class: "rich-text tiptap px-4 py-3", "aria-label": ariaLabel, role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
          }
        : null,
  });

  if (!editor) return <div className="min-h-48 rounded-md border border-line bg-surface" aria-busy />;

  const btn = (label: string, active: boolean | undefined, onClick: () => void, Icon: React.ComponentType<{ className?: string }>) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("grid size-9 place-items-center rounded-sm text-ink hover:bg-sky-100", active && "bg-sky-100 text-blue-700")}
    >
      <Icon className="size-4" />
    </button>
  );

  function setLink() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Dán đường link (https://…). Để trống để bỏ link.", prev ?? "https://");
    if (url === null) return;
    if (!url || url === "https://") editor!.chain().focus().unsetLink().run();
    else editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  async function addImage(file: File) {
    try {
      const up = await uploadFile(file, "lesson-image");
      editor!.chain().focus().setImage({ src: `/api/files/${up.id}`, alt: "" }).updateAttributes("image", { fileId: up.id }).run();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được ảnh.");
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface focus-within:outline-2 focus-within:outline-ring">
      <div className="flex flex-wrap gap-0.5 border-b border-line bg-sky-50/60 p-1" role="toolbar" aria-label="Định dạng">
        {btn("Đậm", state?.bold, () => editor.chain().focus().toggleBold().run(), Bold)}
        {btn("Nghiêng", state?.italic, () => editor.chain().focus().toggleItalic().run(), Italic)}
        {btn("Gạch chân", state?.underline, () => editor.chain().focus().toggleUnderline().run(), Underline)}
        {!minimal && btn("Tiêu đề lớn", state?.h2, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2)}
        {!minimal && btn("Tiêu đề nhỏ", state?.h3, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), Heading3)}
        {btn("Danh sách", state?.bullet, () => editor.chain().focus().toggleBulletList().run(), List)}
        {btn("Danh sách số", state?.ordered, () => editor.chain().focus().toggleOrderedList().run(), ListOrdered)}
        {!minimal && btn("Trích dẫn", state?.quote, () => editor.chain().focus().toggleBlockquote().run(), Quote)}
        {btn("Link", state?.link, setLink, Link2)}
        {allowImages && (
          <label title="Chèn ảnh" className="grid size-9 cursor-pointer place-items-center rounded-sm text-ink hover:bg-sky-100 focus-within:outline-2 focus-within:outline-ring">
            <ImagePlus className="size-4" />
            <span className="sr-only">Chèn ảnh</span>
            <input
              type="file"
              className="sr-only"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void addImage(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
        <span className="ml-auto flex">
          {btn("Hoàn tác", false, () => editor.chain().focus().undo().run(), Undo2)}
          {btn("Làm lại", false, () => editor.chain().focus().redo().run(), Redo2)}
        </span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
