/**
 * Rich text is stored as Tiptap/ProseMirror JSON and passed through this allow-list on the server
 * before saving. Anything unknown (scripts, iframes, raw HTML, style attributes…) is dropped.
 * Rendering (RichTextRenderer) only knows these same node types — XSS is impossible by construction.
 */

export type RTMark = { type: "bold" | "italic" | "underline" | "strike" | "code" | "link"; attrs?: { href: string } };
export type RTNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RTNode[];
  text?: string;
  marks?: RTMark[];
};
export type RTDoc = { type: "doc"; content: RTNode[] };

const BLOCKS = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "horizontalRule", "hardBreak", "image", "text"]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NODES = 5000;
const MAX_TEXT = 20_000;

export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const v = href.trim();
  if (/^(https?:\/\/|mailto:)/i.test(v) && v.length <= 2000) return v;
  return null;
}

export function sanitizeRichText(input: unknown): { doc: RTDoc; fileIds: string[] } {
  const fileIds = new Set<string>();
  let count = 0;

  function node(n: unknown, depth: number): RTNode | null {
    if (!n || typeof n !== "object" || depth > 12 || ++count > MAX_NODES) return null;
    const src = n as RTNode;
    if (!BLOCKS.has(src.type)) return null;
    if (src.type === "text") {
      if (typeof src.text !== "string" || src.text.length === 0) return null;
      const marks = (Array.isArray(src.marks) ? src.marks : [])
        .filter((m) => m && MARKS.has(m.type))
        .map((m): RTMark | null => {
          if (m.type !== "link") return { type: m.type };
          const href = safeHref(m.attrs?.href);
          return href ? { type: "link", attrs: { href } } : null;
        })
        .filter((m): m is RTMark => m !== null);
      return { type: "text", text: src.text.slice(0, MAX_TEXT), ...(marks.length ? { marks } : {}) };
    }
    if (src.type === "image") {
      const fileId = src.attrs?.fileId;
      if (typeof fileId !== "string" || !UUID.test(fileId)) return null;
      fileIds.add(fileId.toLowerCase());
      const alt = typeof src.attrs?.alt === "string" ? src.attrs.alt.slice(0, 200) : "";
      return { type: "image", attrs: { fileId: fileId.toLowerCase(), src: `/api/files/${fileId.toLowerCase()}`, alt } };
    }
    if (src.type === "horizontalRule" || src.type === "hardBreak") return { type: src.type };
    const out: RTNode = { type: src.type };
    if (src.type === "heading") {
      const level = Number(src.attrs?.level);
      out.attrs = { level: level >= 2 && level <= 4 ? level : 2 };
    }
    if (src.type === "orderedList") {
      const start = Number(src.attrs?.start);
      if (Number.isInteger(start) && start > 1 && start < 1000) out.attrs = { start };
    }
    const children = (Array.isArray(src.content) ? src.content : []).map((c) => node(c, depth + 1)).filter((c): c is RTNode => c !== null);
    if (children.length) out.content = children;
    return out;
  }

  const root = input as RTDoc | null;
  const content = root && root.type === "doc" && Array.isArray(root.content) ? root.content.map((c) => node(c, 1)).filter((c): c is RTNode => c !== null) : [];
  return { doc: { type: "doc", content }, fileIds: [...fileIds] };
}

/** Plain text (for search snippets / previews). */
export function richTextToPlain(doc: unknown, max = 300): string {
  const parts: string[] = [];
  function walk(n: RTNode) {
    if (n.type === "text" && n.text) parts.push(n.text);
    n.content?.forEach(walk);
    if (n.type === "paragraph" || n.type === "heading") parts.push(" ");
  }
  if (doc && typeof doc === "object") walk(doc as RTNode);
  return parts.join("").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Simple doc from plain text (paragraph per line) — used for transcripts typed as plain text. */
export function plainToRichText(text: string): RTDoc {
  const content = text
    .split(/\r?\n/)
    .map((line): RTNode => (line.trim() ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" }));
  return { type: "doc", content };
}
