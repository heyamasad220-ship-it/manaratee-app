/**
 * Inspect QLH_Registrations.xlsx structure.
 * Usage: node scripts/inspect-qlh-registrations-xlsx.mjs
 */
import { createRequire } from "node:module"
import { existsSync } from "node:fs"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")
const PATH = process.argv[2] || "C:/Users/danan/Downloads/QLH_Registrations.xlsx"

if (!existsSync(PATH)) {
  console.error("File not found:", PATH)
  process.exit(1)
}

const wb = XLSX.readFile(PATH)
console.log("sheets:", wb.SheetNames)
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" })
  console.log("\n===", name, "rows:", rows.length, "===")
  if (!rows[0]) continue
  console.log("columns:")
  for (const key of Object.keys(rows[0])) console.log(" -", key)
  console.log("sample[0]:", JSON.stringify(rows[0], null, 2))
  if (rows[1]) console.log("sample[1]:", JSON.stringify(rows[1], null, 2))
  // year-like unique values
  for (const key of Object.keys(rows[0])) {
    const lower = key.toLowerCase()
    if (
      lower.includes("year") ||
      lower.includes("program") ||
      lower.includes("class") ||
      lower.includes("course") ||
      lower.includes("session") ||
      lower.includes("grade")
    ) {
      const counts = new Map()
      for (const row of rows) {
        const v = String(row[key] ?? "").trim() || "(empty)"
        counts.set(v, (counts.get(v) || 0) + 1)
      }
      console.log(
        `unique ${key}:`,
        [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
      )
    }
  }
}
