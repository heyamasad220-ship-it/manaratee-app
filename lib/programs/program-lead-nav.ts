/** Sidebar / Staff Tools labels: one program is “My program”; several use each program name. */
export function programLeadNavEntries(
  leads: Array<{ programId: string; programName: string }>
): Array<{ label: string; programId: string; programName: string }> {
  if (leads.length === 1) {
    return [
      {
        label: "My program",
        programId: leads[0].programId,
        programName: leads[0].programName,
      },
    ]
  }
  return leads.map((lead) => ({
    label: lead.programName,
    programId: lead.programId,
    programName: lead.programName,
  }))
}
