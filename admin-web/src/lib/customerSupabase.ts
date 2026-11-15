import { createClient } from '@supabase/supabase-js'

export const CUSTOMER_SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://dvfusgowmixjjlqqbeik.supabase.co'

export const CUSTOMER_SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2ZnVzZ293bWl4ampscXFiZWlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjcwMjgsImV4cCI6MjEwMjU0MzAyOH0.J6WIUMQQWQRoWY-3fFsLRJRuiTE5Q6G_sXkexn-m6MU'

export const customerSupabase = createClient(
  CUSTOMER_SUPABASE_URL,
  CUSTOMER_SUPABASE_ANON_KEY,
)
