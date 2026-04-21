import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ykixrgzainmelcitejlu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlraXhyZ3phaW5tZWxjaXRlamx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTIwMzgsImV4cCI6MjA5MDQ2ODAzOH0.XG6QCygJWXwpZjE4vGnhvKxMYvFJH6vUss1-QTmEQ6U'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)