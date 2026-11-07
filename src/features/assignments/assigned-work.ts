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
  submissionStatus: "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "NEEDS_REVISION" | "EXCUSED" | null;
  submittedAt: Date | null;
  finalScore: number | null;
};

/**
 * Every (published assignment × student it is currently assigned to) pair, with the student's latest attempt.
 * Resolves CLASS / GROUP / STUDENT targets against ACTIVE class membership. Callers must pass ids they are
 * authorised to see (the function itself does not check permissions).
 */
export async function assignedWork(filter: { classIds?: string[]; studentIds?: string[] }): Promise<AssignedWorkRow[]> {
  const classIds = filter.classIds ?? null;
  const studentIds = filter.studentIds ?? null;
  if ((classIds && classIds.length === 0) || (studentIds && studentIds.length === 0)) return [];

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
      submission_status: AssignedWorkRow["submissionStatus"];
      submitted_at: Date | null;
      final_score: string | null;
    }[]
  >`
    WITH assigned AS (
      SELECT DISTINCT ON (t.assignment_id, cm.student_id)
             t.assignment_id, cm.student_id, t.class_id, t.available_at,
             COALESCE(ext.new_due_at, t.due_at) AS due_at
      FROM assignment_targets t
      JOIN assignments a ON a.id = t.assignment_id AND a.status = 'PUBLISHED' AND a.deleted_at IS NULL
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
      ORDER BY t.assignment_id, cm.student_id, t.available_at DESC
    )
    SELECT x.assignment_id, a.title, a.max_score::text AS max_score,
           x.student_id, u.full_name AS student_name,
           x.class_id, c.code AS class_code, c.name AS class_name,
           x.available_at, x.due_at,
           s.status AS submission_status, s.submitted_at, s.final_score::text AS final_score
    FROM assigned x
    JOIN assignments a ON a.id = x.assignment_id
    JOIN classes c ON c.id = x.class_id
    JOIN students st ON st.id = x.student_id
    JOIN users u ON u.id = st.user_id
    LEFT JOIN LATERAL (
      SELECT status, submitted_at, final_score FROM submissions
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
    submissionStatus: r.submission_status,
    submittedAt: r.submitted_at ? new Date(r.submitted_at) : null,
    finalScore: r.final_score === null ? null : Number(r.final_score),
  }));
}

/** Not yet handed in (no attempt, or still in progress). */
export function isPending(row: AssignedWorkRow): boolean {
  return row.submissionStatus === null || row.submissionStatus === "IN_PROGRESS";
}
