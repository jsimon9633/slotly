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
}

export interface TimeSlot {
  start: string;
  end: string;
  available_member_ids?: string[];
}
