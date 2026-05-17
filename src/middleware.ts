import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Matches smartphones — deliberately excludes iPad and Android tablets so
// they continue to use the full desktop interface.
const PHONE_UA = /(iPhone|iPod|(Android.*Mobile)|BlackBerry|IEMobile|Opera Mini)/i;

function isPhone(req: NextRequest): boolean {
  return PHONE_UA.test(req.headers.get("user-agent") ?? "");
}

// Desktop route prefixes that phones should never see
const DESKTOP_ROOTS = [
  "/dashboard", "/itens", "/fornecedores",
  "/relatorios", "/fases", "/usuarios",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn  = !!req.auth;
  const isAuthPage  = pathname.startsWith("/login");
  const isMobilePath = pathname.startsWith("/m");
  const phone = isPhone(req);

  // ── Not logged in ────────────────────────────────────────────────────────
  if (!isLoggedIn && !isAuthPage) {
    // Preserve a sensible callbackUrl so post-login lands on the right place
    const callbackUrl = phone ? "/m" : pathname;
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, req.nextUrl),
    );
  }

  // ── Already logged in, on /login → bounce away ───────────────────────────
  if (isLoggedIn && isAuthPage) {
    // Respect ?callbackUrl if present and safe (same origin)
    const cb = req.nextUrl.searchParams.get("callbackUrl");
    if (cb && cb.startsWith("/") && !cb.startsWith("//")) {
      return NextResponse.redirect(new URL(cb, req.nextUrl));
    }
    const dest = phone ? "/m" : "/dashboard";
    return NextResponse.redirect(new URL(dest, req.nextUrl));
  }

  // ── Logged-in phone hitting a desktop route → send to /m ────────────────
  if (
    isLoggedIn && phone && !isMobilePath &&
    DESKTOP_ROOTS.some((r) => pathname === r || pathname.startsWith(r + "/"))
  ) {
    return NextResponse.redirect(new URL("/m", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
