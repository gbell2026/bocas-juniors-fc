'use server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
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

  // Notify admin (non-blocking — don't let email failures break registration)
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: 'Tangerine Toucans <onboarding@resend.dev>',
      to: ['g.bell2010@googlemail.com'],
      subject: `New registration — ${input.playerName}`,
      text: `New Registration\n\nPlayer: ${input.playerName}\nDate of Birth: ${input.dateOfBirth}\nPosition: ${input.position}\nPayment Plan: ${input.paymentPlan}\n\nParent: ${input.parentName}\nEmail: ${input.email}\nPhone: ${input.phone}`,
    })
    if (emailError) console.error('Resend error:', emailError)
  } catch (e) {
    console.error('Resend threw:', e)
  }

  return { playerId: player.id, parentId: parent.id, userId }
}

export type AddChildInput = {
  playerName: string; dateOfBirth: string; position: string; paymentPlan: PaymentPlan
}

export type AddChildResult =
  | { playerId: string; error?: never }
  | { error: string; playerId?: never }

// Adds a second (or later) child to an already-registered parent — no new
// login, no new parent record. The parent is derived from the caller's real
// session (never a client-supplied id) via the session-aware client, then
// the service-role client does the actual write, matching the pattern
// established for comment authorship in announcements.ts.
export async function addChildToParent(input: AddChildInput): Promise<AddChildResult> {
  const supabaseSession = await createSupabaseServerClient()
  const { data: { user } } = await supabaseSession.auth.getUser()
  if (!user) return { error: 'You must be logged in to add a child.' }

  const supabase = createSupabaseServiceClient()

  const { data: parent } = await supabase.from('parents').select('id, name, email').eq('user_id', user.id).single()
  if (!parent) return { error: 'No parent account found for this login.' }

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
  if (playerError || !player) return { error: 'Failed to add player record' }

  // Notify admin (non-blocking — don't let email failures break registration)
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: 'Tangerine Toucans <onboarding@resend.dev>',
      to: ['g.bell2010@googlemail.com'],
      subject: `New registration — ${input.playerName}`,
      text: `New Registration (additional child)\n\nPlayer: ${input.playerName}\nDate of Birth: ${input.dateOfBirth}\nPosition: ${input.position}\nPayment Plan: ${input.paymentPlan}\n\nParent: ${parent.name}\nEmail: ${parent.email}`,
    })
    if (emailError) console.error('Resend error:', emailError)
  } catch (e) {
    console.error('Resend threw:', e)
  }

  return { playerId: player.id }
}
