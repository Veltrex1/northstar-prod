import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicRoutes = ["/login", "/signup", "/api/auth/signup", "/api/auth/login"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  const authToken = request.cookies.get("auth-token")?.value;

  if (!isPublicRoute && !authToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublicRoute && authToken && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
