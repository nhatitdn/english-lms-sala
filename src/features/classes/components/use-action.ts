"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/action";

/** Run a server action, toast the result, refresh the page on success. */
export function useRunAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run<T>(fn: () => Promise<ActionResult<T>>, onOk?: (data: T) => void) {
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      if (r.message) toast.success(r.message);
      onOk?.(r.data);
      router.refresh();
    });
  }
  return { pending, run };
}
