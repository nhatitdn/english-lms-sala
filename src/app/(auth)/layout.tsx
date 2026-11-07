import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-cream px-4 pt-10 pb-12 sm:justify-center sm:pt-0">
      <Link href="/" aria-label="Về trang chủ Sala English Corner">
        <Image src="/brand/logo-stacked.png" alt="Sala English Corner" width={640} height={317} priority className="h-auto w-56" />
      </Link>
      <div className="mt-6 w-full max-w-sm rounded-lg border border-petal bg-surface p-5 shadow-card sm:p-6">{children}</div>
    </main>
  );
}
