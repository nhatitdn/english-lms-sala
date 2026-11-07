import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { clientIpFrom } from "../request";
import { authenticate, type LoginErrorCode } from "./login";

class LoginError extends CredentialsSignin {
  constructor(code: LoginErrorCode) {
    super();
    this.code = code;
  }
}

const credentialsSchema = z.object({
  login: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
});

/** Session length: 7 days. Admin sessions are additionally capped at 12h in getCurrentUser(). */
export const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SEC },
  pages: { signIn: "/dang-nhap" },
  logger: {
    // wrong passwords are expected and already recorded in activity_logs — don't spam server logs
    error(error) {
      if (error.name === "CredentialsSignin" || (error as { type?: string }).type === "CredentialsSignin") return;
      console.error("[auth]", error);
    },
  },
  providers: [
    Credentials({
      credentials: { login: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new LoginError("invalid");
        const ip = request ? clientIpFrom(request.headers) : null;
        const result = await authenticate(parsed.data.login, parsed.data.password, ip);
        if (!result.ok) throw new LoginError(result.code);
        return {
          id: result.user.id,
          role: result.user.role,
          sessionVersion: result.user.sessionVersion,
          mustChangePassword: result.user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id!;
        token.role = user.role;
        token.sv = user.sessionVersion;
        token.mcp = user.mustChangePassword;
        token.loginAt = Math.floor(Date.now() / 1000);
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.uid,
        role: token.role,
        mustChangePassword: token.mcp,
        sv: token.sv,
        loginAt: token.loginAt,
      };
      return session;
    },
  },
});

declare module "next-auth" {
  interface User {
    role: Role;
    sessionVersion: number;
    mustChangePassword: boolean;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      mustChangePassword: boolean;
      /** session_version at login — compared with the DB on every request */
      sv: number;
      /** unix seconds */
      loginAt: number;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid: string;
    role: Role;
    sv: number;
    mcp: boolean;
    loginAt: number;
  }
}
