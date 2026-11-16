export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role_id: number;
  role_slug: string;
  role_name: string;
  permissions: Record<string, boolean>;
}

export interface SystemSettings {
  id: number;
  platform_name: string;
  organization_name: string;
  campaign_reference: string;
  logo_url: string;
  institutional_image_url: string;
  primary_color: string;
  secondary_color: string;
  theme_mode: 'light' | 'dark' | 'custom';
  background_color: string;
  surface_color: string;
  text_color: string;
  font_family: string;
  font_size_scale: 'compact' | 'normal' | 'large';
  border_radius: 'sharp' | 'rounded' | 'soft';
  header_text: string;
  footer_text: string;
  institutional_text: string;
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  document_format: 'A4' | 'LETTER';
  date_format: 'DD/MM/YYYY' | 'YYYY-MM-DD';
  report_show_charts: number;
  report_show_totals: number;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  active: number;
}

export interface District {
  id: number;
  department_id: number;
  name: string;
  active: number;
}

export interface Seccional {
  id: number;
  department_id: number;
  district_id: number;
  number: number;
  name: string;
  active: number;
}

export interface CustomField {
  id: number;
  module: 'coordinators' | 'youth' | 'women' | 'onp' | 'projections' | 'agenda';
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'select' | 'date' | 'textarea';
  required: number;
  active: number;
  sort_order: number;
  options_json: string;
}

export interface PersonRecord {
  id: number;
  first_name: string;
  last_name: string;
  ci: string;
  ci_raw?: string;
  department_id: number;
  district_id: number;
  department_name?: string;
  district_name?: string;
  seccional_number: number;
  phone: string;
  registered_at: string;
  notes: string;
  consent_accepted: number;
  custom_fields: Record<string, string | number>;
  created_at?: string;
}

export interface OnpRecord {
  id: number;
  full_name: string;
  phone: string;
  phone_raw?: string;
  organization: string;
  registered_at: string;
  notes: string;
  custom_fields: Record<string, string | number>;
  created_at?: string;
}

export interface VoteProjection {
  id: number;
  coordinator_id: number;
  first_name: string;
  last_name: string;
  ci: string;
  department_id: number;
  district_id: number;
  department_name: string;
  district_name: string;
  seccional_number: number;
  estimated_votes: number;
  responsible_name: string;
  notes: string;
  updated_at: string;
}

export interface AgendaEvent {
  id: number;
  title: string;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string;
  department_id: number | null;
  district_id: number | null;
  department_name?: string;
  district_name?: string;
  seccional_number: number | null;
  location: string;
  responsible: string;
  participants: string;
  description: string;
  notes: string;
  reminder_minutes: number;
  status: 'programado' | 'realizado' | 'cancelado';
  activity_summary?: string;
  attendance_count?: number;
  activity_outcomes?: string;
}

export type PageKey =
  | 'dashboard'
  | 'coordinators'
  | 'youth'
  | 'women'
  | 'onp'
  | 'projections'
  | 'agenda'
  | 'reports'
  | 'statistics'
  | 'territorial'
  | 'admin'
  | 'guide';
