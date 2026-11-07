/**
 * Create the first administrator account interactively.
 *   npm run create-admin
 * No password is ever stored in code or in the repository.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createScriptClient } from "../prisma/seed/client";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../src/server/auth/password";

const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;

async function main() {
  const rl = createInterface({ input, output });
  const db = createScriptClient();
  try {
    console.log("== Tạo tài khoản quản trị Sala English Corner ==\n");
    const username = (await rl.question("Tên đăng nhập (a-z, 0-9, . _ -): ")).trim().toLowerCase();
    if (!USERNAME_RE.test(username)) throw new Error("Tên đăng nhập không hợp lệ.");
    if (await db.user.findUnique({ where: { username } })) throw new Error("Tên đăng nhập đã tồn tại.");

    const fullName = (await rl.question("Họ và tên: ")).trim();
    if (fullName.length < 2) throw new Error("Họ và tên quá ngắn.");
    const email = (await rl.question("Email (có thể bỏ trống): ")).trim() || null;

    const password = await rl.question(`Mật khẩu (tối thiểu ${PASSWORD_MIN_LENGTH} ký tự): `);
    if (password.length < PASSWORD_MIN_LENGTH) throw new Error("Mật khẩu quá ngắn.");
    const confirm = await rl.question("Nhập lại mật khẩu: ");
    if (password !== confirm) throw new Error("Hai lần nhập mật khẩu không khớp.");

    const alsoTeacher = (await rl.question("Người này cũng dạy lớp? (c/k): ")).trim().toLowerCase().startsWith("c");

    const user = await db.user.create({
      data: {
        username,
        fullName,
        email,
        role: "ADMIN",
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
        ...(alsoTeacher
          ? { teacher: { create: { slug: username.replace(/[._]/g, "-"), displayName: fullName } } }
          : {}),
      },
    });
    await db.activityLog.create({
      data: { actorId: user.id, action: "user.create_admin_cli", entityType: "user", entityId: user.id },
    });
    console.log(`\n✓ Đã tạo tài khoản quản trị "${username}". Hãy đăng nhập tại /dang-nhap.`);
  } finally {
    rl.close();
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
