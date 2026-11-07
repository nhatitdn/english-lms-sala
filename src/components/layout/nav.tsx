"use client";

import { BookOpen, Ellipsis, Home, LayoutDashboard, Library, Palette, School, UserRound, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavIcon, NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  users: Users,
  palette: Palette,
  profile: UserRound,
  home: Home,
  classes: School,
  lessons: BookOpen,
  library: Library,
};

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Điều hướng chính" className="grid gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors",
              active ? "bg-sky-100 text-blue-700" : "text-ink hover:bg-sky-50",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // at most 5 slots: when there are more items, the 5th becomes a "Thêm" menu
  const primary = items.length > 5 ? items.slice(0, 4) : items;
  const overflow = items.length > 5 ? items.slice(4) : [];
  const overflowActive = overflow.some((i) => isActive(pathname, i));
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {primary.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium", active ? "text-orange-700" : "text-ink-muted")}
              >
                <Icon className="size-6" />
                {item.label}
              </Link>
            </li>
          );
        })}
        {overflow.length > 0 && (
          <li className="flex-1">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn("flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium", overflowActive ? "text-orange-700" : "text-ink-muted")}>
                <Ellipsis className="size-6" />
                Thêm
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top">
                {overflow.map((item) => {
                  const Icon = ICONS[item.icon];
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href}>
                        <Icon /> {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        )}
      </ul>
    </nav>
  );
}
