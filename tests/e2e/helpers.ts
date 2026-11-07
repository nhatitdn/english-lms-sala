import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "demo1234";

/** Sign in. By default waits until the app (or the forced password change) has loaded. */
export async function login(page: Page, username: string, password = DEMO_PASSWORD, { expectSuccess = true } = {}) {
  await page.goto("/dang-nhap");
  await page.getByLabel("Tên đăng nhập hoặc email").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  if (expectSuccess) await page.waitForURL(/\/(app|doi-mat-khau)/);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
