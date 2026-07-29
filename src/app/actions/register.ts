'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PaymentPlan } from '@/lib/supabase/types'

export type RegisterInput = {
  parentName: string; email: string; phone: string; password: string
  playerName: string; dateOfBirth: string; position: string
  paymentPlan: PaymentPlan; agreedToTerms: boolean
}

export type RegisterResult =
  | { playerId: string; parentId: string; userId: string; error?: never }
  | { error: string; playerId?: never; parentId?: never; userId?: never }

export async function registerParentAndPlayer(input: RegisterInput): Promise<RegisterResult> {
  if (!input.agreedToTerms) {
    return { error: 'You must agree to the registration terms.' }
  }

  const supabase = createSupabaseServiceClient()

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true, // skip email verification gate
  })
  if (authError || !authData.user) return { error: authError?.message ?? 'Registration failed' }
  const userId = authData.user.id

  // 2. Insert parent row
  const { data: parent, error: parentError } = await supabase
    .from('parents')
    .insert({ user_id: userId, name: input.parentName, email: input.email, phone: input.phone })
    .select()
    .single()
  if (parentError || !parent) {
    await supabase.auth.admin.deleteUser(userId) // rollback
    return { error: 'Failed to create parent record' }
  }

  // 3. Insert player row
  const { data: player, error: playerError } = await supabase
    .from('players')
    .insert({
      parent_id: parent.id,
      name: input.playerName,
      date_of_birth: input.dateOfBirth,
      position: input.position,
      payment_plan: input.paymentPlan,
    })
    .select()
    .single()
  if (playerError || !player) {
    await supabase.auth.admin.deleteUser(userId) // rollback
    return { error: 'Failed to create player record' }
  }

  // 4. Assign parent role
  const { error: roleError } = await supabase
    .from('user_roles').insert({ user_id: userId, role: 'parent' })
  if (roleError) {
    await supabase.auth.admin.deleteUser(userId) // rollback
    return { error: 'Failed to assign role' }
  }

  return { playerId: player.id, parentId: parent.id, userId }
}
