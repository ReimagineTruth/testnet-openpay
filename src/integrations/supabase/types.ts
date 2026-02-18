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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_self_send_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          reason: string
          reviewed_by_email: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          reason?: string
          reviewed_by_email: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          reason?: string
          reviewed_by_email?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_self_send_reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_response: string | null
          created_at: string
          description: string
          id: string
          reason: string
          status: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          description?: string
          id?: string
          reason?: string
          status?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          description?: string
          id?: string
          reason?: string
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          recipient_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          recipient_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          recipient_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ledger_events: {
        Row: {
          actor_user_id: string | null
          amount: number | null
          event_type: string
          id: string
          note: string | null
          occurred_at: string
          payload: Json
          recorded_at: string
          related_user_id: string | null
          source_id: string
          source_table: string
          status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          amount?: number | null
          event_type: string
          id?: string
          note?: string | null
          occurred_at?: string
          payload?: Json
          recorded_at?: string
          related_user_id?: string | null
          source_id: string
          source_table: string
          status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          amount?: number | null
          event_type?: string
          id?: string
          note?: string | null
          occurred_at?: string
          payload?: Json
          recorded_at?: string
          related_user_id?: string | null
          source_id?: string
          source_table?: string
          status?: string | null
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          payer_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          payer_id: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payer_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pi_payment_credits: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_id: string
          status: string
          txid: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_id: string
          status?: string
          txid?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_id?: string
          status?: string
          txid?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          referral_code: string
          referred_by_user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          referral_code?: string
          referred_by_user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          referral_code?: string
          referred_by_user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          referred_user_id: string
          referrer_user_id: string
          reward_amount: number
          status: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_user_id: string
          reward_amount?: number
          status?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
          reward_amount?: number
          status?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      user_accounts: {
        Row: {
          account_name: string
          account_number: string
          account_username: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string
          account_number: string
          account_username?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          account_username?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supported_currencies: {
        Row: {
          created_at: string
          display_code: string
          display_name: string
          flag: string
          is_active: boolean
          iso_code: string
          symbol: string
          updated_at: string
          usd_rate: number
        }
        Insert: {
          created_at?: string
          display_code: string
          display_name: string
          flag: string
          is_active?: boolean
          iso_code: string
          symbol: string
          updated_at?: string
          usd_rate: number
        }
        Update: {
          created_at?: string
          display_code?: string
          display_name?: string
          flag?: string
          is_active?: boolean
          iso_code?: string
          symbol?: string
          updated_at?: string
          usd_rate?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          hide_balance: boolean
          merchant_onboarding_data: Json
          onboarding_completed: boolean
          onboarding_step: number
          profile_full_name: string | null
          profile_username: string | null
          qr_print_settings: Json
          reference_code: string | null
          security_settings: Json
          updated_at: string
          usage_agreement_accepted: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          hide_balance?: boolean
          merchant_onboarding_data?: Json
          onboarding_completed?: boolean
          onboarding_step?: number
          profile_full_name?: string | null
          profile_username?: string | null
          qr_print_settings?: Json
          reference_code?: string | null
          security_settings?: Json
          updated_at?: string
          usage_agreement_accepted?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          hide_balance?: boolean
          merchant_onboarding_data?: Json
          onboarding_completed?: boolean
          onboarding_step?: number
          profile_full_name?: string | null
          profile_username?: string | null
          qr_print_settings?: Json
          reference_code?: string | null
          security_settings?: Json
          updated_at?: string
          usage_agreement_accepted?: boolean
          user_id?: string
        }
        Relationships: []
      }
      virtual_cards: {
        Row: {
          card_number: string
          card_settings: Json
          card_username: string
          cardholder_name: string
          created_at: string
          cvc: string
          hide_details: boolean
          expiry_month: number
          expiry_year: number
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_number: string
          card_settings?: Json
          card_username?: string
          cardholder_name?: string
          created_at?: string
          cvc: string
          hide_details?: boolean
          expiry_month: number
          expiry_year: number
          id?: string
          is_active?: boolean
          is_locked?: boolean
          locked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_number?: string
          card_settings?: Json
          card_username?: string
          cardholder_name?: string
          created_at?: string
          cvc?: string
          hide_details?: boolean
          expiry_month?: number
          expiry_year?: number
          id?: string
          is_active?: boolean
          is_locked?: boolean
          locked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          id: string
          updated_at: string
          user_id: string
          welcome_bonus_claimed_at: string | null
        }
        Insert: {
          balance?: number
          id?: string
          updated_at?: string
          user_id: string
          welcome_bonus_claimed_at?: string | null
        }
        Update: {
          balance?: number
          id?: string
          updated_at?: string
          user_id?: string
          welcome_bonus_claimed_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_dashboard_history:
        | { Args: never; Returns: Json }
        | { Args: { p_limit: number; p_offset: number }; Returns: Json }
      admin_refund_self_send: {
        Args: {
          p_admin_email?: string
          p_decision: string
          p_reason?: string
          p_transaction_id: string
        }
        Returns: Json
      }
      claim_welcome_bonus: {
        Args: never
        Returns: Json
      }
      claim_referral_rewards: {
        Args: never
        Returns: Json
      }
      find_user_by_account_number: {
        Args: { p_account_number: string }
        Returns: {
          avatar_url: string | null
          full_name: string
          id: string
          username: string | null
        }[]
      }
      is_transaction_participant: {
        Args: { _transaction_id: string }
        Returns: boolean
      }
      pay_with_virtual_card_checkout: {
        Args: {
          p_amount: number
          p_card_number: string
          p_cvc: string
          p_expiry_month: number
          p_expiry_year: number
          p_note?: string
          p_receiver_id: string
        }
        Returns: string
      }
      transfer_funds: {
        Args: {
          p_amount: number
          p_note?: string
          p_receiver_id: string
          p_sender_id: string
        }
        Returns: string
      }
      update_my_virtual_card_controls: {
        Args: {
          p_card_settings?: Json | null
          p_hide_details?: boolean | null
          p_lock_card?: boolean | null
        }
        Returns: {
          card_number: string
          card_settings: Json
          card_username: string
          cardholder_name: string
          created_at: string
          cvc: string
          hide_details: boolean
          expiry_month: number
          expiry_year: number
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
      }
      upsert_my_user_account: {
        Args: never
        Returns: {
          account_name: string
          account_number: string
          account_username: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
      }
      upsert_my_virtual_card: {
        Args: { p_cardholder_name?: string | null; p_card_username?: string | null }
        Returns: {
          card_number: string
          card_settings: Json
          card_username: string
          cardholder_name: string
          created_at: string
          cvc: string
          hide_details: boolean
          expiry_month: number
          expiry_year: number
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
