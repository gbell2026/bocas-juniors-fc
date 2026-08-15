'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

// Callable from client components (login redirect, nav) — user_roles RLS is
// `using (false)`, so only the service-role client can read it directly.
export async function getUserRole(userId: string): Promise<string | null> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).single()
  return data?.role ?? null
}
