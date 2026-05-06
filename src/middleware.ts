import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || ""
);

const TOKEN_NAME = "brajmarg_admin_token";

// Routes that don't require authentication
const publicRoutes = ["/", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if it's a public route
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith("/api/auth/")
  );

  // Get token from cookies
  const token = request.cookies.get(TOKEN_NAME)?.value;

  // Verify token
  let isValidToken = false;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      isValidToken = true;
    } catch {
      isValidToken = false;
    }
  }

  // If user is on login page and already authenticated, redirect to dashboard
  if (pathname === "/" && isValidToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If route requires auth and user is not authenticated, redirect to login
  if (!isPublicRoute && !isValidToken) {
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
