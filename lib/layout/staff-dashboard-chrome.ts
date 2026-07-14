/** Shared heights so the staff sidebar nav aligns with the main header + breadcrumb rows. */
export const STAFF_HEADER_HEIGHT_CLASS = "h-36"
export const STAFF_BREADCRUMB_ROW_HEIGHT_CLASS = "h-11"

/**
 * Sticky `top` for page content that should pin below the sticky staff header + breadcrumbs.
 * Keep in sync with header (h-36) + breadcrumb (h-11) = 11.75rem.
 */
export const STAFF_MAIN_CONTENT_STICKY_TOP_CLASS = "top-[11.75rem]"

/** Sidebar nav + module drawer start below the logo band and breadcrumb spacer. */
export const STAFF_SIDEBAR_NAV_TOP_CLASS = STAFF_MAIN_CONTENT_STICKY_TOP_CLASS
export const STAFF_SIDEBAR_NAV_HEIGHT_CLASS = "h-[calc(100vh-11.75rem)]"
