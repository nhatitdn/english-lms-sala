"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/datetime";

export type BellItem = { id: string; title: string; link: string | null; createdAt: string; read: boolean };

export function NotificationBell({ unread, items }: { unread: number; items: BellItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative grid size-11 place-items-center rounded-full text-ink hover:bg-sky-50"
        aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 grid min-w-5 place-items-center rounded-full bg-orange-700 px-1 text-[11px] leading-5 font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Thông báo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-muted">Chưa có thông báo nào.</p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} asChild className="items-start py-2">
              <Link href={n.link ?? "#"}>
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-orange-700"}`} aria-hidden />
                <span className="grid gap-0.5">
                  <span className={n.read ? "text-ink-muted" : "font-medium text-ink"}>{n.title}</span>
                  <span className="text-xs text-ink-muted">{formatDateTime(n.createdAt)}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
