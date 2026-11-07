"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { createGroupAction, deleteGroupAction, setGroupMembersAction } from "../actions";
import { useRunAction } from "./use-action";

type Group = { id: string; name: string; members: { studentId: string }[] };
type Member = { studentId: string; name: string };

export function GroupsManager({ classId, groups, members }: { classId: string; groups: Group[]; members: Member[] }) {
  const { pending, run } = useRunAction();
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      {groups.length === 0 && <p className="text-sm text-ink-muted">Nhóm dùng để giao bài cho một phần lớp (giai đoạn 3).</p>}
      {groups.map((g) => {
        const open = openId === g.id;
        return (
          <div key={g.id} className="rounded-md border border-line">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <button type="button" className="text-left font-medium text-ink" onClick={() => setOpenId(open ? null : g.id)} aria-expanded={open}>
                {g.name} <span className="text-sm font-normal text-ink-muted">· {g.members.length} học viên</span>
              </button>
              <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(() => deleteGroupAction({ classId, groupId: g.id }))} aria-label={`Xóa nhóm ${g.name}`}>
                <Trash2 />
              </Button>
            </div>
            {open && (
              <form
                className="grid gap-2 border-t border-line p-3"
                action={(fd) => {
                  fd.set("classId", classId);
                  fd.set("groupId", g.id);
                  run(() => setGroupMembersAction(fd), () => setOpenId(null));
                }}
              >
                <div className="grid gap-1 sm:grid-cols-2">
                  {members.map((m) => (
                    <label key={m.studentId} className="flex min-h-9 items-center gap-2 text-sm">
                      <Checkbox name="studentIds" value={m.studentId} defaultChecked={g.members.some((x) => x.studentId === m.studentId)} />
                      {m.name}
                    </label>
                  ))}
                </div>
                <Button type="submit" size="sm" variant="secondary" loading={pending} className="justify-self-end">
                  Lưu nhóm
                </Button>
              </form>
            )}
          </div>
        );
      })}
      <form
        className="grid gap-2"
        action={() => run(() => createGroupAction({ classId, name }), () => setName(""))}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Nhóm A" aria-label="Tên nhóm mới" />
        <Button type="submit" variant="outline" disabled={!name.trim()}>
          <Plus /> Tạo nhóm
        </Button>
      </form>
    </div>
  );
}
