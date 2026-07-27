export const LIST_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

export const DEFAULT_LIST_PAGE_SIZE = 20

export function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(1, page), Math.max(1, totalPages))
}

export function getListPageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)))
}

export function getListPageRange(page: number, pageSize: number, total: number) {
  if (total <= 0) {
    return { start: 0, end: 0 }
  }
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return { start, end }
}

/** Window of page numbers centered on the current page (e.g. 1 2 3 4 5). */
export function getVisiblePageNumbers(
  page: number,
  totalPages: number,
  maxButtons = 5
): number[] {
  const total = Math.max(1, totalPages)
  const max = Math.max(1, maxButtons)
  if (total <= max) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  let start = Math.max(1, page - Math.floor(max / 2))
  let end = start + max - 1
  if (end > total) {
    end = total
    start = Math.max(1, end - max + 1)
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

export function slicePageItems<T>(items: T[], page: number, pageSize: number): T[] {
  const from = (Math.max(1, page) - 1) * Math.max(1, pageSize)
  return items.slice(from, from + Math.max(1, pageSize))
}
