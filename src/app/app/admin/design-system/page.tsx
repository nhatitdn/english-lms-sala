import { Headphones, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { DialogDemo, ErrorStateDemo, ToastDemo } from "@/components/design-system/showcase-interactive";
import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState, Spinner } from "@/components/design-system/states";
import { StatCard } from "@/components/design-system/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Avatar, Skeleton } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Design system" };

const COLORS = [
  ["sala-orange", "#FA7220", "Logo, trang trí lớn"],
  ["orange-700", "#C2410C", "Nút chính, CTA"],
  ["orange-50", "#FFF1E6", "Nền nhấn cam"],
  ["cream", "#FFF8EE", "Nền website công khai"],
  ["petal", "#F3EBCF", "Trang trí"],
  ["gold", "#C9A646", "Sao, huy hiệu"],
  ["ink", "#1F2A44", "Chữ chính"],
  ["ink-muted", "#526075", "Chữ phụ"],
  ["sky-50", "#EEF5FC", "Nền LMS"],
  ["sky-100", "#DCEBFA", "Mục đang chọn"],
  ["blue-600", "#2563EB", "Link, focus"],
  ["success", "#15803D", "Đúng, có mặt"],
  ["warning", "#B45309", "Muộn"],
  ["danger", "#B91C1C", "Quá hạn, lỗi"],
] as const;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function DesignSystemPage() {
  await requireRole("ADMIN");
  return (
    <>
      <PageHeader title="Design system" description="Bộ thành phần giao diện dùng chung của Sala English Corner." />
      <div className="grid gap-4">
        <Section title="Logo">
          <div className="flex flex-wrap items-center gap-6">
            <Image src="/brand/logo-horizontal.png" alt="Logo ngang" width={437} height={120} className="h-12 w-auto" />
            <div className="rounded-md bg-ink p-3">
              <Image src="/brand/logo-horizontal-on-dark.png" alt="Logo ngang trên nền tối" width={437} height={120} className="h-12 w-auto" />
            </div>
            <Image src="/brand/icon-192.png" alt="Icon ứng dụng" width={192} height={192} className="size-14 rounded-lg" />
          </div>
        </Section>

        <Section title="Màu sắc" description="Chữ trên nền đều đạt chuẩn tương phản WCAG AA.">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {COLORS.map(([name, hex, use]) => (
              <li key={name} className="overflow-hidden rounded-md border border-line">
                <div className="h-14" style={{ background: `var(--${name})` }} />
                <div className="p-2 text-xs">
                  <p className="font-semibold text-ink">{name}</p>
                  <p className="text-ink-muted">{hex}</p>
                  <p className="text-ink-muted">{use}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Chữ">
          <div className="grid gap-3">
            <p className="font-display text-5xl leading-[56px] font-semibold text-ink">Học tiếng Anh mỗi ngày</p>
            <p className="font-display text-4xl font-semibold text-ink">Playfair Display — tiêu đề website</p>
            <p className="text-2xl font-semibold text-ink">Be Vietnam Pro 24 — tiêu đề trang</p>
            <p className="text-xl font-semibold text-ink">Be Vietnam Pro 20 — tiêu đề khối</p>
            <p className="text-lg text-ink">Bài đọc 18px: The quick brown fox jumps over the lazy dog.</p>
            <p className="text-ink">Thân bài 16px: Tiếng Việt có dấu hiển thị rõ ràng — ă â đ ê ô ơ ư ạ ả ã ấ ầ ẩ ẫ ậ.</p>
            <p className="text-sm text-ink-muted">Chữ phụ 14px</p>
            <p className="text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">Nhãn in hoa 12px</p>
          </div>
        </Section>

        <Section title="Nút" description="Mỗi màn hình chỉ một nút Primary.">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Xóa</Button>
            <Button variant="link">Link</Button>
            <Button variant="primary" loading>
              Đang lưu
            </Button>
            <Button variant="outline" size="sm">
              Nhỏ
            </Button>
            <Button variant="primary" size="lg">
              Lớn
            </Button>
            <Button variant="outline" size="icon" aria-label="Nghe">
              <Headphones />
            </Button>
          </div>
        </Section>

        <Section title="Ô nhập liệu">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ds-name" label="Họ và tên" required hint="Như trên giấy khai sinh">
              <Input placeholder="Nguyễn Minh Anh" />
            </Field>
            <Field id="ds-email" label="Email" error="Email không hợp lệ.">
              <Input defaultValue="minhanh@" />
            </Field>
            <Field id="ds-level" label="Trình độ">
              <NativeSelect defaultValue="STARTER">
                <option value="STARTER">Starter</option>
                <option value="BEGINNER">Beginner</option>
              </NativeSelect>
            </Field>
            <Field id="ds-disabled" label="Đã khóa">
              <Input disabled defaultValue="Không sửa được" />
            </Field>
            <Field id="ds-note" label="Nhận xét" className="sm:col-span-2">
              <Textarea placeholder="Viết nhận xét cho học viên…" />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox defaultChecked /> Cho phép nộp lại
            </label>
          </div>
        </Section>

        <Section title="Badge & thông báo">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge>Không hạn</Badge>
              <Badge tone="blue">còn 3 ngày</Badge>
              <Badge tone="orange">còn 20 giờ</Badge>
              <Badge tone="danger">quá hạn 1 ngày</Badge>
              <Badge tone="success">Có mặt</Badge>
              <Badge tone="warning">Đi muộn</Badge>
              <Badge tone="gold">Xuất sắc</Badge>
            </div>
            <Alert tone="info" title="Thông tin">Bài tập sẽ tự mở lúc 08:00 thứ Hai.</Alert>
            <Alert tone="success">Đã nộp bài thành công.</Alert>
            <Alert tone="warning">Bạn đang offline — bài làm vẫn được lưu trên máy.</Alert>
            <Alert tone="danger">Không tải được file. Vui lòng thử lại.</Alert>
          </div>
        </Section>

        <Section title="Card thống kê">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Lớp đang dạy" value={4} icon={Inbox} tone="blue" />
            <StatCard label="Học viên" value={62} icon={Inbox} tone="orange" />
            <StatCard label="Bài cần chấm" value={18} icon={Inbox} tone="success" />
            <StatCard label="Chưa nộp" value={9} icon={Inbox} tone="danger" />
          </div>
        </Section>

        <Section title="Bảng" description="Trên điện thoại, dữ liệu dạng bảng hiển thị thành danh sách thẻ.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Học viên</TableHead>
                <TableHead>Bài</TableHead>
                <TableHead className="text-right">Điểm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="flex items-center gap-2">
                  <Avatar name="Nguyễn Minh Anh" className="size-8 text-xs" /> Nguyễn Minh Anh
                </TableCell>
                <TableCell>Unit 2 Quiz</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">9,0</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="flex items-center gap-2">
                  <Avatar name="Phạm Quốc Bảo" className="size-8 text-xs" /> Phạm Quốc Bảo
                </TableCell>
                <TableCell>Unit 2 Quiz</TableCell>
                <TableCell className="text-right">
                  <Badge tone="success">Chờ chấm</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Section>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Modal">
            <DialogDemo />
          </Section>
          <Section title="Toast">
            <ToastDemo />
          </Section>
          <Section title="Đang tải">
            <div className="grid gap-3">
              <Spinner />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          </Section>
          <Section title="Trạng thái trống">
            <EmptyState title="Chưa có bài giảng" description="Bài giảng giáo viên đăng sẽ xuất hiện ở đây." />
          </Section>
          <Section title="Trạng thái lỗi">
            <ErrorStateDemo />
          </Section>
        </div>
      </div>
    </>
  );
}
