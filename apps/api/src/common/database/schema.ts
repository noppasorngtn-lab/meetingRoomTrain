import { ColumnType, Generated } from 'kysely';

/** Row types of migrations/*.sql, as Kysely sees them. */
export interface UsersTable {
  id: Generated<string>;
  email: string;
  full_name: string;
  role: 'GENERAL_USER' | 'ROOM_ADMINISTRATOR' | 'SYSTEM_ADMINISTRATOR';
  active: Generated<boolean>;
}

export interface MeetingRoomsTable {
  id: Generated<string>;
  code: string;
  current_version_id: string;
  status: 'ACTIVE' | 'UNDER_MAINTENANCE' | 'ARCHIVED';
  created_at: Generated<Date>;
}

export interface MeetingRoomVersionsTable {
  id: Generated<string>;
  room_id: string;
  version_no: number;
  name: string;
  capacity: number;
  photos: ColumnType<string[], string | undefined, string>;
  requires_approval: boolean;
  approver_id: string | null;
  created_by: string;
  created_at: Generated<Date>;
}

export interface BookingsTable {
  id: Generated<string>;
  room_id: string;
  room_version_id: string;
  booked_by: string;
  title: string;
  start_at: Date;
  end_at: Date;
  status: 'PENDING_APPROVAL' | 'CONFIRMED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reminder_status: Generated<'NOT_SENT' | 'SENT' | 'FAILED'>;
  reminder_at: Date | null;
  cancel_reason: string | null;
  created_at: Generated<Date>;
}

export interface BookingAttendeesTable {
  booking_id: string;
  user_id: string;
}

export interface FacilitiesTable {
  id: Generated<string>;
  name: string;
  active: Generated<boolean>;
}

export interface BookingEquipmentRequestsTable {
  booking_id: string;
  facility_id: string;
}

export interface BookingAuditEntriesTable {
  id: Generated<string>;
  booking_id: string;
  actor_id: string;
  action:
    | 'APPROVE' | 'REJECT' | 'CHANGE_DECISION' | 'EDIT_ON_BEHALF' | 'CANCEL_ON_BEHALF'
    | 'CREATE_ADJUSTMENT' | 'APPROVE_ADJUSTMENT' | 'REJECT_ADJUSTMENT';
  reason: string | null;
  detail: unknown | null;
  at: Date;
}

export interface Database {
  users: UsersTable;
  meeting_rooms: MeetingRoomsTable;
  meeting_room_versions: MeetingRoomVersionsTable;
  bookings: BookingsTable;
  booking_attendees: BookingAttendeesTable;
  facilities: FacilitiesTable;
  booking_equipment_requests: BookingEquipmentRequestsTable;
  booking_audit_entries: BookingAuditEntriesTable;
}
