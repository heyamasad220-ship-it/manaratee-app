import { Header } from "@/components/layout/header"
import { DirectoryReportsClient } from "@/components/directory/directory-reports-client"
import { fetchDirectoryReportPageAction } from "@/lib/directory/directory-report-actions"

export default async function DirectoryReportsPage() {
  const result = await fetchDirectoryReportPageAction()

  return (
    <>
      <Header title="Directory Reports" />
      {result.success ? (
        <DirectoryReportsClient
          duplicates={result.duplicates}
          initialNewContacts={result.newContacts}
        />
      ) : (
        <div className="p-6 text-sm text-red-700">{result.error}</div>
      )}
    </>
  )
}
