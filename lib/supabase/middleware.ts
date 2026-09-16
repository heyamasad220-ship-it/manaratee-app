import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/** Stay under Vercel's ~25s middleware limit if Auth is slow or a refresh is locked. */
const GET_USER_TIMEOUT_MS = 8_000

const PROTECTED_PATHS = [
  "/dashboard",
  "/bookings",
  "/events",
  "/event-management",
  "/facilities",
  "/contacts",
  "/donations",
  "/workforce",
  "/hr",
  "/programs",
  "/finance",
  "/bazaar",
  "/vendor-hub",
  "/billing",
  "/settings",
  "/reports",
  "/customer",
  "/my-classes",
  "/sign-ups",
  "/child-care",
  "/people-management",
  "/membership",
]

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some((path) => pathname.startsWith(path))
}

/** Login and auth routes must not wait on a stuck session refresh. */
function isAuthSurfacePath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/auth")
  )
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") &&
        (cookie.name.includes("auth-token") ||
          cookie.name.includes("access-token")),
    )
}

function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
) {
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith("sb-")) continue
    response.cookies.set(cookie.name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    })
  }
}

function copyCookies(from: NextResponse, to: NextResponse) {
  const cookies = from.cookies.getAll()
  if (typeof to.cookies.setAll === "function") {
    to.cookies.setAll(cookies)
    return
  }
  for (const cookie of cookies) {
    to.cookies.set(cookie.name, cookie.value)
  }
}

function redirectToLogin(request: NextRequest, response: NextResponse) {
  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  const redirectResponse = NextResponse.redirect(url)
  // Keep any cookies middleware already set (including cleared auth cookies).
  copyCookies(response, redirectResponse)
  return redirectResponse
}

async function getUserSafely(
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ user: { id: string } | null; failed: boolean }> {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("AUTH_GET_USER_TIMEOUT")), GET_USER_TIMEOUT_MS)
      }),
    ])

    return {
      user: result.data.user,
      failed: Boolean(result.error),
    }
  } catch {
    return { user: null, failed: true }
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // A stuck refresh token must never 504 the login page (Vercel MIDDLEWARE_INVOCATION_TIMEOUT).
  if (isAuthSurfacePath(request.nextUrl.pathname)) {
    return supabaseResponse
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { user, failed } = await getUserSafely(supabase)

  const protectedRoute = isProtectedPath(request.nextUrl.pathname)

  // Timeout or Auth lock ("Too many concurrent token refresh requests") — drop
  // the poisoned session so the next request can reach /login.
  if (failed) {
    clearSupabaseAuthCookies(request, supabaseResponse)
    if (protectedRoute) {
      return redirectToLogin(request, supabaseResponse)
    }
    return supabaseResponse
  }

  // Only force login when there is clearly no session cookie. Transient getUser()
  // failures (auth lock races under concurrent layout fetches) must not bounce
  // an otherwise signed-in user between /login and the dashboard forever.
  if (protectedRoute && !user && !hasSupabaseAuthCookie(request)) {
    return redirectToLogin(request, supabaseResponse)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
