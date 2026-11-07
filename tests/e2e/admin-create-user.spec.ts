import { expect, test } from "./fixtures";
import { login } from "./helpers";

test("admin creates a student; the student logs in with the temp password and must change it", async ({ page, browser }, info) => {
  const username = `e2e.${info.project.name}.${Date.now().toString(36)}`;

  await login(page, "admin.demo");
  await page.goto("/app/admin/users/new");
  await page.getByRole("radio", { name: "Học viên" }).click();
  await page.getByLabel("Họ và tên").fill("Học Viên Kiểm Thử");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Ngày sinh").fill("2014-06-01");
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();

  const temp = page.getByTestId("temp-password");
  await expect(temp).toBeVisible();
  const tempPassword = (await temp.textContent())!.trim();
  expect(tempPassword.length).toBeGreaterThanOrEqual(8);

  // the new student signs in from another browser
  const ctx = await browser.newContext();
  const student = await ctx.newPage();
  await login(student, username, tempPassword);
  await expect(student).toHaveURL(/\/doi-mat-khau/);
  // cannot skip the forced change
  await student.goto("/app/student");
  await expect(student).toHaveURL(/\/doi-mat-khau/);

  await student.getByLabel("Mật khẩu được cấp").fill(tempPassword);
  await student.getByLabel("Mật khẩu mới", { exact: true }).fill("hoctot-2026");
  await student.getByLabel("Nhập lại mật khẩu mới").fill("hoctot-2026");
  await student.getByRole("button", { name: "Lưu mật khẩu mới" }).click();
  await expect(student).toHaveURL(/\/app\/student/);
  await expect(student.getByRole("heading", { level: 1 })).toContainText("Xin chào");
  await ctx.close();
});
