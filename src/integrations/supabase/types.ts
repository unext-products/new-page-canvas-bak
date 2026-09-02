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
      activity_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          parent_id: string | null
          role_scope: string[]
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          parent_id?: string | null
          role_scope?: string[]
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          role_scope?: string[]
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "activity_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          created_at: string
          id: string
          name: string
          program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          name: string
          organization_id: string
          vertical_id: string | null
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          name: string
          organization_id: string
          vertical_id?: string | null
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          name?: string
          organization_id?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_days: {
        Row: {
          created_at: string
          id: string
          leave_date: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leave_date: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leave_date?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      organization_approval_settings: {
        Row: {
          created_at: string
          id: string
          l1_approved_by: string[]
          l1_requires_approval: boolean
          l2_approved_by: string[]
          l2_requires_approval: boolean
          l3_approved_by: string[]
          l3_requires_approval: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          l1_approved_by?: string[]
          l1_requires_approval?: boolean
          l2_approved_by?: string[]
          l2_requires_approval?: boolean
          l3_approved_by?: string[]
          l3_requires_approval?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          l1_approved_by?: string[]
          l1_requires_approval?: boolean
          l2_approved_by?: string[]
          l2_requires_approval?: boolean
          l3_approved_by?: string[]
          l3_requires_approval?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_approval_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_labels: {
        Row: {
          created_at: string
          entity_batch: string
          entity_batch_plural: string
          entity_department: string
          entity_department_plural: string
          entity_program: string
          entity_program_plural: string
          entity_subject: string
          entity_subject_plural: string
          entity_term: string
          entity_term_plural: string
          entity_vertical: string
          entity_vertical_plural: string
          id: string
          organization_id: string | null
          role_manager: string
          role_member: string
          role_org_admin: string
          role_program_manager: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_batch?: string
          entity_batch_plural?: string
          entity_department?: string
          entity_department_plural?: string
          entity_program?: string
          entity_program_plural?: string
          entity_subject?: string
          entity_subject_plural?: string
          entity_term?: string
          entity_term_plural?: string
          entity_vertical?: string
          entity_vertical_plural?: string
          id?: string
          organization_id?: string | null
          role_manager?: string
          role_member?: string
          role_org_admin?: string
          role_program_manager?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_batch?: string
          entity_batch_plural?: string
          entity_department?: string
          entity_department_plural?: string
          entity_program?: string
          entity_program_plural?: string
          entity_subject?: string
          entity_subject_plural?: string
          entity_term?: string
          entity_term_plural?: string
          entity_vertical?: string
          entity_vertical_plural?: string
          id?: string
          organization_id?: string | null
          role_manager?: string
          role_member?: string
          role_org_admin?: string
          role_program_manager?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_role_labels: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role_admin: string
          role_l1: string
          role_l2: string
          role_l3: string
          role_super_admin: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role_admin?: string
          role_l1?: string
          role_l2?: string
          role_l3?: string
          role_super_admin?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role_admin?: string
          role_l1?: string
          role_l2?: string
          role_l3?: string
          role_super_admin?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_role_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deactivated_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          code: string
          created_at: string
          department_id: string | null
          id: string
          name: string
          updated_at: string
          vertical_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          department_id?: string | null
          id?: string
          name: string
          updated_at?: string
          vertical_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string | null
          id?: string
          name?: string
          updated_at?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      reporting_hierarchy: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          key: string
          updated_at: string
          value: string | null
          vertical_id: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: string | null
          vertical_id?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          term_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          term_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_entries: {
        Row: {
          activity_subtype: string | null
          activity_type: string
          approved_at: string | null
          approved_by: string | null
          approver_notes: string | null
          batch_id: string | null
          batch_name: string | null
          created_at: string
          department_code: string | null
          end_time: string
          entry_date: string
          id: string
          notes: string | null
          program_id: string | null
          source: string | null
          start_time: string
          status: Database["public"]["Enums"]["entry_status"]
          subject_code: string | null
          subject_id: string | null
          term_id: string | null
          term_name: string | null
          updated_at: string
          user_id: string
          vertical_code: string | null
          vertical_id: string | null
        }
        Insert: {
          activity_subtype?: string | null
          activity_type: string
          approved_at?: string | null
          approved_by?: string | null
          approver_notes?: string | null
          batch_id?: string | null
          batch_name?: string | null
          created_at?: string
          department_code?: string | null
          end_time: string
          entry_date: string
          id?: string
          notes?: string | null
          program_id?: string | null
          source?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["entry_status"]
          subject_code?: string | null
          subject_id?: string | null
          term_id?: string | null
          term_name?: string | null
          updated_at?: string
          user_id: string
          vertical_code?: string | null
          vertical_id?: string | null
        }
        Update: {
          activity_subtype?: string | null
          activity_type?: string
          approved_at?: string | null
          approved_by?: string | null
          approver_notes?: string | null
          batch_id?: string | null
          batch_name?: string | null
          created_at?: string
          department_code?: string | null
          end_time?: string
          entry_date?: string
          id?: string
          notes?: string | null
          program_id?: string | null
          source?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["entry_status"]
          subject_code?: string | null
          subject_id?: string | null
          term_id?: string | null
          term_name?: string | null
          updated_at?: string
          user_id?: string
          vertical_code?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_thresholds: {
        Row: {
          created_at: string
          id: string
          max_hours_enabled: boolean
          max_hours_minutes: number | null
          organization_id: string
          updated_at: string
          vertical_id: string | null
          work_end_time: string | null
          work_hours_enabled: boolean
          work_start_time: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          max_hours_enabled?: boolean
          max_hours_minutes?: number | null
          organization_id: string
          updated_at?: string
          vertical_id?: string | null
          work_end_time?: string | null
          work_hours_enabled?: boolean
          work_start_time?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          max_hours_enabled?: boolean
          max_hours_minutes?: number | null
          organization_id?: string
          updated_at?: string
          vertical_id?: string | null
          work_end_time?: string | null
          work_hours_enabled?: boolean
          work_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_thresholds_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_batches: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_programs: {
        Row: {
          created_at: string
          id: string
          program_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          organization_id: string | null
          program_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          vertical_id: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          organization_id?: string | null
          program_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          vertical_id?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          organization_id?: string | null
          program_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string | null
          department_id: string | null
          id: string
          key: string
          updated_at: string | null
          user_id: string
          value: string | null
          vertical_id: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          key: string
          updated_at?: string | null
          user_id: string
          value?: string | null
          vertical_id?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          user_id?: string
          value?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_settings_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subjects: {
        Row: {
          created_at: string
          id: string
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_verticals: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vertical_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vertical_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_verticals_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      verticals: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verticals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      working_days: {
        Row: {
          created_at: string
          friday: boolean
          id: string
          monday: boolean
          organization_id: string
          saturday: boolean
          sunday: boolean
          thursday: boolean
          tuesday: boolean
          updated_at: string
          vertical_id: string | null
          wednesday: boolean
        }
        Insert: {
          created_at?: string
          friday?: boolean
          id?: string
          monday?: boolean
          organization_id: string
          saturday?: boolean
          sunday?: boolean
          thursday?: boolean
          tuesday?: boolean
          updated_at?: string
          vertical_id?: string | null
          wednesday?: boolean
        }
        Update: {
          created_at?: string
          friday?: boolean
          id?: string
          monday?: boolean
          organization_id?: string
          saturday?: boolean
          sunday?: boolean
          thursday?: boolean
          tuesday?: boolean
          updated_at?: string
          vertical_id?: string | null
          wednesday?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "working_days_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_reportees: { Args: { p_manager_id: string }; Returns: string[] }
      get_direct_reportees: {
        Args: { p_manager_id: string }
        Returns: string[]
      }
      get_role_level: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      get_transitive_reportees: {
        Args: { p_manager_id: string }
        Returns: string[]
      }
      get_user_batches: { Args: { p_user_id: string }; Returns: string[] }
      get_user_department: { Args: { user_id: string }; Returns: string }
      get_user_departments: { Args: { p_user_id: string }; Returns: string[] }
      get_user_organization: { Args: { user_id: string }; Returns: string }
      get_user_program: { Args: { user_id: string }; Returns: string }
      get_user_programs: { Args: { p_user_id: string }; Returns: string[] }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_subjects: { Args: { p_user_id: string }; Returns: string[] }
      get_user_vertical: { Args: { user_id: string }; Returns: string }
      get_user_verticals: { Args: { p_user_id: string }; Returns: string[] }
      has_reporting_hierarchy: {
        Args: { p_manager_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { p_user_id: string }; Returns: boolean }
      user_in_batch: {
        Args: { p_batch_id: string; p_user_id: string }
        Returns: boolean
      }
      user_in_department: {
        Args: { p_department_id: string; p_user_id: string }
        Returns: boolean
      }
      user_in_program: {
        Args: { p_program_id: string; p_user_id: string }
        Returns: boolean
      }
      user_in_subject: {
        Args: { p_subject_id: string; p_user_id: string }
        Returns: boolean
      }
      user_in_vertical: {
        Args: { p_user_id: string; p_vertical_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type: "class" | "quiz" | "invigilation" | "admin" | "other"
      app_role:
        | "org_admin"
        | "program_manager"
        | "hod"
        | "faculty"
        | "super_admin"
        | "l3"
        | "l2"
        | "l1"
      entry_status: "draft" | "submitted" | "approved" | "rejected"
      leave_type:
        | "casual"
        | "sick"
        | "earned"
        | "half_day"
        | "comp_off"
        | "other"
        | "half_day_first"
        | "half_day_second"
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
      activity_type: ["class", "quiz", "invigilation", "admin", "other"],
      app_role: [
        "org_admin",
        "program_manager",
        "hod",
        "faculty",
        "super_admin",
        "l3",
        "l2",
        "l1",
      ],
      entry_status: ["draft", "submitted", "approved", "rejected"],
      leave_type: [
        "casual",
        "sick",
        "earned",
        "half_day",
        "comp_off",
        "other",
        "half_day_first",
        "half_day_second",
      ],
    },
  },
} as const
