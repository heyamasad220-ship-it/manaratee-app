import { Header } from "@/components/layout/header"
import { DirectoryReportsClient } from "@/components/directory/directory-reports-client"
import { fetchDirectoryReportStatsAction } from "@/lib/directory/directory-report-actions"

export default async function DirectoryReportsPage() {
  const result = await fetchDirectoryReportStatsAction()

  return (
    <>
      <Header title="Directory Reports" />
      {result.success ? (
        <DirectoryReportsClient
          uniquePeople={result.uniquePeople}
          roleDistribution={result.roleDistribution}
          completeness={result.completeness}
          growth={result.growth}
          duplicates={result.duplicates}
        />
      ) : (
        <div className="p-6 text-sm text-red-700">{result.error}</div>
      )}
    </>
  )
}
