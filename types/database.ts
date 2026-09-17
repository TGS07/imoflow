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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          agency_id: string
          assigned_to: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          end_date: string | null
          id: string
          lead_id: string | null
          notification_id: string | null
          person_id: string | null
          source: string
          title: string
          type: string
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          id?: string
          lead_id?: string | null
          notification_id?: string | null
          person_id?: string | null
          source?: string
          title: string
          type: string
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          id?: string
          lead_id?: string | null
          notification_id?: string | null
          person_id?: string | null
          source?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          created_at: string
          email: string
          email_from_name: string | null
          email_reply_to: string | null
          feed_token: string | null
          followup_first_days: number
          followup_second_days: number
          icloud_app_password: string | null
          icloud_username: string | null
          id: string
          logo_url: string | null
          name: string
          onboarding_completed: boolean
          onboarding_state: Json
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          email_from_name?: string | null
          email_reply_to?: string | null
          feed_token?: string | null
          followup_first_days?: number
          followup_second_days?: number
          icloud_app_password?: string | null
          icloud_username?: string | null
          id?: string
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean
          onboarding_state?: Json
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          email_from_name?: string | null
          email_reply_to?: string | null
          feed_token?: string | null
          followup_first_days?: number
          followup_second_days?: number
          icloud_app_password?: string | null
          icloud_username?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean
          onboarding_state?: Json
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          agency_id: string
          id: string
          lead_id: string
          result: Json | null
          rule_id: string
          status: string
          triggered_at: string
        }
        Insert: {
          agency_id: string
          id?: string
          lead_id: string
          result?: Json | null
          rule_id: string
          status: string
          triggered_at?: string
        }
        Update: {
          agency_id?: string
          id?: string
          lead_id?: string
          result?: Json | null
          rule_id?: string
          status?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          agency_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          pipeline_id: string | null
          trigger_config: Json
          trigger_type: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          agency_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          pipeline_id?: string | null
          trigger_config?: Json
          trigger_type: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          agency_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pipeline_id?: string | null
          trigger_config?: Json
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_interactions: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          note: string | null
          person_id: string
          type: string
          user_id: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          note?: string | null
          person_id: string
          type: string
          user_id?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          note?: string | null
          person_id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_interactions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_interactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_siglas: {
        Row: {
          agency_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          agency_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          agency_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_siglas_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          lead_id: string
          note: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          note?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          note?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts_sync_runs: {
        Row: {
          agency_id: string
          contacts_processed: number
          contacts_seen: number
          id: string
          ran_at: string
        }
        Insert: {
          agency_id: string
          contacts_processed?: number
          contacts_seen?: number
          id?: string
          ran_at?: string
        }
        Update: {
          agency_id?: string
          contacts_processed?: number
          contacts_seen?: number
          id?: string
          ran_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_sync_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          created_at: string
          field_id: string
          id: string
          lead_id: string
          value_date: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          lead_id: string
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          lead_id?: string
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          agency_id: string
          created_at: string
          field_type: string
          id: string
          name: string
          options: Json | null
          position: number
          required: boolean
        }
        Insert: {
          agency_id: string
          created_at?: string
          field_type: string
          id?: string
          name: string
          options?: Json | null
          position?: number
          required?: boolean
        }
        Update: {
          agency_id?: string
          created_at?: string
          field_type?: string
          id?: string
          name?: string
          options?: Json | null
          position?: number
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          agency_id: string
          created_at: string
          entity_id: string
          entity_type: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          name: string
          uploaded_by: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name: string
          uploaded_by?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          agency_id: string
          body: string
          created_at: string
          id: string
          name: string
          subject: string
        }
        Insert: {
          agency_id: string
          body: string
          created_at?: string
          id?: string
          name: string
          subject: string
        }
        Update: {
          agency_id?: string
          body?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      emails_sent: {
        Row: {
          body: string
          id: string
          lead_id: string
          sent_at: string
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          body: string
          id?: string
          lead_id: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string
          id?: string
          lead_id?: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_sent_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_sent_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      idealista_listings: {
        Row: {
          agency_id: string | null
          created_at: string
          extras: string[]
          gmail_message_id: string
          id: string
          link: string
          m2: number | null
          preco: number | null
          raw: Json | null
          tipologia: string | null
          titulo: string | null
          zona: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          extras?: string[]
          gmail_message_id: string
          id?: string
          link: string
          m2?: number | null
          preco?: number | null
          raw?: Json | null
          tipologia?: string | null
          titulo?: string | null
          zona?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          extras?: string[]
          gmail_message_id?: string
          id?: string
          link?: string
          m2?: number | null
          preco?: number | null
          raw?: Json | null
          tipologia?: string | null
          titulo?: string | null
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idealista_listings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      idealista_matches: {
        Row: {
          agency_id: string
          created_at: string
          drafted_message: string | null
          id: string
          lead_id: string
          listing_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["idealista_match_status"]
          user_id: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          drafted_message?: string | null
          id?: string
          lead_id: string
          listing_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["idealista_match_status"]
          user_id?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          drafted_message?: string | null
          id?: string
          lead_id?: string
          listing_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["idealista_match_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idealista_matches_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idealista_matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idealista_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "idealista_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idealista_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      idealista_processed_emails: {
        Row: {
          agency_id: string | null
          gmail_message_id: string
          id: string
          listings_count: number
          processed_at: string
        }
        Insert: {
          agency_id?: string | null
          gmail_message_id: string
          id?: string
          listings_count?: number
          processed_at?: string
        }
        Update: {
          agency_id?: string | null
          gmail_message_id?: string
          id?: string
          listings_count?: number
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "idealista_processed_emails_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_preferences: {
        Row: {
          agency_id: string
          created_at: string
          extras: string[]
          id: string
          is_active: boolean
          lead_id: string | null
          person_id: string | null
          preco_max: number | null
          tipologia_min: string | null
          zonas: string[]
        }
        Insert: {
          agency_id: string
          created_at?: string
          extras?: string[]
          id?: string
          is_active?: boolean
          lead_id?: string | null
          person_id?: string | null
          preco_max?: number | null
          tipologia_min?: string | null
          zonas?: string[]
        }
        Update: {
          agency_id?: string
          created_at?: string
          extras?: string[]
          id?: string
          is_active?: boolean
          lead_id?: string | null
          person_id?: string | null
          preco_max?: number | null
          tipologia_min?: string | null
          zonas?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "lead_preferences_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_preferences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_preferences_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agency_id: string
          assigned_to: string | null
          budget: number | null
          calendar_sync_enabled: boolean
          created_at: string
          deal_value: number | null
          email: string | null
          expected_close_date: string | null
          id: string
          is_regular: boolean
          name: string
          notes: string | null
          organization_id: string | null
          person_id: string | null
          phone: string | null
          pipeline_id: string | null
          portal_token: string | null
          property_id: string | null
          regular_interval_days: number | null
          score: number
          source: string
          stage_entered_at: string
          stage_id: string
          typology: string | null
          zone: string | null
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          budget?: number | null
          calendar_sync_enabled?: boolean
          created_at?: string
          deal_value?: number | null
          email?: string | null
          expected_close_date?: string | null
          id?: string
          is_regular?: boolean
          name: string
          notes?: string | null
          organization_id?: string | null
          person_id?: string | null
          phone?: string | null
          pipeline_id?: string | null
          portal_token?: string | null
          property_id?: string | null
          regular_interval_days?: number | null
          score?: number
          source?: string
          stage_entered_at?: string
          stage_id: string
          typology?: string | null
          zone?: string | null
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          budget?: number | null
          calendar_sync_enabled?: boolean
          created_at?: string
          deal_value?: number | null
          email?: string | null
          expected_close_date?: string | null
          id?: string
          is_regular?: boolean
          name?: string
          notes?: string | null
          organization_id?: string | null
          person_id?: string | null
          phone?: string | null
          pipeline_id?: string | null
          portal_token?: string | null
          property_id?: string | null
          regular_interval_days?: number | null
          score?: number
          source?: string
          stage_entered_at?: string
          stage_id?: string
          typology?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agency_id: string
          body: string
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          agency_id: string
          body: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          agency_id?: string
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          agency_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          agency_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          agency_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          address: string | null
          agency_id: string
          assigned_to: string | null
          birthday: string | null
          calendar_sync_enabled: boolean
          created_at: string
          details: Json
          email: string | null
          financial_capacity: string | null
          id: string
          is_regular: boolean
          is_special: boolean
          last_interaction_at: string | null
          name: string
          notes: string | null
          phone: string | null
          regular_interval_days: number | null
          source: string | null
          special_dates: Json
          special_notify_birthday: boolean
          special_notify_christmas: boolean
          special_notify_easter: boolean
          types: string[]
        }
        Insert: {
          address?: string | null
          agency_id: string
          assigned_to?: string | null
          birthday?: string | null
          calendar_sync_enabled?: boolean
          created_at?: string
          details?: Json
          email?: string | null
          financial_capacity?: string | null
          id?: string
          is_regular?: boolean
          is_special?: boolean
          last_interaction_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          regular_interval_days?: number | null
          source?: string | null
          special_dates?: Json
          special_notify_birthday?: boolean
          special_notify_christmas?: boolean
          special_notify_easter?: boolean
          types?: string[]
        }
        Update: {
          address?: string | null
          agency_id?: string
          assigned_to?: string | null
          birthday?: string | null
          calendar_sync_enabled?: boolean
          created_at?: string
          details?: Json
          email?: string | null
          financial_capacity?: string | null
          id?: string
          is_regular?: boolean
          is_special?: boolean
          last_interaction_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          regular_interval_days?: number | null
          source?: string | null
          special_dates?: Json
          special_notify_birthday?: boolean
          special_notify_christmas?: boolean
          special_notify_easter?: boolean
          types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "people_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          agency_id: string
          color: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          pipeline_id: string | null
          position: number
          probability: number
        }
        Insert: {
          agency_id: string
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          pipeline_id?: string | null
          position?: number
          probability?: number
        }
        Update: {
          agency_id?: string
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          pipeline_id?: string | null
          position?: number
          probability?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          agency_id: string
          card_primary_field: string
          card_secondary_field: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          agency_id: string
          card_primary_field?: string
          card_secondary_field?: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          agency_id?: string
          card_primary_field?: string
          card_secondary_field?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_views: {
        Row: {
          action: string
          created_at: string
          id: string
          lead_id: string
          property_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          lead_id: string
          property_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          lead_id?: string
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_views_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_views_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          agency_id: string
          area_m2: number | null
          area_util_m2: number | null
          bathrooms: number | null
          bedrooms: number | null
          buyer_id: string | null
          city: string | null
          condition: string | null
          construction_year: number | null
          created_at: string
          description: string | null
          energy_certificate: string | null
          features: Json | null
          floor: string | null
          has_elevator: boolean | null
          id: string
          idealista_url: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          parking_spaces: number | null
          photos: Json | null
          postal_code: string | null
          price: number | null
          reference: string | null
          seller_id: string | null
          status: string
          title: string
          type: string
          typology: string | null
          zone: string | null
        }
        Insert: {
          address?: string | null
          agency_id: string
          area_m2?: number | null
          area_util_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          buyer_id?: string | null
          city?: string | null
          condition?: string | null
          construction_year?: number | null
          created_at?: string
          description?: string | null
          energy_certificate?: string | null
          features?: Json | null
          floor?: string | null
          has_elevator?: boolean | null
          id?: string
          idealista_url?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          parking_spaces?: number | null
          photos?: Json | null
          postal_code?: string | null
          price?: number | null
          reference?: string | null
          seller_id?: string | null
          status?: string
          title: string
          type: string
          typology?: string | null
          zone?: string | null
        }
        Update: {
          address?: string | null
          agency_id?: string
          area_m2?: number | null
          area_util_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          buyer_id?: string | null
          city?: string | null
          condition?: string | null
          construction_year?: number | null
          created_at?: string
          description?: string | null
          energy_certificate?: string | null
          features?: Json | null
          floor?: string | null
          has_elevator?: boolean | null
          id?: string
          idealista_url?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          parking_spaces?: number | null
          photos?: Json | null
          postal_code?: string | null
          price?: number | null
          reference?: string | null
          seller_id?: string | null
          status?: string
          title?: string
          type?: string
          typology?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      property_consultants: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          person_id: string
          property_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          person_id: string
          property_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          person_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_consultants_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_consultants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_consultants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_visits: {
        Row: {
          agency_id: string
          agency_name: string | null
          created_at: string
          id: string
          notes: string | null
          person_id: string | null
          property_id: string
          visited_at: string
          visitor_name: string | null
        }
        Insert: {
          agency_id: string
          agency_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          person_id?: string | null
          property_id: string
          visited_at?: string
          visitor_name?: string | null
        }
        Update: {
          agency_id?: string
          agency_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          person_id?: string | null
          property_id?: string
          visited_at?: string
          visitor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_visits_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          agency_id: string
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          agency_id: string
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          agency_id?: string
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean
          created_at: string
          due_date: string | null
          id: string
          lead_id: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          lead_id: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          lead_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          agency_id: string
          avatar_initials: string
          calendar_token: string
          created_at: string
          email: string
          email_notifications: boolean
          id: string
          name: string
          role: string
          telegram_chat_id: string | null
          theme: string
        }
        Insert: {
          agency_id: string
          avatar_initials?: string
          calendar_token?: string
          created_at?: string
          email: string
          email_notifications?: boolean
          id: string
          name: string
          role?: string
          telegram_chat_id?: string | null
          theme?: string
        }
        Update: {
          agency_id?: string
          avatar_initials?: string
          calendar_token?: string
          created_at?: string
          email?: string
          email_notifications?: boolean
          id?: string
          name?: string
          role?: string
          telegram_chat_id?: string | null
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      web_forms: {
        Row: {
          agency_id: string
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          name: string
          stage_id: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name: string
          stage_id?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name?: string
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_forms_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_forms_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          agency_id: string | null
          body: string
          created_at: string
          direction: string
          id: string
          lead_id: string | null
          phone: string
          wa_message_id: string | null
        }
        Insert: {
          agency_id?: string | null
          body: string
          created_at?: string
          direction: string
          id?: string
          lead_id?: string | null
          phone: string
          wa_message_id?: string | null
        }
        Update: {
          agency_id?: string | null
          body?: string
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string | null
          phone?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          agency_id: string
          body: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          agency_id: string
          body: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          agency_id?: string
          body?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      budget_to_capacity: { Args: { budget: number }; Returns: string }
      get_my_agency_id: { Args: never; Returns: string }
      merge_people: {
        Args: { p_duplicate_id: string; p_primary_id: string }
        Returns: undefined
      }
    }
    Enums: {
      idealista_match_status: "pending" | "sent" | "edited" | "ignored"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      idealista_match_status: ["pending", "sent", "edited", "ignored"],
    },
  },
} as const
