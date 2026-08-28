import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

/**
 * Mirrors the /admin guard in src/middleware.ts. The route matcher only covers
 * page navigations, so server actions that make admin-only changes must re-check
 * the caller's role themselves.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const service = createSupabaseServiceClient()
  const { data } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  return data?.role === 'admin'
}
