export default function EnvCheckPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <div style={{ padding: 24 }}>
      <h1>Env Check</h1>
      <p>URL exists: {supabaseUrl ? "yes" : "no"}</p>
      <p>URL starts with https: {supabaseUrl?.startsWith("https://") ? "yes" : "no"}</p>
      <p>URL value: {supabaseUrl || "missing"}</p>
      <p>Anon key exists: {anonKey ? "yes" : "no"}</p>
      <p>Anon key length: {anonKey?.length || 0}</p>
    </div>
  )
}