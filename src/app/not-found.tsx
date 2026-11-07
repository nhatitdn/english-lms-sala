import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
      <Image src="/brand/flower.png" alt="" width={160} height={156} className="size-20" />
      <h1 className="mt-4 text-2xl font-semibold text-ink">Không tìm thấy trang</h1>
      <p className="mt-2 max-w-sm text-ink-muted">Trang bạn tìm không tồn tại hoặc bạn không có quyền xem.</p>
      <Link href="/" className={`${buttonVariants({ variant: "primary" })} mt-6`}>
        Về trang chủ
      </Link>
    </main>
  );
}
