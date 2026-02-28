export interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  layout_style?: "single" | "two-panel";
  calendar_style?: "strip" | "month";
}

export interface TeamMemberInfo {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface TeamMembership {
  id: string;
  team_id: string;
  team_member_id: string;
  role: "admin" | "member";
  is_active: boolean;
  in_round_robin: boolean;
  joined_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  google_calendar_id: string;
  avatar_url: string | null;
  google_oauth_refresh_token?: string; // server-side only, never sent to client
  google_oauth_connected_at?: string;
  google_oauth_revoked_at?: string;
  google_oauth_scopes?: string;
  slack_user_id?: string;
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
  is_locked: boolean;
  before_buffer_mins: number;
  after_buffer_mins: number;
  min_notice_hours: number;
  max_daily_bookings: number | null;
  max_advance_days: number;
  team_id: string;
  booking_questions?: BookingQuestion[];
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];  // e.g. ["booking.created", "booking.cancelled"]
  is_active: boolean;
  secret: string;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number | null;
  response_body: string | null;
  success: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  event_type_id: string;
  team_member_id: string;
  invitee_name: string;
  invitee_email: string;
  invitee_phone: string | null;
  invitee_notes: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  google_event_id: string | null;
  manage_token: string | null;
  created_at: string;
  no_show_score: number | null;
  risk_tier: "low" | "medium" | "high" | null;
  reminder_sent_at: string | null;
  outcome: "completed" | "no_show" | "cancelled" | null;
  outcome_recorded_at: string | null;
  custom_answers?: Record<string, any>;
}

export interface SiteSettings {
  id?: string;
  company_name: string;
  logo_url: string | null;
  primary_color: string;  // hex color like "#4f46e5"
  accent_color: string;   // secondary/accent like "#3b82f6"
}

export interface BookingQuestion {
  id: string;
  type: "text" | "dropdown" | "checkbox";
  label: string;
  required: boolean;
  options?: string[]; // for dropdown type
}

export interface Workflow {
  id: string;
  event_type_id: string;
  name: string;
  trigger: "on_booking" | "on_cancel" | "on_reschedule" | "before_meeting" | "after_meeting";
  trigger_minutes: number;
  action: "send_email" | "send_sms";
  recipient: "invitee" | "host" | "both";
  subject: string | null;
  body: string;
  is_active: boolean;
  created_at: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  available_member_ids?: string[];
  label?: "popular" | "recommended";
}
