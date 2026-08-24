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
      announcement_comments: {
        Row: {
          announcement_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          author_name: string
          body: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_budgets: {
        Row: {
          id: string
          season_id: string
          category_id: string
          target_amount_cents: number
        }
        Insert: {
          id?: string
          season_id: string
          category_id: string
          target_amount_cents: number
        }
        Update: {
          id?: string
          season_id?: string
          category_id?: string
          target_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "finance_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_categories: {
        Row: {
          id: string
          name: string
          kind: Database["public"]["Enums"]["finance_category_kind"]
          auto_source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          kind: Database["public"]["Enums"]["finance_category_kind"]
          auto_source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          kind?: Database["public"]["Enums"]["finance_category_kind"]
          auto_source?: string | null
          created_at?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          id: string
          season_id: string
          category_id: string
          amount_cents: number
          entry_date: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          season_id: string
          category_id: string
          amount_cents: number
          entry_date: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          season_id?: string
          category_id?: string
          amount_cents?: number
          entry_date?: string
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "finance_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_seasons: {
        Row: {
          id: string
          label: string
          start_date: string
          end_date: string
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          start_date: string
          end_date: string
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          start_date?: string
          end_date?: string
          created_at?: string
        }
        Relationships: []
      }
      get_involved_submissions: {
        Row: {
          email: string
          handled: boolean
          id: string
          interests: string[]
          message: string | null
          name: string
          organisation: string | null
          submitted_at: string
        }
        Insert: {
          email: string
          handled?: boolean
          id?: string
          interests: string[]
          message?: string | null
          name: string
          organisation?: string | null
          submitted_at?: string
        }
        Update: {
          email?: string
          handled?: boolean
          id?: string
          interests?: string[]
          message?: string | null
          name?: string
          organisation?: string | null
          submitted_at?: string
        }
        Relationships: []
      }
      league_clubs: {
        Row: {
          badge_cloudinary_public_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["league_status_type"]
          updated_at: string
        }
        Insert: {
          badge_cloudinary_public_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["league_status_type"]
          updated_at?: string
        }
        Update: {
          badge_cloudinary_public_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["league_status_type"]
          updated_at?: string
        }
        Relationships: []
      }
      league_divisions: {
        Row: {
          created_at: string
          id: string
          name: string
          season_end_date: string
          season_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          season_end_date: string
          season_start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          season_end_date?: string
          season_start_date?: string
        }
        Relationships: []
      }
      league_fixtures: {
        Row: {
          away_score: number | null
          away_team_id: string
          cancelled: boolean
          created_at: string
          division_id: string
          home_score: number | null
          home_team_id: string
          id: string
          kickoff: string | null
          match_date: string
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          cancelled?: boolean
          created_at?: string
          division_id: string
          home_score?: number | null
          home_team_id: string
          id?: string
          kickoff?: string | null
          match_date: string
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          cancelled?: boolean
          created_at?: string
          division_id?: string
          home_score?: number | null
          home_team_id?: string
          id?: string
          kickoff?: string | null
          match_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "league_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_fixtures_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "league_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "league_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      league_players: {
        Row: {
          created_at: string
          date_of_birth: string
          id: string
          name: string
          squad_number: number
          status: Database["public"]["Enums"]["league_status_type"]
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth: string
          id?: string
          name: string
          squad_number: number
          status?: Database["public"]["Enums"]["league_status_type"]
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string
          id?: string
          name?: string
          squad_number?: number
          status?: Database["public"]["Enums"]["league_status_type"]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "league_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      league_teams: {
        Row: {
          club_id: string
          created_at: string
          division_id: string
          id: string
          name: string
          status: Database["public"]["Enums"]["league_status_type"]
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          division_id: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["league_status_type"]
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          division_id?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["league_status_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "league_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_teams_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "league_divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          caption: string | null
          cloudinary_public_id: string
          id: string
          pinned: boolean
          published: boolean
          submitter_name: string | null
          type: Database["public"]["Enums"]["media_type"]
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          cloudinary_public_id: string
          id?: string
          pinned?: boolean
          published?: boolean
          submitter_name?: string | null
          type: Database["public"]["Enums"]["media_type"]
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          cloudinary_public_id?: string
          id?: string
          pinned?: boolean
          published?: boolean
          submitter_name?: string | null
          type?: Database["public"]["Enums"]["media_type"]
          uploaded_at?: string
          uploaded_by?: string | null
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
          installment_label:
            | Database["public"]["Enums"]["installment_label_type"]
            | null
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
          installment_label?:
            | Database["public"]["Enums"]["installment_label_type"]
            | null
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
          installment_label?:
            | Database["public"]["Enums"]["installment_label_type"]
            | null
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
          age_groups: string[]
          created_at: string
          date_of_birth: string
          id: string
          join_month: Database["public"]["Enums"]["join_month_type"]
          name: string
          parent_id: string
          payment_plan: Database["public"]["Enums"]["payment_plan_type"]
          position: string
          return_date: string | null
          status: Database["public"]["Enums"]["player_status"]
          user_id: string | null
        }
        Insert: {
          age_groups?: string[]
          created_at?: string
          date_of_birth: string
          id?: string
          join_month?: Database["public"]["Enums"]["join_month_type"]
          name: string
          parent_id: string
          payment_plan?: Database["public"]["Enums"]["payment_plan_type"]
          position: string
          return_date?: string | null
          status?: Database["public"]["Enums"]["player_status"]
          user_id?: string | null
        }
        Update: {
          age_groups?: string[]
          created_at?: string
          date_of_birth?: string
          id?: string
          join_month?: Database["public"]["Enums"]["join_month_type"]
          name?: string
          parent_id?: string
          payment_plan?: Database["public"]["Enums"]["payment_plan_type"]
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
      practices: {
        Row: {
          cancelled: boolean
          created_at: string
          id: string
          location: string | null
          notes: string | null
          practice_date: string
          practice_time: string
        }
        Insert: {
          cancelled?: boolean
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          practice_date: string
          practice_time: string
        }
        Update: {
          cancelled?: boolean
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          practice_date?: string
          practice_time?: string
        }
        Relationships: []
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
      staff_members: {
        Row: {
          background: string | null
          bio: string
          created_at: string
          favourite_team: string | null
          fun_fact: string | null
          id: string
          name: string
          nationality: string | null
          one_line_intro: string | null
          philosophy: string | null
          photo_cloudinary_public_id: string | null
          qualifications: string | null
          role_title: string
        }
        Insert: {
          background?: string | null
          bio: string
          created_at?: string
          favourite_team?: string | null
          fun_fact?: string | null
          id?: string
          name: string
          nationality?: string | null
          one_line_intro?: string | null
          philosophy?: string | null
          photo_cloudinary_public_id?: string | null
          qualifications?: string | null
          role_title: string
        }
        Update: {
          background?: string | null
          bio?: string
          created_at?: string
          favourite_team?: string | null
          fun_fact?: string | null
          id?: string
          name?: string
          nationality?: string | null
          one_line_intro?: string | null
          philosophy?: string | null
          photo_cloudinary_public_id?: string | null
          qualifications?: string | null
          role_title?: string
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
      finance_category_kind: "income" | "expense"
      installment_label_type:
        | "full"
        | "august"
        | "september"
        | "october"
        | "november"
        | "registration"
      join_month_type: "august" | "september" | "october" | "november"
      league_status_type: "pending" | "approved" | "rejected"
      media_type: "photo" | "video"
      payment_method_type: "paypal" | "monzo" | "revolut" | "cash"
      payment_plan_type: "full" | "monthly"
      payment_status_type: "succeeded" | "pending" | "failed"
      player_status: "active" | "inactive" | "injured" | "away" | "cancelled"
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
      finance_category_kind: ["income", "expense"],
      installment_label_type: [
        "full",
        "august",
        "september",
        "october",
        "november",
        "registration",
      ],
      join_month_type: ["august", "september", "october", "november"],
      league_status_type: ["pending", "approved", "rejected"],
      media_type: ["photo", "video"],
      payment_method_type: ["paypal", "monzo", "revolut", "cash"],
      payment_plan_type: ["full", "monthly"],
      payment_status_type: ["succeeded", "pending", "failed"],
      player_status: ["active", "inactive", "injured", "away", "cancelled"],
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
export type GetInvolvedSubmission = Database['public']['Tables']['get_involved_submissions']['Row']
export type PaymentPlan = Database['public']['Enums']['payment_plan_type']
export type InstallmentLabel = Database['public']['Enums']['installment_label_type']
export type LeagueStatus = Database['public']['Enums']['league_status_type']
export type LeagueClub = Database['public']['Tables']['league_clubs']['Row']
export type LeagueDivision = Database['public']['Tables']['league_divisions']['Row']
export type LeagueTeam = Database['public']['Tables']['league_teams']['Row']
export type LeaguePlayer = Database['public']['Tables']['league_players']['Row']
export type LeagueFixture = Database['public']['Tables']['league_fixtures']['Row']
export type AnnouncementRow = Database['public']['Tables']['announcements']['Row']
export type AnnouncementCommentRow = Database['public']['Tables']['announcement_comments']['Row']
export type StaffMemberRow = Database['public']['Tables']['staff_members']['Row']
export type Practice = Database['public']['Tables']['practices']['Row']
