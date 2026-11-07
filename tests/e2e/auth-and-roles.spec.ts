import { expect, test } from "./fixtures";
import { expectNoHorizontalScroll, login } from "./helpers";

test.describe("authentication", () => {
  test("anonymous visitors are sent to the login page", async ({ page }) => {
    await page.goto("/app/admin/users");
    await expect(page).toHaveURL(/\/dang-nhap\?callbackUrl=%2Fapp%2Fadmin%2Fusers/);
  });

  test("wrong password shows a generic error", async ({ page }) => {
    await login(page, "gv.minh", "wrong-password", { expectSuccess: false });
    await expect(page.getByText("Tên đăng nhập hoặc mật khẩu không đúng")).toBeVisible();
    await expect(page).toHaveURL(/\/dang-nhap/);
  });

  test("login and logout", async ({ page }) => {
    await login(page, "hv.ducthinh");
    await expect(page).toHaveURL(/\/app\/student$/);
    await page.getByRole("button", { name: "Mở menu tài khoản" }).click();
    await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/dang-nhap/);
    await page.goto("/app/student");
    await expect(page).toHaveURL(/\/dang-nhap/);
  });
});

const ROLE_CASES = [
  { user: "admin.demo", home: "/app/admin", heading: /Chào/ },
  { user: "gv.lan", home: "/app/teacher", heading: /Chào Lan/ },
  { user: "hv.minhanh", home: "/app/student", heading: /Xin chào/ },
  { user: "ph.huong", home: "/app/parent", heading: "Kết quả học tập của con" },
];

for (const c of ROLE_CASES) {
  test(`${c.user} lands on their dashboard and works on this screen size`, async ({ page }) => {
    await login(page, c.user);
    await expect(page).toHaveURL(new RegExp(`${c.home}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.heading);
    await expectNoHorizontalScroll(page);
  });
}

test.describe("role isolation (server-side, not just hidden links)", () => {
  test("a student cannot open admin or teacher pages", async ({ page }) => {
    await login(page, "hv.minhanh");
    await expect(page).toHaveURL(/\/app\/student$/);
    for (const path of ["/app/admin", "/app/admin/users", "/app/teacher", "/app/parent"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/app\/student$/);
    }
  });

  test("a parent cannot open admin pages", async ({ page }) => {
    await login(page, "ph.huong");
    await page.goto("/app/admin/users/new");
    await expect(page).toHaveURL(/\/app\/parent$/);
  });

  test("a teacher cannot open user management", async ({ page }) => {
    await login(page, "gv.minh");
    await page.goto("/app/admin/users");
    await expect(page).toHaveURL(/\/app\/teacher$/);
  });

  test("a parent only sees their own linked children", async ({ page }) => {
    await login(page, "ph.huong");
    await expect(page.getByText("Nguyễn Minh Anh")).toBeVisible();
    await expect(page.getByText("Phạm Quốc Bảo")).toBeVisible();
    await expect(page.getByText("Võ Gia Hân")).toHaveCount(0);
  });
});
