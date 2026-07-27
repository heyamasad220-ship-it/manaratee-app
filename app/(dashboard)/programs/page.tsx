import { redirect } from "next/navigation"

/** Programs module home → Catalog. */
export default function ProgramsPage() {
  redirect("/programs/catalog")
}
