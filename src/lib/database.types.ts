export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: "admin" | "inspector" | "client_user" | "viewer";
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          role?: "admin" | "inspector" | "client_user" | "viewer";
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: "admin" | "inspector" | "client_user" | "viewer";
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          name: string;
          short_name: string | null;
          address: string | null;
          contact_person: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          nip: string | null;
          notes: string | null;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          short_name?: string | null;
          address?: string | null;
          contact_person?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          nip?: string | null;
          notes?: string | null;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          short_name?: string | null;
          address?: string | null;
          contact_person?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          nip?: string | null;
          notes?: string | null;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      wind_farms: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          location_address: string | null;
          location_gmina: string | null;
          location_powiat: string | null;
          location_voivodeship: string | null;
          latitude: number | null;
          longitude: number | null;
          total_capacity_mw: number | null;
          number_of_turbines: number | null;
          commissioning_date: string | null;
          notes: string | null;
          google_drive_folder_url: string | null;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          name: string;
          location_address?: string | null;
          location_gmina?: string | null;
          location_powiat?: string | null;
          location_voivodeship?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          total_capacity_mw?: number | null;
          number_of_turbines?: number | null;
          commissioning_date?: string | null;
          notes?: string | null;
          google_drive_folder_url?: string | null;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          name?: string;
          location_address?: string | null;
          location_gmina?: string | null;
          location_powiat?: string | null;
          location_voivodeship?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          total_capacity_mw?: number | null;
          number_of_turbines?: number | null;
          commissioning_date?: string | null;
          notes?: string | null;
          google_drive_folder_url?: string | null;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wind_farms_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          }
        ];
      };
      turbines: {
        Row: {
          id: string;
          wind_farm_id: string;
          turbine_code: string;
          manufacturer: string | null;
          model: string | null;
          rated_power_mw: number | null;
          tower_height_m: number | null;
          rotor_diameter_m: number | null;
          hub_height_m: number | null;
          serial_number: string | null;
          location_address: string | null;
          cadastral_parcel: string | null;
          construction_completion_date: string | null;
          building_permit_number: string | null;
          building_permit_date: string | null;
          has_as_built_documentation: boolean | null;
          has_building_log_book: boolean | null;
          access_road_length_m: number | null;
          access_road_width_m: number | null;
          maneuvering_area: string | null;
          mv_cable_type: string | null;
          mv_cable_length_m: number | null;
          switchgear_station_number: string | null;
          notes: string | null;
          google_drive_folder_url: string | null;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          wind_farm_id: string;
          turbine_code: string;
          manufacturer?: string | null;
          model?: string | null;
          rated_power_mw?: number | null;
          tower_height_m?: number | null;
          rotor_diameter_m?: number | null;
          hub_height_m?: number | null;
          serial_number?: string | null;
          location_address?: string | null;
          cadastral_parcel?: string | null;
          construction_completion_date?: string | null;
          building_permit_number?: string | null;
          building_permit_date?: string | null;
          has_as_built_documentation?: boolean | null;
          has_building_log_book?: boolean | null;
          access_road_length_m?: number | null;
          access_road_width_m?: number | null;
          maneuvering_area?: string | null;
          mv_cable_type?: string | null;
          mv_cable_length_m?: number | null;
          switchgear_station_number?: string | null;
          notes?: string | null;
          google_drive_folder_url?: string | null;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          wind_farm_id?: string;
          turbine_code?: string;
          manufacturer?: string | null;
          model?: string | null;
          rated_power_mw?: number | null;
          tower_height_m?: number | null;
          rotor_diameter_m?: number | null;
          hub_height_m?: number | null;
          serial_number?: string | null;
          location_address?: string | null;
          cadastral_parcel?: string | null;
          construction_completion_date?: string | null;
          building_permit_number?: string | null;
          building_permit_date?: string | null;
          has_as_built_documentation?: boolean | null;
          has_building_log_book?: boolean | null;
          access_road_length_m?: number | null;
          access_road_width_m?: number | null;
          maneuvering_area?: string | null;
          mv_cable_type?: string | null;
          mv_cable_length_m?: number | null;
          switchgear_station_number?: string | null;
          notes?: string | null;
          google_drive_folder_url?: string | null;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "turbines_wind_farm_id_fkey";
            columns: ["wind_farm_id"];
            isOneToOne: false;
            referencedRelation: "wind_farms";
            referencedColumns: ["id"];
          }
        ];
      };
      inspectors: {
        Row: {
          id: string;
          profile_id: string | null;
          full_name: string;
          license_number: string | null;
          specialty:
            | "konstrukcyjna"
            | "elektryczna"
            | "sanitarna"
            | "inna"
            | null;
          specialty_description: string | null;
          chamber_membership: string | null;
          phone: string | null;
          email: string | null;
          is_active: boolean;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          full_name: string;
          license_number?: string | null;
          specialty?:
            | "konstrukcyjna"
            | "elektryczna"
            | "sanitarna"
            | "inna"
            | null;
          specialty_description?: string | null;
          chamber_membership?: string | null;
          phone?: string | null;
          email?: string | null;
          is_active?: boolean;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          full_name?: string;
          license_number?: string | null;
          specialty?:
            | "konstrukcyjna"
            | "elektryczna"
            | "sanitarna"
            | "inna"
            | null;
          specialty_description?: string | null;
          chamber_membership?: string | null;
          phone?: string | null;
          email?: string | null;
          is_active?: boolean;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inspectors_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      inspections: {
        Row: {
          id: string;
          turbine_id: string;
          inspection_type: "annual" | "five_year";
          status: "draft" | "in_progress" | "review" | "completed" | "signed";
          protocol_number: string | null;
          inspection_date: string | null;
          previous_annual_date: string | null;
          previous_annual_protocol: string | null;
          previous_five_year_date: string | null;
          previous_findings: string | null;
          previous_recommendations_status: string | null;
          site_visit_date: string | null;
          committee_members: string | null;
          next_annual_date: string | null;
          next_five_year_date: string | null;
          next_electrical_date: string | null;
          legal_basis: string | null;
          overall_condition_rating:
            | "dobry"
            | "zadowalajacy"
            | "sredni"
            | "zly"
            | "awaryjny"
            | null;
          overall_assessment: string | null;
          hazard_information: string | null;
          inspector_signature_date: string | null;
          inspector_signature_location: string | null;
          owner_signature_date: string | null;
          owner_signature_location: string | null;
          owner_representative_name: string | null;
          google_drive_folder_url: string | null;
          generated_pdf_url: string | null;
          notes: string | null;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          turbine_id: string;
          inspection_type: "annual" | "five_year";
          status?: "draft" | "in_progress" | "review" | "completed" | "signed";
          protocol_number?: string | null;
          inspection_date?: string | null;
          previous_annual_date?: string | null;
          previous_annual_protocol?: string | null;
          previous_five_year_date?: string | null;
          previous_findings?: string | null;
          previous_recommendations_status?: string | null;
          site_visit_date?: string | null;
          committee_members?: string | null;
          next_annual_date?: string | null;
          next_five_year_date?: string | null;
          next_electrical_date?: string | null;
          legal_basis?: string | null;
          overall_condition_rating?:
            | "dobry"
            | "zadowalajacy"
            | "sredni"
            | "zly"
            | "awaryjny"
            | null;
          overall_assessment?: string | null;
          hazard_information?: string | null;
          inspector_signature_date?: string | null;
          inspector_signature_location?: string | null;
          owner_signature_date?: string | null;
          owner_signature_location?: string | null;
          owner_representative_name?: string | null;
          google_drive_folder_url?: string | null;
          generated_pdf_url?: string | null;
          notes?: string | null;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          turbine_id?: string;
          inspection_type?: "annual" | "five_year";
          status?: "draft" | "in_progress" | "review" | "completed" | "signed";
          protocol_number?: string | null;
          inspection_date?: string | null;
          previous_annual_date?: string | null;
          previous_annual_protocol?: string | null;
          previous_five_year_date?: string | null;
          previous_findings?: string | null;
          previous_recommendations_status?: string | null;
          site_visit_date?: string | null;
          committee_members?: string | null;
          next_annual_date?: string | null;
          next_five_year_date?: string | null;
          next_electrical_date?: string | null;
          legal_basis?: string | null;
          overall_condition_rating?:
            | "dobry"
            | "zadowalajacy"
            | "sredni"
            | "zly"
            | "awaryjny"
            | null;
          overall_assessment?: string | null;
          hazard_information?: string | null;
          inspector_signature_date?: string | null;
          inspector_signature_location?: string | null;
          owner_signature_date?: string | null;
          owner_signature_location?: string | null;
          owner_representative_name?: string | null;
          google_drive_folder_url?: string | null;
          generated_pdf_url?: string | null;
          notes?: string | null;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inspections_turbine_id_fkey";
            columns: ["turbine_id"];
            isOneToOne: false;
            referencedRelation: "turbines";
            referencedColumns: ["id"];
          }
        ];
      };
      inspection_elements: {
        Row: {
          id: string;
          inspection_id: string;
          element_definition_id: string;
          condition_rating:
            | "dobry"
            | "zadowalajacy"
            | "sredni"
            | "zly"
            | "awaryjny"
            | null;
          wear_percentage: number | null;
          notes: string | null;
          recommendations: string | null;
          photo_numbers: string | null;
          detailed_description: string | null;
          is_not_applicable: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          inspection_id: string;
          element_definition_id: string;
          condition_rating?:
            | "dobry"
            | "zadowalajacy"
            | "sredni"
            | "zly"
            | "awaryjny"
            | null;
          wear_percentage?: number | null;
          notes?: string | null;
          recommendations?: string | null;
          photo_numbers?: string | null;
          detailed_description?: string | null;
          is_not_applicable?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          inspection_id?: string;
          element_definition_id?: string;
          condition_rating?:
            | "dobry"
            | "zadowalajacy"
            | "sredni"
            | "zly"
            | "awaryjny"
            | null;
          wear_percentage?: number | null;
          notes?: string | null;
          recommendations?: string | null;
          photo_numbers?: string | null;
          detailed_description?: string | null;
          is_not_applicable?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_elements_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_elements_element_definition_id_fkey";
            columns: ["element_definition_id"];
            isOneToOne: false;
            referencedRelation: "inspection_element_definitions";
            referencedColumns: ["id"];
          }
        ];
      };
      inspection_element_definitions: {
        Row: {
          id: string;
          element_number: number;
          section_code: string;
          name_pl: string;
          name_short: string | null;
          scope_annual: string | null;
          scope_five_year_additional: string | null;
          applicable_standards: string | null;
          applies_to_annual: boolean;
          applies_to_five_year: boolean;
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          element_number: number;
          section_code: string;
          name_pl: string;
          name_short?: string | null;
          scope_annual?: string | null;
          scope_five_year_additional?: string | null;
          applicable_standards?: string | null;
          applies_to_annual?: boolean;
          applies_to_five_year?: boolean;
          sort_order: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          element_number?: number;
          section_code?: string;
          name_pl?: string;
          name_short?: string | null;
          scope_annual?: string | null;
          scope_five_year_additional?: string | null;
          applicable_standards?: string | null;
          applies_to_annual?: boolean;
          applies_to_five_year?: boolean;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      inspection_photos: {
        Row: {
          id: string;
          inspection_id: string;
          element_id: string | null;
          photo_number: number | null;
          description: string | null;
          file_url: string | null;
          google_drive_file_id: string | null;
          thumbnail_url: string | null;
          taken_at: string | null;
          sort_order: number | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          inspection_id: string;
          element_id?: string | null;
          photo_number?: number | null;
          description?: string | null;
          file_url?: string | null;
          google_drive_file_id?: string | null;
          thumbnail_url?: string | null;
          taken_at?: string | null;
          sort_order?: number | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          inspection_id?: string;
          element_id?: string | null;
          photo_number?: number | null;
          description?: string | null;
          file_url?: string | null;
          google_drive_file_id?: string | null;
          thumbnail_url?: string | null;
          taken_at?: string | null;
          sort_order?: number | null;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_photos_element_id_fkey";
            columns: ["element_id"];
            isOneToOne: false;
            referencedRelation: "inspection_elements";
            referencedColumns: ["id"];
          }
        ];
      };
      repair_recommendations: {
        Row: {
          id: string;
          inspection_id: string;
          element_id: string | null;
          item_number: number | null;
          scope_description: string;
          repair_type: "NG" | "NB" | "K" | null;
          urgency_level: "I" | "II" | "III" | "IV" | null;
          element_name: string | null;
          estimated_cost: number | null;
          deadline_date: string | null;
          is_completed: boolean;
          completion_date: string | null;
          completion_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          inspection_id: string;
          element_id?: string | null;
          item_number?: number | null;
          scope_description: string;
          repair_type?: "NG" | "NB" | "K" | null;
          urgency_level?: "I" | "II" | "III" | "IV" | null;
          element_name?: string | null;
          estimated_cost?: number | null;
          deadline_date?: string | null;
          is_completed?: boolean;
          completion_date?: string | null;
          completion_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          inspection_id?: string;
          element_id?: string | null;
          item_number?: number | null;
          scope_description?: string;
          repair_type?: "NG" | "NB" | "K" | null;
          urgency_level?: "I" | "II" | "III" | "IV" | null;
          element_name?: string | null;
          estimated_cost?: number | null;
          deadline_date?: string | null;
          is_completed?: boolean;
          completion_date?: string | null;
          completion_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "repair_recommendations_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "repair_recommendations_element_id_fkey";
            columns: ["element_id"];
            isOneToOne: false;
            referencedRelation: "inspection_elements";
            referencedColumns: ["id"];
          }
        ];
      };
      service_info: {
        Row: {
          id: string;
          inspection_id: string;
          service_company: string | null;
          udt_certificate_number: string | null;
          last_service_date: string | null;
          last_service_protocol_number: string | null;
          next_service_date: string | null;
          service_protocols_in_kob: boolean | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          inspection_id: string;
          service_company?: string | null;
          udt_certificate_number?: string | null;
          last_service_date?: string | null;
          last_service_protocol_number?: string | null;
          next_service_date?: string | null;
          service_protocols_in_kob?: boolean | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          inspection_id?: string;
          service_company?: string | null;
          udt_certificate_number?: string | null;
          last_service_date?: string | null;
          last_service_protocol_number?: string | null;
          next_service_date?: string | null;
          service_protocols_in_kob?: boolean | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_info_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          }
        ];
      };
      service_checklist: {
        Row: {
          id: string;
          inspection_id: string;
          item_code: string;
          item_name_pl: string;
          is_checked: boolean;
          notes: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          inspection_id: string;
          item_code: string;
          item_name_pl: string;
          is_checked?: boolean;
          notes?: string | null;
          sort_order: number;
        };
        Update: {
          id?: string;
          inspection_id?: string;
          item_code?: string;
          item_name_pl?: string;
          is_checked?: boolean;
          notes?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "service_checklist_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          }
        ];
      };
      electrical_measurements: {
        Row: {
          id: string;
          inspection_id: string;
          measurement_point: string;
          grounding_resistance_ohm: number | null;
          grounding_result: string | null;
          insulation_resistance_mohm: number | null;
          insulation_result: string | null;
          loop_impedance_ohm: number | null;
          loop_impedance_result: string | null;
          rcd_trip_time_ms: number | null;
          rcd_result: string | null;
          pe_continuity_ohm: number | null;
          pe_continuity_result: string | null;
          measurement_date: string | null;
          measured_by: string | null;
          instrument_info: string | null;
          notes: string | null;
          sort_order: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inspection_id: string;
          measurement_point: string;
          grounding_resistance_ohm?: number | null;
          grounding_result?: string | null;
          insulation_resistance_mohm?: number | null;
          insulation_result?: string | null;
          loop_impedance_ohm?: number | null;
          loop_impedance_result?: string | null;
          rcd_trip_time_ms?: number | null;
          rcd_result?: string | null;
          pe_continuity_ohm?: number | null;
          pe_continuity_result?: string | null;
          measurement_date?: string | null;
          measured_by?: string | null;
          instrument_info?: string | null;
          notes?: string | null;
          sort_order?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          inspection_id?: string;
          measurement_point?: string;
          grounding_resistance_ohm?: number | null;
          grounding_result?: string | null;
          insulation_resistance_mohm?: number | null;
          insulation_result?: string | null;
          loop_impedance_ohm?: number | null;
          loop_impedance_result?: string | null;
          rcd_trip_time_ms?: number | null;
          rcd_result?: string | null;
          pe_continuity_ohm?: number | null;
          pe_continuity_result?: string | null;
          measurement_date?: string | null;
          measured_by?: string | null;
          instrument_info?: string | null;
          notes?: string | null;
          sort_order?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "electrical_measurements_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          }
        ];
      };
      inspection_inspectors: {
        Row: {
          id: string;
          inspection_id: string;
          inspector_id: string;
          specialty: "konstrukcyjna" | "elektryczna" | "sanitarna" | "inna";
          is_lead: boolean;
        };
        Insert: {
          id?: string;
          inspection_id: string;
          inspector_id: string;
          specialty: "konstrukcyjna" | "elektryczna" | "sanitarna" | "inna";
          is_lead?: boolean;
        };
        Update: {
          id?: string;
          inspection_id?: string;
          inspector_id?: string;
          specialty?: "konstrukcyjna" | "elektryczna" | "sanitarna" | "inna";
          is_lead?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_inspectors_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_inspectors_inspector_id_fkey";
            columns: ["inspector_id"];
            isOneToOne: false;
            referencedRelation: "inspectors";
            referencedColumns: ["id"];
          }
        ];
      };
      defect_library: {
        Row: {
          id: string;
          code: string;
          category: string;
          element_section: string | null;
          name_pl: string;
          description_template: string | null;
          recommendation_template: string | null;
          typical_rating:
            | "dobry"
            | "zadowalajacy"
            | "sredni"
            | "zly"
            | "awaryjny"
            | null;
          typical_urgency: "I" | "II" | "III" | "IV" | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          category: string;
          element_section?: string | null;
          name_pl: string;
          description_template?: string | null;
          recommendation_template?: string | null;
          typical_rating?:
            | "dobry"
            | "zadowalajacy"
            | "sredni"
            | "zly"
            | "awaryjny"
            | null;
          typical_urgency?: "I" | "II" | "III" | "IV" | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          category?: string;
          element_section?: string | null;
          name_pl?: string;
          description_template?: string | null;
          recommendation_template?: string | null;
          typical_rating?:
            | "dobry"
            | "zadowalajacy"
            | "sredni"
            | "zly"
            | "awaryjny"
            | null;
          typical_urgency?: "I" | "II" | "III" | "IV" | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      user_role: "admin" | "inspector" | "client_user" | "viewer";
      condition_rating:
        | "dobry"
        | "zadowalajacy"
        | "sredni"
        | "zly"
        | "awaryjny";
      inspection_type: "annual" | "five_year";
      inspection_status: "draft" | "in_progress" | "review" | "completed" | "signed";
      inspector_specialty:
        | "konstrukcyjna"
        | "elektryczna"
        | "sanitarna"
        | "inna";
      repair_type: "NG" | "NB" | "K";
      urgency_level: "I" | "II" | "III" | "IV";
    };
    CompositeTypes: {};
  };
};
