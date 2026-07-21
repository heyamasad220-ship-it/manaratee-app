export const WORKFORCE_DEPARTMENTS_PATH = "/workforce/departments"

export function workforceDepartmentDetailPath(departmentId: string) {
  return `${WORKFORCE_DEPARTMENTS_PATH}/${departmentId}`
}
