/**
 * Append experimental hold cleanup note to already-cancelled rental.
 * Does not change status or invoke cron.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const RENTAL_ID = "49ce1da2-fd1e-4f4c-9cfc-62c33e07eb9d"
const ORGANIZATION_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const NOTE =
  "Experimental hold cleanup before enabling hold expiry automation."

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const { data: rental } = await supabase
  .from("venue_rentals")
  .select("notes, status")
  .eq("id", RENTAL_ID)
  .eq("organization_id", ORGANIZATION_ID)
  .maybeSingle()

if (!rental) {
  console.error("Rental not found")
  process.exit(1)
}

if (!(rental.notes || "").includes(NOTE)) {
  const appended = `[Staff note ${new Date().toISOString()}] ${NOTE}`
  const nextNotes = [rental.notes, appended].filter(Boolean).join("\n\n")
  const { error } = await supabase
    .from("venue_rentals")
    .update({ notes: nextNotes })
    .eq("id", RENTAL_ID)
    .eq("organization_id", ORGANIZATION_ID)

  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  console.log("Appended cleanup note.")
} else {
  console.log("Cleanup note already present.")
}

console.log(`Status remains: ${rental.status}`)
