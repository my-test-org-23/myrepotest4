export interface EventMeta {
  event: { title: string; year: number; month: number };
  dates: string[]; // 'YYYY-MM-DD'
  hours: number[]; // e.g. [7, 8, ... 22]
}

export interface Session {
  token: string;
  isAdmin: boolean;
  name: string | null;
  userId?: number;
}

/** Map of date -> selected hours for the current participant. */
export type AvailabilityMap = Record<string, number[]>;

export interface OverlapSlot {
  date: string;
  hour: number;
  count: number;
  names: string[];
}

export interface OverlapResult {
  totalUsers: number;
  slots: OverlapSlot[];
}

export interface AdminUser {
  id: number;
  name: string;
  created_at: string;
  totalSlots: number;
  totalDays: number;
  slots: { date: string; hour: number }[];
}

export interface AdminSummary {
  totalUsers: number;
  totalSlots: number;
  users: AdminUser[];
}
