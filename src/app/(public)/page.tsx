import Image from "next/image";
import Link from "next/link";
import { BookOpenCheck, Headphones, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Temporary public home — the full public website is built in Phase 5. */
export default function HomePage() {
  const features = [
    { icon: Users, title: "Lớp nhỏ, quan tâm từng bạn", text: "Từ thiếu nhi, học sinh đến người lớn." },
    { icon: Headphones, title: "Luyện nghe mọi lúc", text: "Nghe bài trên điện thoại, chỉnh tốc độ, xem transcript." },
    { icon: BookOpenCheck, title: "Bài tập & nhận xét", text: "Làm bài online, xem điểm và nhận xét của giáo viên." },
  ];
  return (
    <main className="min-h-dvh bg-cream">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-5 pt-14 pb-16 text-center sm:pt-20">
        <Image src="/brand/logo-stacked.png" alt="Sala English Corner" width={640} height={317} priority className="h-auto w-72 sm:w-96" />
        <h1 className="mt-8 font-display text-3xl leading-tight font-semibold text-ink sm:text-4xl">
          Học tiếng Anh ấm áp, chỉn chu cho mọi lứa tuổi
        </h1>
        <p className="mt-3 max-w-xl text-ink-muted">
          Website giới thiệu đầy đủ đang được hoàn thiện. Học viên, phụ huynh và giáo viên có thể đăng nhập để vào lớp học.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/dang-nhap" className={buttonVariants({ variant: "primary", size: "lg" })}>
            Đăng nhập lớp học
          </Link>
        </div>
        <ul className="mt-12 grid w-full gap-3 text-left sm:grid-cols-3">
          {features.map((f) => (
            <li key={f.title} className="rounded-lg border border-petal bg-surface p-4">
              <f.icon className="size-6 text-orange-700" aria-hidden />
              <p className="mt-2 font-semibold text-ink">{f.title}</p>
              <p className="text-sm text-ink-muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
