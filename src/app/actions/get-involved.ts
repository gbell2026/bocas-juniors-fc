'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function submitGetInvolved({
  name,
  email,
  organisation,
  interests,
  message,
}: {
  name: string
  email: string
  organisation?: string
  interests: string[]
  message?: string
}): Promise<{ error: string | null }> {
  if (!name || !email || interests.length === 0) {
    return { error: 'Please fill in all required fields.' }
  }

  const supabase = createSupabaseServiceClient()
  const { error: dbError } = await supabase.from('get_involved_submissions').insert({
    name,
    email,
    organisation: organisation || null,
    interests,
    message: message || null,
  })
  if (dbError) return { error: dbError.message }

  // Send email notification (non-blocking — don't let email failures break the form)
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: 'Bocas Juniors FC <onboarding@resend.dev>',
      to: ['g.bell2010@gmail.com'],
      subject: `New Get Involved submission — ${name}`,
      text: `New Get Involved Submission\n\nName: ${name}\nEmail: ${email}\nOrganisation: ${organisation || 'N/A'}\nInterested in: ${interests.join(', ')}\nMessage: ${message || 'N/A'}`,
    })
    if (emailError) console.error('Resend error:', emailError)
  } catch (e) {
    console.error('Resend threw:', e)
  }

  return { error: null }
}
