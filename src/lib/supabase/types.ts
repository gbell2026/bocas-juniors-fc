export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      media: {
        Row: {
          caption: string | null
          cloudinary_public_id: string
          id: string
          pinned: boolean
          published: boolean
          type: Database["public"]["Enums"]["media_type"]
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          cloudinary_public_id: string
          id?: string
          pinned?: boolean
          published?: boolean
          type: Database["public"]["Enums"]["media_type"]
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          cloudinary_public_id?: string
          id?: string
          pinned?: boolean
          published?: boolean
          type?: Database["public"]["Enums"]["media_type"]
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      parents: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          currency: string
          id: string
          notes: string | null
          paid_at: string | null
          parent_id: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          player_id: string
          status: Database["public"]["Enums"]["payment_status_type"]
        }
        Insert: {
          amount: number
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          parent_id: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          player_id: string
          status?: Database["public"]["Enums"]["payment_status_type"]
        }
        Update: {
          amount?: number
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          parent_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          player_id?: string
          status?: Database["public"]["Enums"]["payment_status_type"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          date_of_birth: string
          id: string
          name: string
          parent_id: string
          position: string
          return_date: string | null
          status: Database["public"]["Enums"]["player_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth: string
          id?: string
          name: string
          parent_id: string
          position: string
          return_date?: string | null
          status?: Database["public"]["Enums"]["player_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string
          id?: string
          name?: string
          parent_id?: string
          position?: string
          return_date?: string | null
          status?: Database["public"]["Enums"]["player_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["user_role_type"]
          user_id: string
        }
        Insert: {
          role: Database["public"]["Enums"]["user_role_type"]
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["user_role_type"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      media_type: "photo" | "video"
      payment_method_type: "paypal" | "monzo" | "revolut" | "cash"
      payment_status_type: "succeeded" | "pending" | "failed"
      player_status: "active" | "inactive" | "injured" | "away"
      user_role_type: "parent" | "coach" | "admin" | "player"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      media_type: ["photo", "video"],
      payment_method_type: ["paypal", "monzo", "revolut", "cash"],
      payment_status_type: ["succeeded", "pending", "failed"],
      player_status: ["active", "inactive", "injured", "away"],
      user_role_type: ["parent", "coach", "admin", "player"],
    },
  },
} as const

// Convenience type aliases derived from generated schema
export type Player = Database['public']['Tables']['players']['Row']
export type Parent = Database['public']['Tables']['parents']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type Media = Database['public']['Tables']['media']['Row']
export type UserRoleRow = Database['public']['Tables']['user_roles']['Row']
export type Setting = Database['public']['Tables']['settings']['Row']

export type PlayerStatus = Database['public']['Enums']['player_status']
export type PaymentMethod = Database['public']['Enums']['payment_method_type']
export type PaymentStatus = Database['public']['Enums']['payment_status_type']
export type MediaType = Database['public']['Enums']['media_type']
export type UserRole = Database['public']['Enums']['user_role_type']
