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
    return { error: 'must_agree_terms' }
  }

  const supabase = createSupabaseServiceClient()

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true, // skip email verification gate
  })
  if (authError || !authData.user) return { error: 'auth_error' }
  const userId = authData.user.id

  // 2. Insert parent row
  const { data: parent, error: parentError } = await supabase
    .from('parents')
    .insert({ user_id: userId, name: input.parentName, email: input.email, phone: input.phone })
    .select()
    .single()
  if (parentError || !parent) {
    await supabase.auth.admin.deleteUser(userId) // rollback
    return { error: 'submission_failed' }
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
    return { error: 'submission_failed' }
  }

  // 4. Assign parent role
  const { error: roleError } = await supabase
    .from('user_roles').insert({ user_id: userId, role: 'parent' })
  if (roleError) {
    await supabase.auth.admin.deleteUser(userId) // rollback
    return { error: 'submission_failed' }
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

  await sendParentConfirmationEmail(input.email, input.parentName, input.playerName)

  return { playerId: player.id, parentId: parent.id, userId }
}

// Confirmation email to the parent themselves. Non-blocking, same as the
// admin notification. Note: this currently sends from Resend's shared
// sandbox address (onboarding@resend.dev), which on an unverified Resend
// account typically only delivers to the account owner's own verified
// email — it will not reliably reach real parent inboxes until a custom
// domain is verified in Resend and this `from` address is updated.
async function sendParentConfirmationEmail(email: string, parentName: string, playerName: string) {
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: 'Tangerine Toucans <onboarding@resend.dev>',
      to: [email],
      subject: `You're registered, ${parentName}!`,
      text: `Hi ${parentName},\n\nThanks for registering ${playerName} with Tangerine Toucans FC! We're excited to have you join the club.\n\nYou can log in anytime at the club website to view your payment schedule, add another child, or check the latest news and upcoming fixtures.\n\nSee you on the pitch!\nTangerine Toucans FC`,
    })
    if (emailError) console.error('Resend error (parent confirmation):', emailError)
  } catch (e) {
    console.error('Resend threw (parent confirmation):', e)
  }
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
  if (!user) return { error: 'login_required_child' }

  const supabase = createSupabaseServiceClient()

  const { data: parent } = await supabase.from('parents').select('id, name, email').eq('user_id', user.id).single()
  if (!parent) return { error: 'parent_not_found' }

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
  if (playerError || !player) return { error: 'submission_failed' }

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

  await sendParentConfirmationEmail(parent.email, parent.name, input.playerName)

  return { playerId: player.id }
}
