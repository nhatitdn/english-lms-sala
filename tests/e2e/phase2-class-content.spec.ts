import path from "node:path";
import { expect, test } from "./fixtures";
import { expectNoHorizontalScroll, login } from "./helpers";

const FIXTURES = path.join(process.cwd(), "tests/fixtures");

test("#1 admin creates a class, assigns a teacher, adds a student and sets the schedule", async ({ page }, info) => {
  const code = `E2E-${info.project.name.slice(0, 3).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
  await login(page, "admin.demo");
  await page.goto("/app/classes/new");
  await page.getByLabel("Mã lớp").fill(code);
  await page.getByLabel("Tên lớp").fill("Lớp kiểm thử");
  await page.getByLabel("Trình độ").selectOption("BEGINNER");
  await page.getByRole("button", { name: "Tạo lớp" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lớp kiểm thử");

  // assign teacher
  await page.getByLabel("Chọn giáo viên").selectOption({ label: "Thầy Minh (Lê Văn Minh)" });
  await page.getByRole("button", { name: "Phân công" }).click();
  await expect(page.getByText("Thầy Minh").first()).toBeVisible();

  // add student
  const tabs = page.getByRole("navigation", { name: "Mục của lớp" });
  await tabs.getByRole("link", { name: "Thành viên" }).click();
  await page.getByLabel("Tìm học viên để thêm").fill("thao");
  await page.getByRole("listitem").filter({ hasText: "Đặng Phương Thảo" }).getByRole("button", { name: "Thêm" }).click();
  await expect(page.getByText("Học viên đang học (1)")).toBeVisible();

  // schedule → sessions generated
  await tabs.getByRole("link", { name: "Lịch học" }).click();
  await page.locator("form").filter({ hasText: "Bắt đầu" }).getByRole("button", { name: "Thêm" }).click();
  await expect(page.getByText(/Thứ Ba · 17:30–19:00/)).toBeVisible();
  await expect(page.getByText(/Thứ Ba, /).first()).toBeVisible();
});

test("#3 #4 teacher writes a lesson with a PDF and an MP3, publishes it to a class", async ({ page }) => {
  await login(page, "gv.lan");
  await page.goto("/app/lessons");
  await page.getByRole("button", { name: "Tạo bài giảng" }).click();
  await page.getByLabel("Tiêu đề").fill("E2E — Animals");
  await page.getByLabel("Phân loại").selectOption("LISTENING");
  await page.getByLabel("Cho lớp").selectOption({ label: "STA-2611 · Starter A" });
  await page.getByRole("button", { name: "Tạo và soạn nội dung" }).click();
  await expect(page).toHaveURL(/\/edit$/);

  // content
  await page.getByRole("textbox", { name: "Nội dung" }).click();
  await page.keyboard.type("Today we learn animal words: cat, dog, bird.");
  await page.getByRole("button", { name: "Lưu nội dung" }).click();
  await expect(page.getByText("Đã lưu bài giảng.")).toBeVisible();

  // attachment (PDF)
  await page.getByTestId("file-input-material").setInputFiles(path.join(FIXTURES, "sample.pdf"));
  await expect(page.getByText("Đã đính kèm file.")).toBeVisible();

  // listening item (MP3)
  await page.getByRole("button", { name: "Thêm bài nghe" }).click();
  await page.getByLabel("Tên bài nghe").fill("Animal sounds");
  await page.getByTestId("file-input-audio").setInputFiles(path.join(FIXTURES, "sample.mp3"));
  await expect(page.getByText("sample.mp3")).toBeVisible();
  await page.getByLabel("Transcript", { exact: true }).fill("The cat says meow.\nThe dog says woof.");
  await page.getByRole("button", { name: "Lưu bài nghe" }).click();
  await expect(page.getByText("Đã lưu bài nghe.")).toBeVisible();

  // a fake MP3 is refused
  await page.getByRole("button", { name: "Thêm bài nghe" }).click();
  await page.getByTestId("file-input-audio").setInputFiles(path.join(FIXTURES, "fake-audio.mp3"));
  await expect(page.getByText(/không đúng định dạng/)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Xuất bản" }).click();
  await expect(page.getByText("Đã xuất bản bài giảng.")).toBeVisible();
});

test("#5 student opens the lesson and the audio streams with seeking support", async ({ page }) => {
  await login(page, "hv.minhanh");
  await page.goto("/app/classes");
  await page.getByRole("link", { name: /Starter A/ }).click();
  await page.getByRole("navigation", { name: "Mục của lớp" }).getByRole("link", { name: "Bài giảng" }).click();
  await expect(page.getByText("Unit 4 — My house")).toHaveCount(0); // draft is hidden
  await page.getByRole("link", { name: /Unit 3 — My family/ }).click();

  await expect(page.getByRole("heading", { name: "Luyện nghe" })).toBeVisible();
  const audioSrc = await page.locator("audio").first().getAttribute("src");
  expect(audioSrc).toMatch(/^\/api\/files\/[0-9a-f-]{36}$/);
  // Range request → 206 Partial Content (what iOS Safari needs to seek)
  const res = await page.request.get(audioSrc!, { headers: { Range: "bytes=0-99" } });
  expect(res.status()).toBe(206);
  expect(res.headers()["content-range"]).toMatch(/^bytes 0-99\/\d+$/);
  expect(res.headers()["content-type"]).toBe("audio/mpeg");

  await page.getByRole("button", { name: "Phát" }).click();
  await expect(page.getByRole("button", { name: "Tạm dừng" })).toBeVisible();
  await page.getByRole("radio", { name: "1,5×" }).click();
  await expect(page.getByRole("radio", { name: "1,5×" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Transcript mở sau khi nghe xong" })).toBeDisabled();
  await expectNoHorizontalScroll(page);
});

test("students cannot open other classes' lessons or files by guessing URLs", async ({ page, browser }) => {
  // teacher view: find the demo lesson + its audio file id
  const ctx = await browser.newContext();
  const t = await ctx.newPage();
  await login(t, "gv.lan");
  await t.goto("/app/lessons?scope=all&q=Unit 3");
  await t.getByRole("link", { name: /Unit 3 — My family/ }).first().click();
  await t.waitForURL(/\/app\/lessons\/[0-9a-f-]{36}$/);
  const lessonUrl = t.url();
  const fileSrc = await t.locator("audio").first().getAttribute("src");
  await ctx.close();

  await login(page, "hv.ducthinh"); // Pre-Intermediate student, not in Starter A
  await page.goto(lessonUrl);
  await expect(page.getByText("Không tìm thấy trang")).toBeVisible();
  await expect(page.getByText("Unit 3 — My family")).toHaveCount(0);
  const file = await page.request.get(fileSrc!);
  expect(file.status()).toBe(404);
  const classes = await page.goto("/app/classes");
  expect(classes?.status()).toBe(200);
  await expect(page.getByText("Starter A")).toHaveCount(0);
});

test("parents have no access to lesson content", async ({ page }) => {
  await login(page, "ph.huong");
  await page.goto("/app/classes");
  await page.getByRole("link", { name: /Starter A/ }).click();
  await expect(page.getByRole("navigation", { name: "Mục của lớp" }).getByRole("link", { name: "Bài giảng" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Lịch học" })).toBeVisible();
});
