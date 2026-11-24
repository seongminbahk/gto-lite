import { NextResponse, type NextRequest } from "next/server";
import { firstVisitRedirect, LOCALE_COOKIE } from "@/lib/i18n/firstVisit";

/** A Korean browser's first visit to an English page goes to the same page under /ko. */
export function proxy(request: NextRequest) {
  const target = firstVisitRedirect({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    acceptLanguage: request.headers.get("accept-language"),
    userAgent: request.headers.get("user-agent"),
    storedLocale: request.cookies.get(LOCALE_COOKIE)?.value ?? null,
  });
  if (!target) return NextResponse.next();
  const response = NextResponse.redirect(new URL(target, request.url), 307);
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  // English pages only: not /ko, the API, Next's files or anything with a file extension.
  matcher: ["/", "/about", "/learn", "/ranges/:path*", "/flops/:path*"],
};
