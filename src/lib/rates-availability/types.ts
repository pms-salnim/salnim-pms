// Type definitions for rates and availability system
export interface RatePlan {
  id: string;
  property_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  cancellation_policy?: 'strict' | 'moderate' | 'flexible';
  free_cancellation_until?: string;
  non_refundable: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailyRate {
  id: string;
  property_id: string;
  rate_plan_id: string;
  room_type_id?: string;
  room_id?: string;
  date: string;
  base_price: number;
  occupancy_price: number;
  applied_at_level: 'property' | 'room_type' | 'room';
  created_at: string;
  updated_at: string;
}

export interface AvailabilityEntry {
  id: string;
  property_id: string;
  room_type_id?: string;
  room_id?: string;
  date: string;
  status: 'available' | 'not_available' | 'closed_to_arrival' | 'closed_to_departure' | 'on_request';
  applied_at_level: 'property' | 'room_type' | 'room';
  min_nights: number;
  max_nights?: number;
  occupancy: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Restriction {
  id: string;
  property_id: string;
  name: string;
  description?: string;
  restriction_type: 'min_nights' | 'max_nights' | 'advance_booking' | 'early_bird' | 'last_minute' | 'occupancy' | 'closed_period';
  room_type_id?: string;
  room_id?: string;
  date_range_start?: string;
  date_range_end?: string;
  days_of_week?: string[]; // ['MON', 'TUE', ...]
  value?: number;
  discount_percentage?: number;
  applied_at_level: 'property' | 'room_type' | 'room';
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface OccupancyRestriction {
  id: string;
  property_id: string;
  room_type_id?: string;
  room_id?: string;
  date: string;
  min_occupancy: number;
  max_occupancy?: number;
  applied_at_level: 'property' | 'room_type' | 'room';
  created_at: string;
  updated_at: string;
}

export interface RecurringPattern {
  id: string;
  property_id: string;
  name: string;
  description?: string;
  pattern_type: 'weekly' | 'seasonal' | 'custom';
  room_type_id?: string;
  room_id?: string;
  days_of_week?: string[]; // ['SAT', 'SUN', 'MON']
  min_nights?: number;
  max_nights?: number;
  occupancy?: number;
  price_modifier?: number;
  status: 'active' | 'inactive';
  applied_at_level: 'property' | 'room_type' | 'room';
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: string;
  property_id: string;
  name: string;
  description?: string;
  season_start: string;
  season_end: string;
  price_modifier: number;
  color?: string; // HEX color
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  property_id: string;
  user_id?: string;
  table_name: 'rate_plans' | 'daily_rates' | 'availability_calendar' | 'restrictions' | 'occupancy_restrictions' | 'recurring_patterns' | 'seasons';
  record_id: string;
  action: 'create' | 'update' | 'delete' | 'bulk_update';
  changes?: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  metadata?: Record<string, any>;
  timestamp: string;
}

// Scope levels for hierarchical data management
export type ScopeLevel = 'property' | 'room_type' | 'room';

export interface AppliedScope {
  level: ScopeLevel;
  propertyId: string;
  roomTypeId?: string;
  roomId?: string;
  roomTypeName?: string;
  roomName?: string;
}

// Color status mapping for calendar UI
export const STATUS_COLORS = {
  available: '#10B981', // green
  not_available: '#EF4444', // red
  closed_to_arrival: '#F59E0B', // amber
  closed_to_departure: '#9CA3AF', // gray
  on_request: '#3B82F6', // blue
};

export const STATUS_LABELS = {
  available: 'Available',
  not_available: 'Not Available',
  closed_to_arrival: 'Closed to Arrival',
  closed_to_departure: 'Closed to Departure',
  on_request: 'On Request',
};

// Restriction type labels
export const RESTRICTION_TYPE_LABELS = {
  min_nights: 'Minimum Nights',
  max_nights: 'Maximum Nights',
  advance_booking: 'Advance Booking Required',
  early_bird: 'Early Bird Discount',
  last_minute: 'Last Minute Discount',
  occupancy: 'Occupancy Requirement',
  closed_period: 'Closed Period',
};

// Days of week for patterns
export const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const DAYS_OF_WEEK_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
