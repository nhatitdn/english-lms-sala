import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAttempt } from "@/features/assignments/attempt";
import { AttemptClient } from "@/features/assignments/components/attempt-client";
import { AppError } from "@/server/errors";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Làm bài" };

export default async function DoAttemptPage({ params }: PageProps<"/app/do/[submissionId]">) {
  const user = await requireRole("STUDENT");
  const { submissionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) notFound();
  let view;
  try {
    view = await getAttempt(user, submissionId);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  if ("finished" in view) redirect(`/app/submissions/${submissionId}`);
  return <AttemptClient view={view} />;
}
