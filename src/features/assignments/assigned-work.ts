import "server-only";
import { db } from "@/server/db";

export type AssignedWorkRow = {
  assignmentId: string;
  title: string;
  maxScore: number;
  studentId: string;
  studentName: string;
  classId: string;
  classCode: string;
  className: string;
  availableAt: Date;
  /** effective due date (per-student extension wins) */
  dueAt: Date | null;
  /** original due date of the target (before any extension) */
  targetDueAt: Date | null;
  closeAt: Date | null;
  kind: string;
  /** CLOSED = no new attempts, results still visible */
  assignmentStatus: "PUBLISHED" | "CLOSED";
  submissionStatus: "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "NEEDS_REVISION" | "EXCUSED" | null;
  submittedAt: Date | null;
  finalScore: number | null;
  /** latest attempt */
  submissionId: string | null;
  attempts: number;
};

/**
 * Every (published assignment × student it is currently assigned to) pair, with the student's latest attempt.
 * Resolves CLASS / GROUP / STUDENT targets against ACTIVE class membership. Callers must pass ids they are
 * authorised to see (the function itself does not check permissions).
 */
export async function assignedWork(filter: { classIds?: string[]; studentIds?: string[]; assignmentIds?: string[] }): Promise<AssignedWorkRow[]> {
  const classIds = filter.classIds ?? null;
  const studentIds = filter.studentIds ?? null;
  const assignmentIds = filter.assignmentIds ?? null;
  if ((classIds && classIds.length === 0) || (studentIds && studentIds.length === 0) || (assignmentIds && assignmentIds.length === 0)) return [];

  const rows = await db.$queryRaw<
    {
      assignment_id: string;
      title: string;
      max_score: string;
      student_id: string;
      student_name: string;
      class_id: string;
      class_code: string;
      class_name: string;
      available_at: Date;
      due_at: Date | null;
      target_due_at: Date | null;
      close_at: Date | null;
      kind: string;
      assignment_status: "PUBLISHED" | "CLOSED";
      submission_status: AssignedWorkRow["submissionStatus"];
      submitted_at: Date | null;
      final_score: string | null;
      submission_id: string | null;
      attempts: number;
    }[]
  >`
    WITH assigned AS (
      SELECT DISTINCT ON (t.assignment_id, cm.student_id)
             t.assignment_id, cm.student_id, t.class_id, t.available_at,
             COALESCE(ext.new_due_at, t.due_at) AS due_at, t.due_at AS target_due_at, t.close_at
      FROM assignment_targets t
      JOIN assignments a ON a.id = t.assignment_id AND a.status IN ('PUBLISHED', 'CLOSED') AND a.deleted_at IS NULL
      JOIN classes c ON c.id = t.class_id AND c.deleted_at IS NULL
      JOIN class_members cm ON cm.class_id = t.class_id AND cm.status = 'ACTIVE'
      LEFT JOIN class_group_members gm ON t.target_type = 'GROUP' AND gm.group_id = t.group_id AND gm.student_id = cm.student_id
      LEFT JOIN assignment_extensions ext ON ext.assignment_id = t.assignment_id AND ext.student_id = cm.student_id
      WHERE t.available_at <= now()
        AND (
          t.target_type = 'CLASS'
          OR (t.target_type = 'GROUP' AND gm.student_id IS NOT NULL)
          OR (t.target_type = 'STUDENT' AND t.student_id = cm.student_id)
        )
        AND (${classIds}::uuid[] IS NULL OR t.class_id = ANY(${classIds}::uuid[]))
        AND (${studentIds}::uuid[] IS NULL OR cm.student_id = ANY(${studentIds}::uuid[]))
        AND (${assignmentIds}::uuid[] IS NULL OR t.assignment_id = ANY(${assignmentIds}::uuid[]))
      ORDER BY t.assignment_id, cm.student_id, t.available_at DESC
    )
    SELECT x.assignment_id, a.title, a.max_score::text AS max_score,
           x.student_id, u.full_name AS student_name,
           x.class_id, c.code AS class_code, c.name AS class_name,
           x.available_at, x.due_at, x.target_due_at, x.close_at, a.kind::text AS kind, a.status::text AS assignment_status,
           s.status AS submission_status, s.submitted_at, s.final_score::text AS final_score,
           s.id AS submission_id, COALESCE(s.attempt_no, 0)::int AS attempts
    FROM assigned x
    JOIN assignments a ON a.id = x.assignment_id
    JOIN classes c ON c.id = x.class_id
    JOIN students st ON st.id = x.student_id
    JOIN users u ON u.id = st.user_id
    LEFT JOIN LATERAL (
      SELECT id, attempt_no, status, submitted_at, final_score FROM submissions
      WHERE assignment_id = x.assignment_id AND student_id = x.student_id
      ORDER BY attempt_no DESC LIMIT 1
    ) s ON true
    ORDER BY x.due_at NULLS LAST, a.title`;

  return rows.map((r) => ({
    assignmentId: r.assignment_id,
    title: r.title,
    maxScore: Number(r.max_score),
    studentId: r.student_id,
    studentName: r.student_name,
    classId: r.class_id,
    classCode: r.class_code,
    className: r.class_name,
    availableAt: new Date(r.available_at),
    dueAt: r.due_at ? new Date(r.due_at) : null,
    targetDueAt: r.target_due_at ? new Date(r.target_due_at) : null,
    closeAt: r.close_at ? new Date(r.close_at) : null,
    kind: r.kind,
    assignmentStatus: r.assignment_status,
    submissionStatus: r.submission_status,
    submittedAt: r.submitted_at ? new Date(r.submitted_at) : null,
    finalScore: r.final_score === null ? null : Number(r.final_score),
    submissionId: r.submission_id,
    attempts: Number(r.attempts),
  }));
}

/** Still to do: open for work and not handed in (no attempt, in progress, or sent back for revision). */
export function isPending(row: AssignedWorkRow, now: Date = new Date()): boolean {
  if (row.assignmentStatus !== "PUBLISHED") return false;
  if (row.closeAt && row.closeAt <= now) return false;
  return row.submissionStatus === null || row.submissionStatus === "IN_PROGRESS" || row.submissionStatus === "NEEDS_REVISION";
}
