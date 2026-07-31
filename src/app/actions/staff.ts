'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export type StaffMember = {
  id: string
  name: string
  roleTitle: string
  bio: string
  photoCloudinaryPublicId: string | null
  createdAt: string
}

// Public: all staff members in the order they were added.
export async function getStaffMembers(): Promise<StaffMember[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('staff_members').select('*').order('created_at')
  return (data ?? []).map(s => ({
    id: s.id,
    name: s.name,
    roleTitle: s.role_title,
    bio: s.bio,
    photoCloudinaryPublicId: s.photo_cloudinary_public_id,
    createdAt: s.created_at,
  }))
}

export type StaffMemberInput = { name: string; roleTitle: string; bio: string; photoCloudinaryPublicId?: string | null }

// Admin: add a new staff member.
export async function createStaffMember(input: StaffMemberInput): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('staff_members').insert({
    name: input.name,
    role_title: input.roleTitle,
    bio: input.bio,
    photo_cloudinary_public_id: input.photoCloudinaryPublicId ?? null,
  })
  if (error) return { error: 'Failed to add staff member' }
  return {}
}

// Admin: edit an existing staff member.
export async function updateStaffMember(id: string, input: StaffMemberInput): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('staff_members')
    .update({
      name: input.name,
      role_title: input.roleTitle,
      bio: input.bio,
      photo_cloudinary_public_id: input.photoCloudinaryPublicId ?? null,
    })
    .eq('id', id)
  if (error) return { error: 'Failed to update staff member' }
  return {}
}

// Admin: remove a staff member.
export async function deleteStaffMember(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('staff_members').delete().eq('id', id)
  if (error) return { error: 'Failed to delete staff member' }
  return {}
}
