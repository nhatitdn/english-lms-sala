import { ExternalLink, FileText, Image as ImageIcon, Library, Link2, Music, PlaySquare, Search, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/design-system/states";
import { PageHeader } from "@/components/design-system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { AddLinkButton, LibraryUpload, MaterialRowActions } from "@/features/materials/components/library-actions";
import { materialListSchema } from "@/features/materials/schemas";
import { listMaterials } from "@/features/materials/service";
import { formatDate } from "@/lib/datetime";
import { formatBytes } from "@/lib/format";
import { MATERIAL_TYPE_LABELS, SKILL_LABELS } from "@/lib/labels";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Thư viện tài liệu" };

const ICON = { DOCUMENT: FileText, AUDIO: Music, VIDEO: Video, IMAGE: ImageIcon, YOUTUBE: PlaySquare, LINK: Link2 } as const;

export default async function LibraryPage({ searchParams }: PageProps<"/app/library">) {
  const user = await requireRole("ADMIN", "TEACHER");
  const query = materialListSchema.parse(await searchParams);
  const { rows, total, pageCount } = await listMaterials(user, query);
  const pageHref = (page: number) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.skill) p.set("skill", query.skill);
    if (query.type) p.set("type", query.type);
    if (page > 1) p.set("page", String(page));
    return `/app/library${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Thư viện tài liệu" description={`${total} tài liệu · tải lên một lần, đính kèm vào nhiều bài giảng`} actions={<AddLinkButton />} />
      <div className="grid gap-4">
        <LibraryUpload />
        <form className="grid gap-2 sm:grid-cols-[1fr_180px_160px_auto]" role="search">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input name="q" defaultValue={query.q} placeholder="Tìm (không cần gõ dấu): tu vung, family…" className="pl-9" aria-label="Tìm tài liệu" />
          </div>
          <NativeSelect name="skill" defaultValue={query.skill ?? ""} aria-label="Lọc theo kỹ năng">
            <option value="">Mọi kỹ năng</option>
            {Object.entries(SKILL_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="type" defaultValue={query.type ?? ""} aria-label="Lọc theo loại">
            <option value="">Mọi loại</option>
            {Object.entries(MATERIAL_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit">Lọc</Button>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={Library} title={query.q ? "Không tìm thấy tài liệu" : "Thư viện còn trống"} description="Tải file lên hoặc thêm link YouTube để dùng lại trong các bài giảng." />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {rows.map((m) => {
                const Icon = ICON[m.type];
                const canEdit = user.role === "ADMIN" || m.ownerId === user.id;
                const open = m.file ? `/api/files/${m.file.id}` : m.url;
                return (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sky-100 text-blue-700">
                      <Icon className="size-5" />
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate font-medium text-ink">{m.title}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                        {m.skill && <Badge tone="blue">{SKILL_LABELS[m.skill]}</Badge>}
                        {m.tags.map((t) => (
                          <Badge key={t}>#{t}</Badge>
                        ))}
                        <span>
                          {m.file ? formatBytes(Number(m.file.sizeBytes)) : MATERIAL_TYPE_LABELS[m.type]} · {m.owner.fullName} · {formatDate(m.createdAt)} · dùng trong {m._count.attachments} bài
                        </span>
                      </span>
                    </span>
                    {open && (
                      <a href={open} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={`Mở ${m.title}`}>
                        <ExternalLink />
                      </a>
                    )}
                    {canEdit && <MaterialRowActions material={{ id: m.id, title: m.title, description: m.description, skill: m.skill, tags: m.tags, sharedWithTeachers: m.sharedWithTeachers }} />}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
        {pageCount > 1 && (
          <nav className="flex justify-between text-sm" aria-label="Phân trang">
            <span className="text-ink-muted">
              Trang {query.page}/{pageCount}
            </span>
            <span className="flex gap-2">
              {query.page > 1 && (
                <Link href={pageHref(query.page - 1)} className={buttonVariants({ size: "sm" })}>
                  Trước
                </Link>
              )}
              {query.page < pageCount && (
                <Link href={pageHref(query.page + 1)} className={buttonVariants({ size: "sm" })}>
                  Sau
                </Link>
              )}
            </span>
          </nav>
        )}
      </div>
    </>
  );
}
