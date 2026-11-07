import Image from "next/image";
import Link from "next/link";
import { BottomNav, SidebarNav } from "@/components/layout/nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/constants";
import { NAV_ITEMS } from "@/lib/navigation";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  const items = NAV_ITEMS[user.role];
  const [unread, latest] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, link: true, createdAt: true, readAt: true },
    }),
  ]);
  const bellItems = latest.map((n) => ({ id: n.id, title: n.title, link: n.link, createdAt: n.createdAt.toISOString(), read: !!n.readAt }));

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[256px_1fr]">
      <div className="hidden border-r border-line bg-surface lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col px-4 py-5">
        <Link href={ROLE_HOME[user.role]} className="mb-6 px-2" aria-label="Sala English Corner — trang tổng quan">
          <Image src="/brand/logo-horizontal.png" alt="Sala English Corner" width={437} height={120} className="h-11 w-auto" priority />
        </Link>
        <SidebarNav items={items} />
        <p className="mt-auto px-3 text-xs text-ink-muted">© Sala English Corner</p>
      </aside>
      </div>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur lg:px-8">
          <Link href={ROLE_HOME[user.role]} className="lg:hidden" aria-label="Sala English Corner">
            <Image src="/brand/logo-horizontal.png" alt="Sala English Corner" width={437} height={120} className="h-9 w-auto" priority />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell unread={unread} items={bellItems} />
            <UserMenu fullName={user.fullName} roleLabel={ROLE_LABELS[user.role]} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}
