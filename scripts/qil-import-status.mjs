/**
 * Quick status for QIL import objects (no secrets printed).
 * Usage: node scripts/qil-import-status.mjs
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const path = resolve(root, ".env.local")
if (existsSync(path)) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

const org = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: depts } = await sb
  .from("departments")
  .select("id, name")
  .eq("organization_id", org)
  .ilike("name", "%Institute for Ladies%")

const { data: programs } = await sb
  .from("programs")
  .select("id, name, department_id")
  .eq("organization_id", org)
  .or("name.ilike.%QIL%,name.ilike.%Tajweed%,name.ilike.%Memorization%,name.ilike.%Recitation%,name.ilike.%Shu%")

const deptIds = new Set((depts || []).map((d) => d.id))
const linked = (programs || []).filter((p) => deptIds.has(p.department_id))
const qilNamed = (programs || []).filter((p) => /qil/i.test(p.name))

let enrollments = 0
let offerings = 0
let charges = 0
for (const p of [...linked, ...qilNamed]) {
  const { count: e } = await sb
    .from("program_enrollments")
    .select("*", { count: "exact", head: true })
    .eq("program_id", p.id)
  const { count: o } = await sb
    .from("program_offerings")
    .select("*", { count: "exact", head: true })
    .eq("program_id", p.id)
  enrollments += e || 0
  offerings += o || 0
}

if (linked[0] || qilNamed[0]) {
  const ids = [...new Set([...linked, ...qilNamed].map((p) => p.id))]
  const { count: c } = await sb
    .from("program_charges")
    .select("*", { count: "exact", head: true })
    .in("program_id", ids)
  charges = c || 0
}

console.log(
  JSON.stringify(
    {
      departments: depts,
      qilPrograms: qilNamed,
      linkedPrograms: linked.map((p) => ({ id: p.id, name: p.name })),
      offerings,
      enrollments,
      charges,
    },
    null,
    2
  )
)
