import { expect, test } from "./fixtures";
import { expectNoHorizontalScroll, login } from "./helpers";

/** "YYYY-MM-DDTHH:mm" in Vietnam time, `days` from now, at 21:00. */
function vnLocal(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return `${parts}T21:00`;
}

test("#6 #7 #8 #9 teacher assigns → student does it (reload + offline) → teacher grades → student sees the score", async ({ page }, info) => {
  test.setTimeout(180_000);
  const title = `E2E Quiz ${info.project.name} ${Date.now().toString(36)}`;
  const secret = `zebra${Date.now().toString(36)}`; // the fill-in answer: must never reach the student's browser before submitting

  // ── #6 teacher creates, writes questions, assigns and publishes ──
  await login(page, "gv.lan");
  await page.goto("/app/assignments");
  await page.getByRole("button", { name: "Tạo bài tập" }).click();
  await page.getByLabel("Tên bài tập").fill(title);
  await page.getByRole("button", { name: "Tạo và soạn câu hỏi" }).click();
  await expect(page).toHaveURL(/\/edit$/);

  // multiple choice
  await page.getByRole("button", { name: "Thêm câu hỏi" }).click();
  await page.getByRole("menuitem", { name: "Trắc nghiệm (1 đáp án)" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Câu hỏi / yêu cầu").fill("Which one is an animal?");
  await dlg.getByLabel("Lựa chọn 1", { exact: true }).fill("table");
  await dlg.getByLabel("Lựa chọn 2", { exact: true }).fill("tiger");
  await dlg.getByLabel("Lựa chọn 3", { exact: true }).fill("pencil");
  await dlg.getByLabel("Lựa chọn 2 là đáp án đúng").check();
  await dlg.getByRole("button", { name: "Lưu câu hỏi" }).click();
  await expect(page.getByTestId("question-card")).toHaveCount(1);

  // fill in the blank
  await page.getByRole("button", { name: "Thêm câu hỏi" }).click();
  await page.getByRole("menuitem", { name: "Điền vào chỗ trống" }).click();
  await dlg.getByLabel("Câu có chỗ trống").fill(`A [[${secret}]] has black and white stripes.`);
  await dlg.getByRole("button", { name: "Lưu câu hỏi" }).click();
  await expect(page.getByTestId("question-card")).toHaveCount(2);

  // writing (graded by hand)
  await page.getByRole("button", { name: "Thêm câu hỏi" }).click();
  await page.getByRole("menuitem", { name: "Viết đoạn văn" }).click();
  await dlg.getByLabel("Câu hỏi / yêu cầu").fill("Write 2 sentences about your favourite animal.");
  await dlg.getByRole("button", { name: "Lưu câu hỏi" }).click();
  await expect(page.getByTestId("question-card")).toHaveCount(3);

  // assign to the class with a due date, then publish
  await page.getByLabel("Lớp", { exact: true }).selectOption({ label: "STA-2611 · Starter A" });
  await page.getByLabel("Hạn nộp", { exact: true }).fill(vnLocal(2));
  await page.getByRole("button", { name: "Giao bài" }).click();
  await expect(page.getByText("STA-2611 · Cả lớp")).toBeVisible();
  await page.getByRole("button", { name: "Đăng bài tập" }).click();
  await expect(page.getByText(/Đã đăng bài tập/)).toBeVisible();
  if (info.project.name === "mobile") await expectNoHorizontalScroll(page);

  // ── #7 student does the assignment ──
  await page.context().clearCookies();
  await login(page, "hv.giahan");
  await page.goto("/app/assignments");
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await expect(page).toHaveURL(/\/app\/do\//);
  await expect(page.getByTestId("attempt-question")).toHaveCount(3);

  // the correct answers are not in the page (HTML + RSC payload)
  const html = await page.content();
  expect(html).not.toContain(secret);
  expect(html).not.toMatch(/isCorrect|is_correct|correctPosition|acceptedAnswers/);

  await page.getByRole("radio", { name: /tiger/ }).check();
  await page.getByLabel("Chỗ trống 1").fill(secret);
  await page.getByLabel("Bài viết").fill("I like tigers.");
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved", { timeout: 10_000 });

  // reload: answers come back from the server
  await page.reload();
  await expect(page.getByRole("radio", { name: /tiger/ })).toBeChecked();
  await expect(page.getByLabel("Bài viết")).toHaveValue("I like tigers.");

  // offline: keep working, answers kept on the device, sent when back online
  await page.context().setOffline(true);
  await page.getByLabel("Bài viết").fill("I like tigers. They are strong and beautiful.");
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "offline", { timeout: 10_000 });
  await expect(page.getByText("Mất kết nối mạng")).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });
  await page.reload();
  await expect(page.getByLabel("Bài viết")).toHaveValue("I like tigers. They are strong and beautiful.");
  if (info.project.name === "mobile") await expectNoHorizontalScroll(page);

  await page.getByRole("button", { name: "Nộp bài" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Nộp bài" }).click();
  await expect(page).toHaveURL(/\/app\/submissions\//);
  await expect(page.getByText("Đã nộp — đang chờ giáo viên chấm")).toBeVisible();

  // ── #8 teacher grades the writing ──
  await page.context().clearCookies();
  await login(page, "gv.lan");
  await page.goto("/app/grading");
  await page.getByRole("link", { name: new RegExp(`Võ Gia Hân.*${title}`) }).click();
  await expect(page.getByTestId("grade-question")).toHaveCount(3);
  await page.getByLabel(/Điểm \(tối đa 5\)/).fill("4");
  await page.getByLabel("Nhận xét chung (học viên và phụ huynh xem được)").fill("Bài viết tốt, nhớ dùng thêm tính từ nhé.");
  await page.getByRole("button", { name: "Lưu điểm" }).click();
  await expect(page.getByText("Đã lưu điểm.")).toBeVisible();
  // (1 + 1 + 4) / 7 points → 8,57 / 10
  await expect(page.getByLabel("Điểm 8,57 trên 10")).toBeVisible();

  // ── #9 student sees score and feedback ──
  await page.context().clearCookies();
  await login(page, "hv.giahan");
  await page.goto("/app/assignments");
  await expect(page.getByRole("link", { name: new RegExp(`${title}.*8,57`) })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByText("Bài viết tốt, nhớ dùng thêm tính từ nhé.")).toBeVisible();
  await expect(page.getByLabel("Điểm 8,57 trên 10")).toBeVisible();
  // default reveal mode for quizzes is "after the due date": the answer is still hidden
  await expect(page.getByText("Đáp án đúng sẽ hiện khi giáo viên cho phép.")).toBeVisible();
  await expect(page.getByText(`Đáp án: ${secret}`)).toHaveCount(0);
});

test("student cannot open the grading pages; parent has no assignment pages", async ({ page }) => {
  await login(page, "hv.minhanh");
  await page.goto("/app/grading");
  await expect(page).toHaveURL(/\/app\/student$/);
  await page.context().clearCookies();
  await login(page, "ph.huong");
  await page.goto("/app/assignments");
  await expect(page.getByText("Không tìm thấy trang")).toBeVisible();
});

test("teacher sees the class gradebook and the seeded grading queue", async ({ page }) => {
  await login(page, "gv.lan");
  await page.goto("/app/classes");
  await page.getByRole("link", { name: /STA-2611/ }).first().click();
  await page.getByRole("navigation", { name: "Mục của lớp" }).getByRole("link", { name: "Bảng điểm" }).click();
  const row = page.getByRole("row", { name: /Nguyễn Minh Anh/ });
  await expect(row.getByRole("link", { name: "9" })).toBeVisible();
  await page.goto("/app/grading");
  await expect(page.getByRole("link", { name: /Đặng Phương Thảo.*Writing #1/ })).toBeVisible();
});

test("listening quiz: student answers the questions under the audio and is auto-graded", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "one run is enough: it uses the demo student's attempt (needs a fresh demo seed)");
  await login(page, "hv.quocbao");
  await page.goto("/app/classes");
  await page.getByRole("link", { name: /STA-2611/ }).first().click();
  await page.getByRole("navigation", { name: "Mục của lớp" }).getByRole("link", { name: "Bài giảng" }).click();
  await page.getByRole("link", { name: /Unit 3 — My family/ }).click();
  await page.getByRole("link", { name: "Làm câu hỏi nghe" }).click();
  await page.getByRole("button", { name: /Bắt đầu làm bài|Làm tiếp/ }).click();
  await expect(page.getByRole("button", { name: /Phát|Play/ }).first()).toBeVisible();
  await page.getByRole("radio", { name: /Anna/ }).check();
  await page.getByLabel("Chỗ trống 1").fill("Tom");
  await page.getByLabel("Chỗ trống 2").fill("lucy");
  await page.getByRole("radio", { name: "Sai (False)" }).check();
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Nộp bài" }).click();
  await expect(page).toHaveURL(/\/app\/submissions\//);
  // auto-graded immediately, answers shown right after submitting
  await expect(page.getByLabel("Điểm 10 trên 10")).toBeVisible();
  await expect(page.getByText(/Đáp án:/).first()).toBeVisible();
  // the lesson page now links to the result
  await page.goto("/app/classes");
  await page.getByRole("link", { name: /STA-2611/ }).first().click();
  await page.getByRole("navigation", { name: "Mục của lớp" }).getByRole("link", { name: "Bài giảng" }).click();
  await page.getByRole("link", { name: /Unit 3 — My family/ }).click();
  await expect(page.getByRole("link", { name: "Xem kết quả bài nghe" })).toBeVisible();
});
