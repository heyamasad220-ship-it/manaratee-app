"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Home } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { isContactsListSegment } from "@/lib/contacts/contact-module-label"
import { buildNavigationTrail } from "@/lib/navigation/sidebar-nav"
import { STAFF_BREADCRUMB_ROW_HEIGHT_CLASS } from "@/lib/layout/staff-dashboard-chrome"
import { useSidebarContext } from "@/components/layout/staff-sidebar-context"
import { cn } from "@/lib/utils"

function resolveContactProfileListSegment(
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">
) {
  const match = pathname.match(/^\/(?:contacts|directory)\/([^/]+)$/)
  if (!match) return null
  const list = searchParams.get("list")
  return isContactsListSegment(list) ? list : null
}

export function NavigationBreadcrumbs({
  extras = [],
}: {
  extras?: Array<{ label: string; href?: string }>
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { navItems, loading, ensureSubExpanded, openModuleDrawer } =
    useSidebarContext()

  if (loading || (pathname === "/dashboard" && extras.length === 0)) {
    return null
  }

  const profileListSegment = resolveContactProfileListSegment(pathname, searchParams)
  const trail = buildNavigationTrail(
    pathname,
    navItems,
    profileListSegment,
    extras,
    searchParams
  )

  if (trail.length <= 1) {
    return null
  }

  function handleSegmentClick(segment: (typeof trail)[number]) {
    const hasDrawerItems = Boolean(segment.module?.children?.length)

    // Open the module drawer (previous menu) when leaving a nested page.
    if (segment.module && hasDrawerItems) {
      openModuleDrawer(segment.module)
    }
    if (segment.expandKeys?.length) {
      ensureSubExpanded(segment.expandKeys)
    }

    if (!segment.href) return

    const targetPath = segment.href.split("?")[0] || segment.href
    const hrefQuery = segment.href.includes("?")
      ? segment.href.slice(segment.href.indexOf("?") + 1)
      : ""
    const currentQuery = searchParams.toString()
    // Folder groups often share the first child's href (e.g. Programs → Catalog).
    // Stay put and only reveal the menu instead of a no-op navigation — unless the
    // query differs (e.g. department year workspace → department overview).
    if (targetPath === pathname) {
      if (hrefQuery === currentQuery) {
        return
      }
      router.push(segment.href)
      return
    }

    // Module root while already inside that module — open the menu only
    // when there is a drawer to show. Empty-children modules (Programs)
    // navigate back to the module home (Overview).
    if (segment.module && hasDrawerItems && !segment.expandKeys?.length) {
      const prefixes = [
        segment.module.matchPrefix,
        ...(segment.module.alsoMatchPrefixes ?? []),
      ]
      const alreadyInside = prefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
      )
      if (alreadyInside) {
        return
      }
    }

    router.push(segment.href)
  }

  return (
    <div
      className={cn(
        "flex items-center border-b border-border bg-background px-6",
        STAFF_BREADCRUMB_ROW_HEIGHT_CLASS,
      )}
    >
      <Breadcrumb>
        <BreadcrumbList>
          {trail.map((segment, index) => {
            const isLast = index === trail.length - 1
            const isHome = index === 0

            return (
              <span key={`${segment.label}-${index}`} className="contents">
                {index > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        href={segment.href || "/dashboard"}
                        onClick={(event) => {
                          event.preventDefault()
                          handleSegmentClick(segment)
                        }}
                        className="inline-flex items-center gap-1.5"
                      >
                        {isHome ? <Home className="h-3.5 w-3.5" /> : null}
                        <span>{segment.label}</span>
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
