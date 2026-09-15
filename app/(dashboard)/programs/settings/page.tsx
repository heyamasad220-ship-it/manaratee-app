import { Header } from "@/components/layout/header"
import { redirectOrgWideProgramPagesForDepartmentHead } from "@/lib/programs/program-access"

export default async function ProgramsSettingsPage() {
  await redirectOrgWideProgramPagesForDepartmentHead()

  return (
    <>
      <Header title="Settings" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organization-wide program settings will live here.
          </p>
        </div>
      </div>
    </>
  )
}
