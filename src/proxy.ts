import { NextResponse, type NextRequest } from "next/server";

/**
 * Early redirect only (UX): visitors without a session cookie are sent to the login page.
 * This is NOT the security boundary — every layout, page, action and route re-validates
 * the session against the database (see src/server/auth/current-user.ts).
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dang-nhap";
    url.search = "";
    url.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
