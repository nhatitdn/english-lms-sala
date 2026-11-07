"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { duplicateLessonAction } from "../actions";

export function DuplicateLessonButton({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await duplicateLessonAction({ lessonId });
          if (!r.ok) return void toast.error(r.error.message);
          toast.success(r.message);
          router.push(`/app/lessons/${r.data.id}/edit`);
        })
      }
    >
      <Copy /> Sao chép
    </Button>
  );
}
