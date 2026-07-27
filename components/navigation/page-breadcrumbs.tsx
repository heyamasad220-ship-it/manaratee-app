import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

export type PageBreadcrumbItem = {
  label: string
  /** Omit on the current page (last item) or when the segment is not navigable. */
  href?: string
}

/**
 * In-page hierarchical trail (e.g. Education › Program Name).
 * Uses the same chevron separators as the staff header breadcrumbs.
 */
export function PageBreadcrumbs({
  items,
  className,
}: {
  items: PageBreadcrumbItem[]
  className?: string
}) {
  if (items.length === 0) return null

  return (
    <Breadcrumb className={cn(className)}>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const showAsPage = isLast || !item.href

          return (
            <span key={`${item.label}-${index}`} className="contents">
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {showAsPage ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href!}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
