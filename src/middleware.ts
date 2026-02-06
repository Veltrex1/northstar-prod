import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db/prisma";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicRoutes = ["/login", "/signup", "/api/auth/signup", "/api/auth/login"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  const authToken = request.cookies.get("auth-token")?.value;

  if (!isPublicRoute && !authToken) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // After verifying auth token
  if (!isPublicRoute && authToken) {
    try {
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET!) as {
        userId: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { onboardingCompleted: true },
      });

      // Redirect to onboarding if not completed
      if (user && !user.onboardingCompleted && pathname !== "/onboarding") {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }

      // Redirect away from onboarding if already completed
      if (user && user.onboardingCompleted && pathname === "/onboarding") {
        return NextResponse.redirect(new URL("/chat", request.url));
      }
    } catch (error) {
      // Token invalid, let it fall through to auth error
    }
  }

  if (isPublicRoute && authToken && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
