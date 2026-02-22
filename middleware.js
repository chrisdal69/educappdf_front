import { NextResponse } from "next/server";

const NODE_ENV = process.env.NODE_ENV;
const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK;
const urlFetch = NODE_ENV === "production" ? URL_BACK : "http://localhost:3000";

export async function middleware(req) {
  if (!req.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const pathname = req.nextUrl.pathname || "";
  const parts = pathname.split("/").filter(Boolean); // e.g. ["admin", "ciel1"]
  const adminSubpath = parts.length >= 2 ? parts[1] : "";
  const isAdminIndex = parts.length === 1; // "/admin"
  const isManageClass = adminSubpath === "manageclass";
  const isAdminRepertoirePage = parts.length === 2 && adminSubpath && !isManageClass;

  const cookie = req.cookies.get("jwt")?.value;
  if (!cookie) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const resp = await fetch(`${urlFetch}/auth/me`, {
    // on renvoie tous les cookies reçus, ou au minimum le jwt
    headers: {
      cookie: req.headers.get("cookie") ?? `jwt=${cookie}`,
    },
  });

  if (!resp.ok) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const data = await resp.json();
  const user = data?.user || null;

  // admin global: acces complet
  if (user?.role === "admin") {
    return NextResponse.next();
  }

  // teacher: acces limite a certains repertoires (/admin/[repertoire])
  if (isAdminRepertoirePage) {
    const allowed = Array.isArray(user?.adminRepertoires)
      ? user.adminRepertoires
      : [];

    if (allowed.includes(adminSubpath)) {
      return NextResponse.next();
    }
  }

  // /admin (index) et /admin/manageclass restent reserves aux admins
  if (isAdminIndex || isManageClass || parts[0] === "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.redirect(new URL("/", req.url));
}

export const config = { matcher: ["/admin/:path*"] };
