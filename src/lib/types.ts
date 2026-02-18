export interface TeamMember {
  id: string;
  name: string;
  email: string;
  google_calendar_id: string;
  is_active: boolean;
  last_booked_at: string;
}

export interface EventType {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  is_active: boolean;
  before_buffer_mins: number;
  after_buffer_mins: number;
  min_notice_hours: number;
  max_daily_bookings: number | null;
}

export interface Booking {
  id: string;
  event_type_id: string;
  team_member_id: string;
  invitee_name: string;
  invitee_email: string;
  invitee_notes: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  status: "confirmed" | "cancelled" | "completed";
  google_event_id: string | null;
  manage_token: string | null;
}

export interface SiteSettings {
  id?: string;
  company_name: string;
  logo_url: string | null;
  primary_color: string;  // hex color like "#4f46e5"
  accent_color: string;   // secondary/accent like "#3b82f6"
}

export interface TimeSlot {
  start: string;
  end: string;
  available_member_ids?: string[];
}
