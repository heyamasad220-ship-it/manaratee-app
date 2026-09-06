import { requireProgramAccess } from "@/lib/programs/program-access"

export default async function ProgramWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireProgramAccess(id)
  return children
}
