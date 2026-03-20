// Generated after running: npx supabase gen types typescript --linked > src/lib/supabase/types.ts
// This file will be overwritten — do not edit manually after schema is applied.

export type PlayerStatus = 'active' | 'inactive' | 'injured' | 'away'
export type PaymentMethod = 'paypal' | 'monzo' | 'revolut' | 'cash'
export type PaymentStatus = 'succeeded' | 'pending' | 'failed'
export type MediaType = 'photo' | 'video'
export type UserRole = 'parent' | 'coach' | 'admin' | 'player'

export type Player = {
  id: string; user_id: string | null; parent_id: string
  name: string; date_of_birth: string; position: string
  status: PlayerStatus; return_date: string | null; created_at: string
}
export type Parent = {
  id: string; user_id: string; name: string
  email: string; phone: string; created_at: string
}
export type Payment = {
  id: string; parent_id: string; player_id: string
  payment_method: PaymentMethod; amount: number; currency: string
  status: PaymentStatus; paid_at: string | null; notes: string | null
}
export type Media = {
  id: string; cloudinary_public_id: string; type: MediaType
  caption: string | null; pinned: boolean
  uploaded_by: string; uploaded_at: string; published: boolean
}
export type UserRoleRow = { user_id: string; role: UserRole }
export type Setting = { key: string; value: string; updated_at: string }

export type Database = {
  public: {
    Tables: {
      players: { Row: Player; Insert: Omit<Player, 'id' | 'created_at'>; Update: Partial<Player> }
      parents: { Row: Parent; Insert: Omit<Parent, 'id' | 'created_at'>; Update: Partial<Parent> }
      payments: { Row: Payment; Insert: Omit<Payment, 'id'>; Update: Partial<Payment> }
      media: { Row: Media; Insert: Omit<Media, 'id'>; Update: Partial<Media> }
      user_roles: { Row: UserRoleRow; Insert: UserRoleRow; Update: Partial<UserRoleRow> }
      settings: { Row: Setting; Insert: Setting; Update: Partial<Setting> }
    }
  }
}
