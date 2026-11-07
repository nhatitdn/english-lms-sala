import * as React from "react";
import type { RTMark, RTNode } from "@/features/rich-text/sanitize";
import { safeHref } from "@/features/rich-text/sanitize";
import { cn } from "@/lib/utils";

/** Renders sanitised rich-text JSON with React elements only (no dangerouslySetInnerHTML). */
export function RichTextRenderer({ doc, className }: { doc: unknown; className?: string }) {
  const root = doc as { type?: string; content?: RTNode[] } | null;
  if (!root || root.type !== "doc" || !root.content?.length) return null;
  return <div className={cn("rich-text", className)}>{root.content.map((n, i) => render(n, i))}</div>;
}

function withMarks(text: string, marks: RTMark[] | undefined, key: React.Key): React.ReactNode {
  let el: React.ReactNode = text;
  for (const m of marks ?? []) {
    if (m.type === "bold") el = <strong>{el}</strong>;
    else if (m.type === "italic") el = <em>{el}</em>;
    else if (m.type === "underline") el = <u>{el}</u>;
    else if (m.type === "strike") el = <s>{el}</s>;
    else if (m.type === "code") el = <code>{el}</code>;
    else if (m.type === "link") {
      const href = safeHref(m.attrs?.href);
      if (href) el = <a href={href} target="_blank" rel="noopener noreferrer nofollow">{el}</a>;
    }
  }
  return <React.Fragment key={key}>{el}</React.Fragment>;
}

function render(n: RTNode, key: React.Key): React.ReactNode {
  const kids = n.content?.map((c, i) => render(c, i));
  switch (n.type) {
    case "text":
      return withMarks(n.text ?? "", n.marks, key);
    case "paragraph":
      return <p key={key}>{kids}</p>;
    case "heading": {
      const level = Number(n.attrs?.level) || 2;
      const Tag = (level === 3 ? "h3" : level === 4 ? "h4" : "h2") as "h2";
      return <Tag key={key}>{kids}</Tag>;
    }
    case "bulletList":
      return <ul key={key}>{kids}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={typeof n.attrs?.start === "number" ? n.attrs.start : undefined}>
          {kids}
        </ol>
      );
    case "listItem":
      return <li key={key}>{kids}</li>;
    case "blockquote":
      return <blockquote key={key}>{kids}</blockquote>;
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    case "image": {
      const fileId = typeof n.attrs?.fileId === "string" ? n.attrs.fileId : null;
      if (!fileId) return null;
      // eslint-disable-next-line @next/next/no-img-element -- authenticated file URL, not optimisable
      return <img key={key} src={`/api/files/${fileId}`} alt={typeof n.attrs?.alt === "string" ? n.attrs.alt : ""} loading="lazy" />;
    }
    default:
      return null;
  }
}
