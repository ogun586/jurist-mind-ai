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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_number: string | null
          case_type: string
          client_name: string
          created_at: string | null
          description: string | null
          id: string
          next_hearing: string | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          case_number?: string | null
          case_type: string
          client_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          next_hearing?: string | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          case_number?: string | null
          case_type?: string
          client_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          next_hearing?: string | null
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_feedback: {
        Row: {
          created_at: string | null
          id: string
          is_positive: boolean | null
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_positive?: boolean | null
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_positive?: boolean | null
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ctc_audit_log: {
        Row: {
          action: string
          created_at: string
          ctc_file_id: string | null
          details: Json | null
          id: string
          note_id: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          ctc_file_id?: string | null
          details?: Json | null
          id?: string
          note_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          ctc_file_id?: string | null
          details?: Json | null
          id?: string
          note_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ctc_audit_log_ctc_file_id_fkey"
            columns: ["ctc_file_id"]
            isOneToOne: false
            referencedRelation: "ctc_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctc_audit_log_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "judge_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      ctc_comments: {
        Row: {
          content: string
          created_at: string
          ctc_file_id: string
          id: string
          page_number: number | null
          updated_at: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          content: string
          created_at?: string
          ctc_file_id: string
          id?: string
          page_number?: number | null
          updated_at?: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          ctc_file_id?: string
          id?: string
          page_number?: number | null
          updated_at?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ctc_comments_ctc_file_id_fkey"
            columns: ["ctc_file_id"]
            isOneToOne: false
            referencedRelation: "ctc_files"
            referencedColumns: ["id"]
          },
        ]
      }
      ctc_files: {
        Row: {
          bench_judge_name: string | null
          case_reference: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          is_current: boolean
          issuing_court: string | null
          judgment_date: string | null
          mime_type: string
          note_id: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
          version: number
        }
        Insert: {
          bench_judge_name?: string | null
          case_reference?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          is_current?: boolean
          issuing_court?: string | null
          judgment_date?: string | null
          mime_type?: string
          note_id: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          version?: number
        }
        Update: {
          bench_judge_name?: string | null
          case_reference?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          is_current?: boolean
          issuing_court?: string | null
          judgment_date?: string | null
          mime_type?: string
          note_id?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ctc_files_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "judge_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_usage: {
        Row: {
          request_count: number | null
          usage_date: string
          user_id: string
        }
        Insert: {
          request_count?: number | null
          usage_date?: string
          user_id: string
        }
        Update: {
          request_count?: number | null
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      diary_entries: {
        Row: {
          created_at: string | null
          description: string | null
          entry_date: string
          entry_time: string | null
          entry_type: string
          id: string
          next_adjourn_date: string | null
          priority: string | null
          reminder_sent: boolean | null
          status: string | null
          suit_number: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          entry_date: string
          entry_time?: string | null
          entry_type: string
          id?: string
          next_adjourn_date?: string | null
          priority?: string | null
          reminder_sent?: boolean | null
          status?: string | null
          suit_number?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          entry_date?: string
          entry_time?: string | null
          entry_type?: string
          id?: string
          next_adjourn_date?: string | null
          priority?: string | null
          reminder_sent?: boolean | null
          status?: string | null
          suit_number?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          description: string | null
          download_count: number | null
          file_path: string
          file_size: number
          file_url: string
          id: string
          page_count: number | null
          rejection_reason: string | null
          status: string
          title: string
          updated_at: string | null
          uploader_id: string
          uploader_name: string | null
          view_count: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          file_path: string
          file_size: number
          file_url: string
          id?: string
          page_count?: number | null
          rejection_reason?: string | null
          status?: string
          title: string
          updated_at?: string | null
          uploader_id: string
          uploader_name?: string | null
          view_count?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          file_path?: string
          file_size?: number
          file_url?: string
          id?: string
          page_count?: number | null
          rejection_reason?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          uploader_id?: string
          uploader_name?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      email_verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          user_data: string | null
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          user_data?: string | null
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          user_data?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applicant_id: string
          cover_letter: string | null
          created_at: string | null
          id: string
          job_id: string
          status: string | null
        }
        Insert: {
          applicant_id: string
          cover_letter?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          status?: string | null
        }
        Update: {
          applicant_id?: string
          cover_letter?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          applications_count: number | null
          company: string
          created_at: string | null
          description: string
          id: string
          job_type: string
          location: string
          posted_by: string
          salary_range: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          applications_count?: number | null
          company: string
          created_at?: string | null
          description: string
          id?: string
          job_type: string
          location: string
          posted_by: string
          salary_range?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          applications_count?: number | null
          company?: string
          created_at?: string | null
          description?: string
          id?: string
          job_type?: string
          location?: string
          posted_by?: string
          salary_range?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      judge_notes: {
        Row: {
          author_id: string | null
          case_suit_number: string | null
          category: string
          content: string
          court: string
          created_at: string
          id: string
          judge_name: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          case_suit_number?: string | null
          category: string
          content: string
          court: string
          created_at?: string
          id?: string
          judge_name: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          case_suit_number?: string | null
          category?: string
          content?: string
          court?: string
          created_at?: string
          id?: string
          judge_name?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lawyer_credentials: {
        Row: {
          created_at: string | null
          credential_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          lawyer_id: string
          mime_type: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credential_type: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          lawyer_id: string
          mime_type: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credential_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          lawyer_id?: string
          mime_type?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lawyer_credentials_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyer_ratings: {
        Row: {
          created_at: string
          id: string
          lawyer_id: string
          rating: number
          review: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lawyer_id: string
          rating: number
          review?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lawyer_id?: string
          rating?: number
          review?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lawyer_ratings_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyers: {
        Row: {
          availability_status: string | null
          avatar_url: string | null
          bar_number: string | null
          bio_structured: Json | null
          brand_accent_color: string | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          email: string
          firm_logo_url: string | null
          firm_name: string | null
          id: string
          intro_video_url: string | null
          location: string | null
          name: string
          phone: string | null
          postal_code: string | null
          profile_views: number | null
          rating: number | null
          slug: string | null
          social_media: string | null
          specialization: string[] | null
          state: string
          street: string | null
          total_ratings: number | null
          updated_at: string | null
          user_id: string | null
          verification_notes: string | null
          verification_status: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
          website: string | null
          years_experience: number | null
        }
        Insert: {
          availability_status?: string | null
          avatar_url?: string | null
          bar_number?: string | null
          bio_structured?: Json | null
          brand_accent_color?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email: string
          firm_logo_url?: string | null
          firm_name?: string | null
          id?: string
          intro_video_url?: string | null
          location?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          profile_views?: number | null
          rating?: number | null
          slug?: string | null
          social_media?: string | null
          specialization?: string[] | null
          state: string
          street?: string | null
          total_ratings?: number | null
          updated_at?: string | null
          user_id?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
          years_experience?: number | null
        }
        Update: {
          availability_status?: string | null
          avatar_url?: string | null
          bar_number?: string | null
          bio_structured?: Json | null
          brand_accent_color?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string
          firm_logo_url?: string | null
          firm_name?: string | null
          id?: string
          intro_video_url?: string | null
          location?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          profile_views?: number | null
          rating?: number | null
          slug?: string | null
          social_media?: string | null
          specialization?: string[] | null
          state?: string
          street?: string | null
          total_ratings?: number | null
          updated_at?: string | null
          user_id?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          expires_at: string | null
          id: number
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          expires_at?: string | null
          id?: never
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          expires_at?: string | null
          id?: never
          title?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_id: string
          created_at: string | null
          delivery_status: string | null
          id: string
          payment_status: string | null
          product_id: string
          quantity: number
          seller_id: string
          seller_paid: boolean | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          created_at?: string | null
          delivery_status?: string | null
          id?: string
          payment_status?: string | null
          product_id: string
          quantity: number
          seller_id: string
          seller_paid?: boolean | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          created_at?: string | null
          delivery_status?: string | null
          id?: string
          payment_status?: string | null
          product_id?: string
          quantity?: number
          seller_id?: string
          seller_paid?: boolean | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          card_brand: string | null
          created_at: string | null
          exp_month: number | null
          exp_year: number | null
          id: number
          last4: string | null
          stripe_payment_method_id: string
          user_id: string
        }
        Insert: {
          card_brand?: string | null
          created_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: never
          last4?: string | null
          stripe_payment_method_id: string
          user_id: string
        }
        Update: {
          card_brand?: string | null
          created_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: never
          last4?: string | null
          stripe_payment_method_id?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          payment_type: string
          paystack_reference: string | null
          reference: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          payment_type: string
          paystack_reference?: string | null
          reference: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          payment_type?: string
          paystack_reference?: string | null
          reference?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string | null
          daily_request_limit: number | null
          description: string | null
          duration_days: number
          features: Json | null
          id: string
          monthly_points: number | null
          name: string
          paystack_plan_id: string | null
          plan_key: string
          price_ngn: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          daily_request_limit?: number | null
          description?: string | null
          duration_days: number
          features?: Json | null
          id?: string
          monthly_points?: number | null
          name: string
          paystack_plan_id?: string | null
          plan_key: string
          price_ngn: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          daily_request_limit?: number | null
          description?: string | null
          duration_days?: number
          features?: Json | null
          id?: string
          monthly_points?: number | null
          name?: string
          paystack_plan_id?: string | null
          plan_key?: string
          price_ngn?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string | null
          description: string
          file_url: string | null
          id: string
          price: number
          rating: number | null
          seller_id: string
          title: string
          total_ratings: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          file_url?: string | null
          id?: string
          price: number
          rating?: number | null
          seller_id: string
          title: string
          total_ratings?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          file_url?: string | null
          id?: string
          price?: number
          rating?: number | null
          seller_id?: string
          title?: string
          total_ratings?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          plan_expires_at: string | null
          plan_key: string | null
          plan_started_at: string | null
          updated_at: string
          user_id: string
          user_type: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          plan_expires_at?: string | null
          plan_key?: string | null
          plan_started_at?: string | null
          updated_at?: string
          user_id: string
          user_type?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          plan_expires_at?: string | null
          plan_key?: string | null
          plan_started_at?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["plan_key"]
          },
        ]
      }
      serves: {
        Row: {
          created_at: string | null
          doc_url: string
          id: number
          recipient_id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          doc_url: string
          id?: number
          recipient_id: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          doc_url?: string
          id?: number
          recipient_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          created_at: string | null
          expires_at: string
          id: string
          paystack_reference: string | null
          plan: string
          started_at: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          expires_at: string
          id?: string
          paystack_reference?: string | null
          plan: string
          started_at?: string
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          paystack_reference?: string | null
          plan?: string
          started_at?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      usage_daily: {
        Row: {
          count: number
          created_at: string | null
          id: string
          updated_at: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          created_at: string | null
          credits_remaining: number | null
          id: string
          is_premium: boolean | null
          last_credit_reset: string | null
          premium_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credits_remaining?: number | null
          id?: string
          is_premium?: boolean | null
          last_credit_reset?: string | null
          premium_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credits_remaining?: number | null
          id?: string
          is_premium?: boolean | null
          last_credit_reset?: string | null
          premium_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          email_notifications: boolean | null
          id: string
          language: string | null
          notifications_enabled: boolean | null
          theme: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          language?: string | null
          notifications_enabled?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          language?: string | null
          notifications_enabled?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          created_at: string | null
          id: string
          points_used: number | null
          requests_count: number | null
          updated_at: string | null
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          points_used?: number | null
          requests_count?: number | null
          updated_at?: string | null
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          points_used?: number | null
          requests_count?: number | null
          updated_at?: string | null
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_user_make_request: { Args: { p_user_id?: string }; Returns: Json }
      check_and_increment_usage: { Args: never; Returns: Json }
      cleanup_old_usage: { Args: never; Returns: undefined }
      get_admin_uid: { Args: never; Returns: string }
      get_subscription: { Args: { p_user_id?: string }; Returns: Json }
      get_usage_stats: { Args: never; Returns: Json }
      get_user_plan: { Args: { p_user_id?: string }; Returns: Json }
      increment_application_count: {
        Args: { job_id: string }
        Returns: undefined
      }
      increment_document_downloads: {
        Args: { doc_id: string }
        Returns: undefined
      }
      increment_document_views: { Args: { doc_id: string }; Returns: undefined }
      increment_lawyer_views: {
        Args: { lawyer_slug: string }
        Returns: undefined
      }
      increment_usage: {
        Args: { p_date?: string; p_user_id?: string }
        Returns: number
      }
      increment_user_usage: {
        Args: { p_points?: number; p_user_id?: string }
        Returns: undefined
      }
      reset_daily_credits: { Args: never; Returns: undefined }
      upgrade_user_plan: {
        Args: {
          p_payment_reference?: string
          p_plan_key: string
          p_user_id: string
        }
        Returns: Json
      }
      use_credit: { Args: { user_uuid: string }; Returns: boolean }
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
