import type { GroupMemberRow } from "@/lib/contacts/group-member-types"

const membersByGroupId = new Map<string, GroupMemberRow[]>()

export function getCachedGroupMembers(groupContactId: string) {
  return membersByGroupId.get(groupContactId) ?? null
}

export function setCachedGroupMembers(groupContactId: string, members: GroupMemberRow[]) {
  membersByGroupId.set(groupContactId, members)
}

export function clearCachedGroupMembers(groupContactId: string) {
  membersByGroupId.delete(groupContactId)
}
