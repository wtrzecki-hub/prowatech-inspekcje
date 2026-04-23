export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      client_users: {
        Row: {
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          is_deleted: boolean
          name: string
          nip: string | null
          notes: string | null
          short_name: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_deleted?: boolean
          name: string
          nip?: string | null
          notes?: string | null
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_deleted?: boolean
          name?: string
          nip?: string | null
          notes?: string | null
          short_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_library: {
        Row: {
          category: string
          code: string
          created_at: string
          description_template: string | null
          element_section: string | null
          id: string
          is_active: boolean
          name_pl: string
          recommendation_template: string | null
          typical_rating: Database["public"]["Enums"]["condition_rating"] | null
          typical_urgency: Database["public"]["Enums"]["urgency_level"] | null
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description_template?: string | null
          element_section?: string | null
          id?: string
          is_active?: boolean
          name_pl: string
          recommendation_template?: string | null
          typical_rating?: Database["public"]["Enums"]["condition_rating"] | null
          typical_urgency?: Database["public"]["Enums"]["urgency_level"] | null
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description_template?: string | null
          element_section?: string | null
          id?: string
          is_active?: boolean
          name_pl?: string
          recommendation_template?: string | null
          typical_rating?: Database["public"]["Enums"]["condition_rating"] | null
          typical_urgency?: Database["public"]["Enums"]["urgency_level"] | null
          updated_at?: string
        }
        Relationships: []
      }
      electrical_measurements: {
        Row: {
          created_at: string
          grounding_resistance_ohm: number | null
          grounding_result: string | null
          id: string
          inspection_id: string
          instrument_info: string | null
          insulation_resistance_mohm: number | null
          insulation_result: string | null
          loop_impedance_ohm: number | null
          loop_impedance_result: string | null
          measured_by: string | null
          measurement_date: string | null
          measurement_point: string
          notes: string | null
          pe_continuity_ohm: number | null
          pe_continuity_result: string | null
          rcd_result: string | null
          rcd_trip_time_ms: number | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          grounding_resistance_ohm?: number | null
          grounding_result?: string | null
          id?: string
          inspection_id: string
          instrument_info?: string | null
          insulation_resistance_mohm?: number | null
          insulation_result?: string | null
          loop_impedance_ohm?: number | null
          loop_impedance_result?: string | null
          measured_by?: string | null
          measurement_date?: string | null
          measurement_point: string
          notes?: string | null
          pe_continuity_ohm?: number | null
          pe_continuity_result?: string | null
          rcd_result?: string | null
          rcd_trip_time_ms?: number | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          grounding_resistance_ohm?: number | null
          grounding_result?: string | null
          id?: string
          inspection_id?: string
          instrument_info?: string | null
          insulation_resistance_mohm?: number | null
          insulation_result?: string | null
          loop_impedance_ohm?: number | null
          loop_impedance_result?: string | null
          measured_by?: string | null
          measurement_date?: string | null
          measurement_point?: string
          notes?: string | null
          pe_continuity_ohm?: number | null
          pe_continuity_result?: string | null
          rcd_result?: string | null
          rcd_trip_time_ms?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "electrical_measurements_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electrical_measurements_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_inspection_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_element_definitions: {
        Row: {
          applicable_standards: string | null
          applies_to_annual: boolean
          applies_to_five_year: boolean
          element_number: number
          id: string
          is_active: boolean
          name_pl: string
          name_short: string | null
          scope_annual: string | null
          scope_five_year_additional: string | null
          section_code: string
          sort_order: number
        }
        Insert: {
          applicable_standards?: string | null
          applies_to_annual?: boolean
          applies_to_five_year?: boolean
          element_number: number
          id?: string
          is_active?: boolean
          name_pl: string
          name_short?: string | null
          scope_annual?: string | null
          scope_five_year_additional?: string | null
          section_code: string
          sort_order: number
        }
        Update: {
          applicable_standards?: string | null
          applies_to_annual?: boolean
          applies_to_five_year?: boolean
          element_number?: number
          id?: string
          is_active?: boolean
          name_pl?: string
          name_short?: string | null
          scope_annual?: string | null
          scope_five_year_additional?: string | null
          section_code?: string
          sort_order?: number
        }
        Relationships: []
      }
      inspection_elements: {
        Row: {
          condition_rating: Database["public"]["Enums"]["condition_rating"] | null
          created_at: string
          detailed_description: string | null
          element_definition_id: string
          id: string
          inspection_id: string
          is_not_applicable: boolean
          notes: string | null
          photo_numbers: string | null
          recommendations: string | null
          updated_at: string
          wear_percentage: number | null
        }
        Insert: {
          condition_rating?: Database["public"]["Enums"]["condition_rating"] | null
          created_at?: string
          detailed_description?: string | null
          element_definition_id: string
          id?: string
          inspection_id: string
          is_not_applicable?: boolean
          notes?: string | null
          photo_numbers?: string | null
          recommendations?: string | null
          updated_at?: string
          wear_percentage?: number | null
        }
        Update: {
          condition_rating?: Database["public"]["Enums"]["condition_rating"] | null
          created_at?: string
          detailed_description?: string | null
          element_definition_id?: string
          id?: string
          inspection_id?: string
          is_not_applicable?: boolean
          notes?: string | null
          photo_numbers?: string | null
          recommendations?: string | null
          updated_at?: string
          wear_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_elements_element_definition_id_fkey"
            columns: ["element_definition_id"]
            isOneToOne: false
            referencedRelation: "inspection_element_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_elements_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_elements_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_inspection_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_inspectors: {
        Row: {
          id: string
          inspection_id: string
          inspector_id: string
          is_lead: boolean
          specialty: Database["public"]["Enums"]["inspector_specialty"]
        }
        Insert: {
          id?: string
          inspection_id: string
          inspector_id: string
          is_lead?: boolean
          specialty: Database["public"]["Enums"]["inspector_specialty"]
        }
        Update: {
          id?: string
          inspection_id?: string
          inspector_id?: string
          is_lead?: boolean
          specialty?: Database["public"]["Enums"]["inspector_specialty"]
        }
        Relationships: [
          {
            foreignKeyName: "inspection_inspectors_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_inspectors_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_inspection_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_inspectors_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_photos: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          element_id: string | null
          file_url: string | null
          google_drive_file_id: string | null
          id: string
          inspection_id: string
          photo_number: number | null
          sort_order: number | null
          taken_at: string | null
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          element_id?: string | null
          file_url?: string | null
          google_drive_file_id?: string | null
          id?: string
          inspection_id: string
          photo_number?: number | null
          sort_order?: number | null
          taken_at?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          element_id?: string | null
          file_url?: string | null
          google_drive_file_id?: string | null
          id?: string
          inspection_id?: string
          photo_number?: number | null
          sort_order?: number | null
          taken_at?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_photos_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "inspection_elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_inspection_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          committee_members: string | null
          created_at: string
          created_by: string | null
          generated_pdf_url: string | null
          google_drive_folder_url: string | null
          hazard_information: string | null
          id: string
          inspection_date: string | null
          inspection_type: Database["public"]["Enums"]["inspection_type"]
          inspector_signature_date: string | null
          inspector_signature_location: string | null
          is_deleted: boolean
          legal_basis: string | null
          next_annual_date: string | null
          next_electrical_date: string | null
          next_five_year_date: string | null
          notes: string | null
          overall_assessment: string | null
          overall_condition_rating: Database["public"]["Enums"]["condition_rating"] | null
          owner_representative_name: string | null
          owner_signature_date: string | null
          owner_signature_location: string | null
          previous_annual_date: string | null
          previous_annual_protocol: string | null
          previous_findings: string | null
          previous_five_year_date: string | null
          previous_recommendations_status: string | null
          protocol_number: string | null
          site_visit_date: string | null
          status: Database["public"]["Enums"]["inspection_status"]
          turbine_id: string
          updated_at: string
        }
        Insert: {
          committee_members?: string | null
          created_at?: string
          created_by?: string | null
          generated_pdf_url?: string | null
          google_drive_folder_url?: string | null
          hazard_information?: string | null
          id?: string
          inspection_date?: string | null
          inspection_type: Database["public"]["Enums"]["inspection_type"]
          inspector_signature_date?: string | null
          inspector_signature_location?: string | null
          is_deleted?: boolean
          legal_basis?: string | null
          next_annual_date?: string | null
          next_electrical_date?: string | null
          next_five_year_date?: string | null
          notes?: string | null
          overall_assessment?: string | null
          overall_condition_rating?: Database["public"]["Enums"]["condition_rating"] | null
          owner_representative_name?: string | null
          owner_signature_date?: string | null
          owner_signature_location?: string | null
          previous_annual_date?: string | null
          previous_annual_protocol?: string | null
          previous_findings?: string | null
          previous_five_year_date?: string | null
          previous_recommendations_status?: string | null
          protocol_number?: string | null
          site_visit_date?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          turbine_id: string
          updated_at?: string
        }
        Update: {
          committee_members?: string | null
          created_at?: string
          created_by?: string | null
          generated_pdf_url?: string | null
          google_drive_folder_url?: string | null
          hazard_information?: string | null
          id?: string
          inspection_date?: string | null
          inspection_type?: Database["public"]["Enums"]["inspection_type"]
          inspector_signature_date?: string | null
          inspector_signature_location?: string | null
          is_deleted?: boolean
          legal_basis?: string | null
          next_annual_date?: string | null
          next_electrical_date?: string | null
          next_five_year_date?: string | null
          notes?: string | null
          overall_assessment?: string | null
          overall_condition_rating?: Database["public"]["Enums"]["condition_rating"] | null
          owner_representative_name?: string | null
          owner_signature_date?: string | null
          owner_signature_location?: string | null
          previous_annual_date?: string | null
          previous_annual_protocol?: string | null
          previous_findings?: string | null
          previous_five_year_date?: string | null
          previous_recommendations_status?: string | null
          protocol_number?: string | null
          site_visit_date?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          turbine_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_turbine_id_fkey"
            columns: ["turbine_id"]
            isOneToOne: false
            referencedRelation: "turbines"
            referencedColumns: ["id"]
          },
        ]
      }
      inspectors: {
        Row: {
          chamber_certificate_number: string | null
          chamber_expiry_date: string | null
          chamber_membership: string | null
          chamber_scan_url: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          gwo_certificate_number: string | null
          gwo_expiry_date: string | null
          gwo_fire_awareness_expiry: string | null
          gwo_first_aid_expiry: string | null
          gwo_manual_handling_expiry: string | null
          gwo_scan_url: string | null
          gwo_working_at_heights_expiry: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          license_number: string | null
          license_scan_url: string | null
          phone: string | null
          profile_id: string | null
          sep_certificate_number: string | null
          sep_expiry_date: string | null
          sep_scan_url: string | null
          specialty: Database["public"]["Enums"]["inspector_specialty"] | null
          specialty_description: string | null
          udt_certificate_number: string | null
          udt_expiry_date: string | null
          udt_scan_url: string | null
          updated_at: string
        }
        Insert: {
          chamber_certificate_number?: string | null
          chamber_expiry_date?: string | null
          chamber_membership?: string | null
          chamber_scan_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          gwo_certificate_number?: string | null
          gwo_expiry_date?: string | null
          gwo_fire_awareness_expiry?: string | null
          gwo_first_aid_expiry?: string | null
          gwo_manual_handling_expiry?: string | null
          gwo_scan_url?: string | null
          gwo_working_at_heights_expiry?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          license_number?: string | null
          license_scan_url?: string | null
          phone?: string | null
          profile_id?: string | null
          sep_certificate_number?: string | null
          sep_expiry_date?: string | null
          sep_scan_url?: string | null
          specialty?: Database["public"]["Enums"]["inspector_specialty"] | null
          specialty_description?: string | null
          udt_certificate_number?: string | null
          udt_expiry_date?: string | null
          udt_scan_url?: string | null
          updated_at?: string
        }
        Update: {
          chamber_certificate_number?: string | null
          chamber_expiry_date?: string | null
          chamber_membership?: string | null
          chamber_scan_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          gwo_certificate_number?: string | null
          gwo_expiry_date?: string | null
          gwo_fire_awareness_expiry?: string | null
          gwo_manual_handling_expiry?: string | null
          gwo_scan_url?: string | null
          gwo_working_at_heights_expiry?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          license_number?: string | null
          license_scan_url?: string | null
          phone?: string | null
          profile_id?: string | null
          sep_certificate_number?: string | null
          sep_expiry_date?: string | null
          sep_scan_url?: string | null
          specialty?: Database["public"]["Enums"]["inspector_specialty"] | null
          specialty_description?: string | null
          udt_certificate_number?: string | null
          udt_expiry_date?: string | null
          udt_scan_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspectors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspectors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          force_password_change: boolean
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          force_password_change?: boolean
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          force_password_change?: boolean
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      repair_recommendations: {
        Row: {
          completion_date: string | null
          completion_notes: string | null
          created_at: string
          deadline_date: string | null
          element_id: string | null
          element_name: string | null
          estimated_cost: number | null
          id: string
          inspection_id: string
          is_completed: boolean
          item_number: number | null
          repair_type: Database["public"]["Enums"]["repair_type"] | null
          scope_description: string
          updated_at: string
          urgency_level: Database["public"]["Enums"]["urgency_level"] | null
        }
        Insert: {
          completion_date?: string | null
          completion_notes?: string | null
          created_at?: string
          deadline_date?: string | null
          element_id?: string | null
          element_name?: string | null
          estimated_cost?: number | null
          id?: string
          inspection_id: string
          is_completed?: boolean
          item_number?: number | null
          repair_type?: Database["public"]["Enums"]["repair_type"] | null
          scope_description: string
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Update: {
          completion_date?: string | null
          completion_notes?: string | null
          created_at?: string
          deadline_date?: string | null
          element_id?: string | null
          element_name?: string | null
          estimated_cost?: number | null
          id?: string
          inspection_id?: string
          is_completed?: boolean
          item_number?: number | null
          repair_type?: Database["public"]["Enums"]["repair_type"] | null
          scope_description?: string
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_recommendations_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "inspection_elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_recommendations_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_recommendations_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_inspection_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      service_checklist: {
        Row: {
          id: string
          inspection_id: string
          is_checked: boolean
          item_code: string
          item_name_pl: string
          notes: string | null
          sort_order: number
        }
        Insert: {
          id?: string
          inspection_id: string
          is_checked?: boolean
          item_code: string
          item_name_pl: string
          notes?: string | null
          sort_order?: number
        }
        Update: {
          id?: string
          inspection_id?: string
          is_checked?: boolean
          item_code?: string
          item_name_pl?: string
          notes?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_checklist_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_checklist_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_inspection_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      service_info: {
        Row: {
          created_at: string
          id: string
          inspection_id: string
          last_service_date: string | null
          last_service_protocol_number: string | null
          next_service_date: string | null
          notes: string | null
          service_company: string | null
          service_protocols_in_kob: boolean | null
          udt_certificate_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_id: string
          last_service_date?: string | null
          last_service_protocol_number?: string | null
          next_service_date?: string | null
          notes?: string | null
          service_company?: string | null
          service_protocols_in_kob?: boolean | null
          udt_certificate_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_id?: string
          last_service_date?: string | null
          last_service_protocol_number?: string | null
          next_service_date?: string | null
          notes?: string | null
          service_company?: string | null
          service_protocols_in_kob?: boolean | null
          udt_certificate_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_info_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_info_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_inspection_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      turbines: {
        Row: {
          access_road_length_m: number | null
          access_road_width_m: number | null
          building_permit_date: string | null
          building_permit_number: string | null
          cadastral_parcel: string | null
          construction_completion_date: string | null
          created_at: string
          created_by: string | null
          google_drive_folder_url: string | null
          has_as_built_documentation: boolean | null
          has_building_log_book: boolean | null
          hub_height_m: number | null
          id: string
          inspection_notes: string | null
          is_deleted: boolean
          last_inspection_date: string | null
          last_inspection_protocol: string | null
          latitude: number | null
          location_address: string | null
          location_gmina: string | null
          location_powiat: string | null
          location_voivodeship: string | null
          longitude: number | null
          maneuvering_area: string | null
          manufacturer: string | null
          model: string | null
          mv_cable_length_m: number | null
          mv_cable_type: string | null
          next_inspection_date: string | null
          notes: string | null
          operator_name: string | null
          photo_url: string | null
          photo_url_2: string | null
          photo_url_3: string | null
          previous_findings: string | null
          previous_findings_status: string | null
          rated_power_mw: number | null
          rotor_diameter_m: number | null
          serial_number: string | null
          switchgear_station_number: string | null
          tower_height_m: number | null
          turbine_code: string
          updated_at: string
          wind_farm_id: string
        }
        Insert: {
          access_road_length_m?: number | null
          access_road_width_m?: number | null
          building_permit_date?: string | null
          building_permit_number?: string | null
          cadastral_parcel?: string | null
          construction_completion_date?: string | null
          created_at?: string
          created_by?: string | null
          google_drive_folder_url?: string | null
          has_as_built_documentation?: boolean | null
          has_building_log_book?: boolean | null
          hub_height_m?: number | null
          id?: string
          inspection_notes?: string | null
          is_deleted?: boolean
          last_inspection_date?: string | null
          last_inspection_protocol?: string | null
          latitude?: number | null
          location_address?: string | null
          location_gmina?: string | null
          location_powiat?: string | null
          location_voivodeship?: string | null
          longitude?: number | null
          maneuvering_area?: string | null
          manufacturer?: string | null
          model?: string | null
          mv_cable_length_m?: number | null
          mv_cable_type?: string | null
          next_inspection_date?: string | null
          notes?: string | null
          operator_name?: string | null
          photo_url?: string | null
          photo_url_2?: string | null
          photo_url_3?: string | null
          previous_findings?: string | null
          previous_findings_status?: string | null
          rated_power_mw?: number | null
          rotor_diameter_m?: number | null
          serial_number?: string | null
          switchgear_station_number?: string | null
          tower_height_m?: number | null
          turbine_code: string
          updated_at?: string
          wind_farm_id: string
        }
        Update: {
          access_road_length_m?: number | null
          access_road_width_m?: number | null
          building_permit_date?: string | null
          building_permit_number?: string | null
          cadastral_parcel?: string | null
          construction_completion_date?: string | null
          created_at?: string
          created_by?: string | null
          google_drive_folder_url?: string | null
          has_as_built_documentation?: boolean | null
          has_building_log_book?: boolean | null
          hub_height_m?: number | null
          id?: string
          inspection_notes?: string | null
          is_deleted?: boolean
          last_inspection_date?: string | null
          last_inspection_protocol?: string | null
          latitude?: number | null
          location_address?: string | null
          location_gmina?: string | null
          location_powiat?: string | null
          location_voivodeship?: string | null
          longitude?: number | null
          maneuvering_area?: string | null
          manufacturer?: string | null
          model?: string | null
          mv_cable_length_m?: number | null
          mv_cable_type?: string | null
          next_inspection_date?: string | null
          notes?: string | null
          operator_name?: string | null
          photo_url?: string | null
          photo_url_2?: string | null
          photo_url_3?: string | null
          previous_findings?: string | null
          previous_findings_status?: string | null
          rated_power_mw?: number | null
          rotor_diameter_m?: number | null
          serial_number?: string | null
          switchgear_station_number?: string | null
          tower_height_m?: number | null
          turbine_code?: string
          updated_at?: string
          wind_farm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turbines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turbines_wind_farm_id_fkey"
            columns: ["wind_farm_id"]
            isOneToOne: false
            referencedRelation: "wind_farms"
            referencedColumns: ["id"]
          },
        ]
      }
      wind_farms: {
        Row: {
          client_id: string
          commissioning_date: string | null
          created_at: string
          created_by: string | null
          google_drive_folder_url: string | null
          id: string
          is_deleted: boolean
          latitude: number | null
          location_address: string | null
          location_gmina: string | null
          location_powiat: string | null
          location_voivodeship: string | null
          longitude: number | null
          name: string
          notes: string | null
          number_of_turbines: number | null
          total_capacity_mw: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          commissioning_date?: string | null
          created_at?: string
          created_by?: string | null
          google_drive_folder_url?: string | null
          id?: string
          is_deleted?: boolean
          latitude?: number | null
          location_address?: string | null
          location_gmina?: string | null
          location_powiat?: string | null
          location_voivodeship?: string | null
          longitude?: number | null
          name: string
          notes?: string | null
          number_of_turbines?: number | null
          total_capacity_mw?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          commissioning_date?: string | null
          created_at?: string
          created_by?: string | null
          google_drive_folder_url?: string | null
          id?: string
          is_deleted?: boolean
          latitude?: number | null
          location_address?: string | null
          location_gmina?: string | null
          location_powiat?: string | null
          location_voivodeship?: string | null
          longitude?: number | null
          name?: string
          notes?: string | null
          number_of_turbines?: number | null
          total_capacity_mw?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wind_farms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wind_farms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_inspection_summary: {
        Row: {
          client_name: string | null
          id: string | null
          inspection_date: string | null
          inspection_type: Database["public"]["Enums"]["inspection_type"] | null
          inspectors: string | null
          manufacturer: string | null
          model: string | null
          open_repairs: number | null
          overall_condition_rating: Database["public"]["Enums"]["condition_rating"] | null
          photo_count: number | null
          protocol_number: string | null
          status: Database["public"]["Enums"]["inspection_status"] | null
          turbine_code: string | null
          wind_farm_name: string | null
        }
        Relationships: []
      }
      v_open_repairs: {
        Row: {
          client_name: string | null
          completion_date: string | null
          completion_notes: string | null
          created_at: string | null
          deadline_date: string | null
          element_id: string | null
          element_name: string | null
          estimated_cost: number | null
          id: string | null
          inspection_date: string | null
          inspection_id: string | null
          is_completed: boolean | null
          is_overdue: boolean | null
          item_number: number | null
          protocol_number: string | null
          repair_type: Database["public"]["Enums"]["repair_type"] | null
          scope_description: string | null
          turbine_code: string | null
          updated_at: string | null
          urgency_level: Database["public"]["Enums"]["urgency_level"] | null
          wind_farm_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_recommendations_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "inspection_elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_recommendations_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_recommendations_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_inspection_summary"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      condition_rating: "dobry" | "zadowalajacy" | "sredni" | "zly" | "awaryjny"
      inspection_status: "draft" | "in_progress" | "review" | "completed" | "signed"
      inspection_type: "annual" | "five_year"
      inspector_specialty: "konstrukcyjna" | "elektryczna" | "sanitarna" | "inna"
      repair_type: "NG" | "NB" | "K"
      urgency_level: "I" | "II" | "III" | "IV"
      user_role: "admin" | "inspector" | "client_user" | "viewer"
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
    Enums: {
      condition_rating: ["dobry", "zadowalajacy", "sredni", "zly", "awaryjny"],
      inspection_status: ["draft", "in_progress", "review", "completed", "signed"],
      inspection_type: ["annual", "five_year"],
      inspector_specialty: ["konstrukcyjna", "elektryczna", "sanitarna", "inna"],
      repair_type: ["NG", "NB", "K"],
      urgency_level: ["I", "II", "III", "IV"],
      user_role: ["admin", "inspector", "client_user", "viewer"],
    },
  },
} as const
