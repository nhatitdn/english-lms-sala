import Link from "next/link";
import { EmptyState } from "@/components/design-system/states";
import { buttonVariants } from "@/components/ui/button";

/** Shown inside the app shell when a record does not exist or the user may not see it. */
export default function AppNotFound() {
  return (
    <EmptyState
      title="Không tìm thấy trang"
      description="Nội dung không tồn tại hoặc bạn không có quyền xem."
      action={
        <Link href="/app" className={buttonVariants({ variant: "outline" })}>
          Về trang chính
        </Link>
      }
    />
  );
}
