"use client";

import { ErrorState } from "@/components/design-system/states";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <ErrorState title="Đã có lỗi xảy ra" description="Trang chưa tải được. Vui lòng thử lại; nếu vẫn lỗi, hãy báo cho lớp học." onRetry={reset} />
    </main>
  );
}
