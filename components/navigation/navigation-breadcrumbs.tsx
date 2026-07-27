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
  const match = pathname.match(/^\/contacts\/([^/]+)$/)
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
  const { navItems, loading, ensureSubExpanded } = useSidebarContext()

  if (loading || (pathname === "/dashboard" && extras.length === 0)) {
    return null
  }

  const profileListSegment = resolveContactProfileListSegment(pathname, searchParams)
  const trail = buildNavigationTrail(pathname, navItems, profileListSegment, extras)

  if (trail.length <= 1) {
    return null
  }

  function handleSegmentClick(segment: (typeof trail)[number]) {
    if (segment.expandKeys?.length) {
      ensureSubExpanded(segment.expandKeys)
    }

    if (segment.href) {
      router.push(segment.href)
    }
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
