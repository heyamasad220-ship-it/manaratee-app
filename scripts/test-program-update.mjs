import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = resolve(root, ".env.local")

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

const programId = "e6436c28-666c-4327-b3c1-4234d2379a42"
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const payload = {
  name: "Summer Camp (June)",
  age_groups: ["Ages 4-14"],
  grade_levels: ["Pre-K", "Kindergarten", "1st Grade"],
  gender: "All",
  min_grade: "Pre-K",
  max_grade: "1st Grade",
  capacity: 160,
  status: "active",
  program_type: "youth",
  require_guardian: true,
  require_grade: false,
  require_emergency_contact: true,
  visibility: "public",
  billing_type: "one_time",
  tuition_amount: 0,
  updated_at: new Date().toISOString(),
}

const { error: mainError } = await supabase
  .from("programs")
  .update(payload)
  .eq("id", programId)

console.log("main update:", mainError?.message || "ok")

const { error: ageError } = await supabase
  .from("programs")
  .update({ min_age: 4, max_age: 14 })
  .eq("id", programId)

console.log("age update:", ageError?.message || "ok")

const { data } = await supabase
  .from("programs")
  .select("min_age,max_age,age_groups")
  .eq("id", programId)
  .single()

console.log(JSON.stringify(data, null, 2))
