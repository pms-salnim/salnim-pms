-- =====================================================
-- SUPABASE SQL SCHEMA FOR PMS (Property Management System)
-- UPDATED: Uses TEXT for IDs to support Firebase Firestore IDs
-- =====================================================

-- =====================================================
-- 1. PROPERTIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  description TEXT,
  tagline TEXT,
  address TEXT,
  city VARCHAR(100),
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  google_maps_link TEXT,
  check_in_time TIME DEFAULT '14:00',
  check_out_time TIME DEFAULT '12:00',
  currency VARCHAR(3) DEFAULT 'USD',
  time_zone VARCHAR(50) DEFAULT 'UTC',
  language VARCHAR(10) DEFAULT 'en',
  
  -- Property Details
  year_established INT,
  logo_url TEXT,
  star_rating DECIMAL(3, 1),
  jurisdiction VARCHAR(100),
  
  -- Legal Information - Basic
  legal_business_name VARCHAR(255),
  company_name VARCHAR(255),
  legal_form VARCHAR(100),
  capital_amount VARCHAR(100),
  business_address TEXT,
  
  -- Legal Information - Morocco
  moroccan_legal_company_form VARCHAR(100),
  moroccan_rc VARCHAR(100),
  moroccan_if VARCHAR(100),
  moroccan_ice VARCHAR(100),
  moroccan_cnss VARCHAR(100),
  moroccan_patent_number VARCHAR(100),
  
  -- Legal Information - European
  european_company_reg_number VARCHAR(100),
  european_vat_number VARCHAR(100),
  european_trade_reg_entry VARCHAR(100),
  european_chamber_registration VARCHAR(100),
  european_tax_registration VARCHAR(100),
  
  -- Legal Information - USA
  usa_ein VARCHAR(100),
  usa_state_license_number VARCHAR(100),
  usa_secretary_of_state_number VARCHAR(100),
  usa_federal_tax_id VARCHAR(100),
  
  -- Banking Information
  rc_number VARCHAR(50),
  if_number VARCHAR(50),
  patente_number VARCHAR(50),
  ice_number VARCHAR(50),
  tva_info VARCHAR(100),
  bank_account_number VARCHAR(50),
  iban VARCHAR(50),
  
  -- Property Specifications
  total_rooms INT,
  max_guest_capacity INT,
  property_size_square_feet INT,
  number_floors INT,
  number_buildings INT,
  property_style VARCHAR(100),
  
  -- Invoice Customization
  invoice_prefix VARCHAR(20),
  invoice_primary_color VARCHAR(7),
  invoice_footer_text TEXT,
  invoice_header_notes TEXT,
  include_property_address BOOLEAN DEFAULT TRUE,
  
  -- Loyalty Program
  loyalty_enabled BOOLEAN DEFAULT FALSE,
  loyalty_earning_rate DECIMAL(10, 2) DEFAULT 10,
  loyalty_redemption_rate DECIMAL(10, 2) DEFAULT 0.01,
  
  -- System Settings (JSON)
  notification_settings JSONB DEFAULT '{}',
  preference_settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'manager',
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  phone VARCHAR(20),
  country VARCHAR(100),
  city VARCHAR(100),
  address TEXT,
  preferred_language VARCHAR(10) DEFAULT 'en',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- =====================================================
-- 3. ROOM TYPES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS room_types (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  max_guests INT DEFAULT 2,
  amenities JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, name)
);

-- =====================================================
-- 4. ROOMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id TEXT NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  number VARCHAR(50),
  floor INT,
  status VARCHAR(50) DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Maintenance', 'Cleaning', 'Dirty', 'Out of Order')),
  cleaning_status VARCHAR(50) DEFAULT 'clean' CHECK (cleaning_status IN ('clean', 'dirty', 'in_progress')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, number)
);

-- =====================================================
-- 5. GUESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  country VARCHAR(100),
  city VARCHAR(100),
  address TEXT,
  postal_code VARCHAR(20),
  id_type VARCHAR(50),
  id_number VARCHAR(100),
  loyalty_points INT DEFAULT 0,
  total_spent DECIMAL(15, 2) DEFAULT 0,
  visits INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT guest_name_not_empty CHECK (first_name != '' OR last_name != '')
);

-- =====================================================
-- 6. RESERVATIONS TABLE (CORE)
-- =====================================================
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  nights INT NOT NULL,
  adult_count INT DEFAULT 1,
  children_count INT DEFAULT 0,
  baby_count INT DEFAULT 0,
  rooms_data JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Checked-in', 'Completed', 'Cancelled')),
  
  -- Pricing
  base_price DECIMAL(15, 2),
  total_price DECIMAL(15, 2),
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  
  -- Add-ons
  selected_extras JSONB DEFAULT '[]',
  selected_services JSONB DEFAULT '[]',
  selected_meal_plan JSONB,
  
  -- Promotions
  promo_code VARCHAR(50),
  promotion_applied JSONB,
  
  -- Contact
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  
  -- Source
  booking_source VARCHAR(50) DEFAULT 'Direct',
  original_platform VARCHAR(100),
  
  -- Notes
  special_requests TEXT,
  internal_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_dates CHECK (start_date < end_date)
);

-- =====================================================
-- 7. RATE PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS rate_plans (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  room_type_id TEXT REFERENCES room_types(id) ON DELETE SET NULL,
  nightly_rate DECIMAL(15, 2) NOT NULL,
  minimum_nights INT DEFAULT 1,
  maximum_nights INT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. PROMOTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT '',
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  promotion_type VARCHAR(50) DEFAULT 'automatic' CHECK (promotion_type IN ('automatic', 'coupon')),
  discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  max_uses INT,
  current_uses INT DEFAULT 0,
  rate_plan_ids JSONB DEFAULT '[]'::jsonb,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- =====================================================
-- 8.5 SERVICE CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS service_categories (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_id TEXT REFERENCES service_categories(id) ON DELETE CASCADE,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, parent_id, name)
);

-- =====================================================
-- 9. SERVICES TABLE (Extras/Add-ons)
-- =====================================================
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(15, 2) NOT NULL,
  category VARCHAR(50),
  category_id TEXT REFERENCES service_categories(id) ON DELETE SET NULL,
  subcategory_id TEXT REFERENCES service_categories(id) ON DELETE SET NULL,
  per_night BOOLEAN DEFAULT FALSE,
  booking_engine BOOLEAN DEFAULT FALSE,
  guest_portal BOOLEAN DEFAULT FALSE,
  staff_only BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Draft', 'Archived')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, name)
);

-- =====================================================
-- 10. MEAL PLAN CATEGORIES TABLE (Hierarchical)
-- =====================================================
CREATE TABLE IF NOT EXISTS meal_plan_categories (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_id TEXT REFERENCES meal_plan_categories(id) ON DELETE CASCADE,
  description TEXT,
  icon VARCHAR(50),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, parent_id, name)
);

-- =====================================================
-- 10.1 MEAL PLANS TABLE (Enhanced)
-- =====================================================
CREATE TABLE IF NOT EXISTS meal_plans (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  full_description TEXT,
  price_per_night DECIMAL(15, 2) NOT NULL,
  meals_included VARCHAR(255),
  
  -- Category Hierarchy
  category_id TEXT REFERENCES meal_plan_categories(id) ON DELETE SET NULL,
  subcategory_id TEXT REFERENCES meal_plan_categories(id) ON DELETE SET NULL,
  
  -- Meal Plan Type
  meal_plan_type VARCHAR(50) CHECK (meal_plan_type IN ('breakfast', 'half-board', 'full-board', 'all-inclusive', 'custom')),
  included_meals JSONB DEFAULT '[]'::jsonb,
  
  -- Pricing Models (Support Multiple Pricing Options)
  pricing_model VARCHAR(50) CHECK (pricing_model IN ('per-guest-night', 'per-room-night', 'flat-rate')),
  base_price DECIMAL(15, 2),
  adult_price DECIMAL(15, 2),
  child_price DECIMAL(15, 2),
  infant_price DECIMAL(15, 2),
  infant_free BOOLEAN DEFAULT TRUE,
  enable_age_pricing BOOLEAN DEFAULT FALSE,
  
  -- Availability
  available_dates_start DATE,
  available_dates_end DATE,
  minimum_stay INT DEFAULT 0,
  blackout_dates JSONB DEFAULT '[]'::jsonb,
  cancellation_policy TEXT,
  upgrade_allowed BOOLEAN DEFAULT TRUE,
  
  -- Room Type and Rate Plan Linking
  applicable_room_types JSONB DEFAULT '[]'::jsonb,
  applicable_rate_plans JSONB DEFAULT '{}'::jsonb,
  
  -- Visibility
  is_default BOOLEAN DEFAULT FALSE,
  visible_on_booking BOOLEAN DEFAULT TRUE,
  visible_in_guest_portal BOOLEAN DEFAULT TRUE,
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Draft', 'Archived')),
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, name)
);

-- =====================================================
-- 11. TASKS TABLE (Housekeeping)
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
  assigned_to TEXT,
  due_date DATE,
  due_time TIME,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 12. PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
  amount DECIMAL(15, 2) NOT NULL,
  payment_method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Failed', 'Refunded')),
  transaction_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_amount CHECK (amount > 0)
);

-- =====================================================
-- 13. EXPENSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  category VARCHAR(100),
  expense_date DATE NOT NULL,
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_expense CHECK (amount > 0)
);

-- =====================================================
-- 14. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  related_entity_type VARCHAR(100),
  related_entity_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Properties
CREATE INDEX idx_properties_country ON properties(country);

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_property_id ON users(property_id);
CREATE INDEX idx_users_role ON users(role);

-- Rooms
CREATE INDEX idx_rooms_property_id ON rooms(property_id);
CREATE INDEX idx_rooms_room_type_id ON rooms(room_type_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_number ON rooms(number);

-- Guests
CREATE INDEX idx_guests_property_id ON guests(property_id);
CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_phone ON guests(phone);

-- Reservations (Most critical for queries)
CREATE INDEX idx_reservations_property_id ON reservations(property_id);
CREATE INDEX idx_reservations_guest_id ON reservations(guest_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_dates ON reservations(start_date, end_date);
CREATE INDEX idx_reservations_created_at ON reservations(created_at DESC);

-- Task Management
CREATE INDEX idx_tasks_property_id ON tasks(property_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_reservation_id ON tasks(reservation_id);
CREATE INDEX idx_tasks_room_id ON tasks(room_id);

-- Payments
CREATE INDEX idx_payments_property_id ON payments(property_id);
CREATE INDEX idx_payments_reservation_id ON payments(reservation_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Expenses
CREATE INDEX idx_expenses_property_id ON expenses(property_id);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- Service Categories
CREATE INDEX idx_service_categories_property_id ON service_categories(property_id);
CREATE INDEX idx_service_categories_parent_id ON service_categories(parent_id);
CREATE INDEX idx_service_categories_is_active ON service_categories(is_active);

-- Services
CREATE INDEX idx_services_property_id ON services(property_id);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_subcategory_id ON services(subcategory_id);
CREATE INDEX idx_services_category_subcategory ON services(category_id, subcategory_id);
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_services_booking_engine ON services(booking_engine);
CREATE INDEX idx_services_guest_portal ON services(guest_portal);
CREATE INDEX idx_services_staff_only ON services(staff_only);

-- Meal Plan Categories
CREATE INDEX idx_meal_plan_categories_property_id ON meal_plan_categories(property_id);
CREATE INDEX idx_meal_plan_categories_parent_id ON meal_plan_categories(parent_id);
CREATE INDEX idx_meal_plan_categories_is_active ON meal_plan_categories(is_active);

-- Meal Plans
CREATE INDEX idx_meal_plans_property_id ON meal_plans(property_id);
CREATE INDEX idx_meal_plans_category_id ON meal_plans(category_id);
CREATE INDEX idx_meal_plans_subcategory_id ON meal_plans(subcategory_id);
CREATE INDEX idx_meal_plans_status ON meal_plans(status);
CREATE INDEX idx_meal_plans_visible_on_booking ON meal_plans(visible_on_booking);
CREATE INDEX idx_meal_plans_visible_in_guest_portal ON meal_plans(visible_in_guest_portal);
CREATE INDEX idx_meal_plans_meal_plan_type ON meal_plans(meal_plan_type);
CREATE INDEX idx_meal_plans_pricing_model ON meal_plans(pricing_model);

-- Room Types
CREATE INDEX idx_room_types_property_id ON room_types(property_id);

-- Rate Plans
CREATE INDEX idx_rate_plans_property_id ON rate_plans(property_id);
CREATE INDEX idx_rate_plans_is_active ON rate_plans(is_active);

-- Promotions
CREATE INDEX idx_promotions_property_id ON promotions(property_id);
CREATE INDEX idx_promotions_code ON promotions(code);
CREATE INDEX idx_promotions_is_active ON promotions(is_active);
CREATE INDEX idx_promotions_promotion_type ON promotions(promotion_type);
CREATE INDEX idx_promotions_rate_plan_ids ON promotions USING GIN (rate_plan_ids);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =====================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all relevant tables
DO $$
DECLARE
  tables TEXT[] := ARRAY['properties', 'users', 'room_types', 'rooms', 'guests', 'reservations', 'rate_plans', 'promotions', 'services', 'meal_plans', 'tasks', 'payments', 'expenses', 'notifications'];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || tbl || '_update_timestamp ON ' || tbl;
    EXECUTE 'CREATE TRIGGER ' || tbl || '_update_timestamp BEFORE UPDATE ON ' || tbl || ' FOR EACH ROW EXECUTE FUNCTION update_timestamp()';
  END LOOP;
END $$;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Calculate occupancy rate for a property on a given date
CREATE OR REPLACE FUNCTION calculate_occupancy_rate(
  p_property_id TEXT,
  p_date DATE
)
RETURNS DECIMAL(5, 2) AS $$
DECLARE
  total_rooms INT;
  occupied_rooms INT;
BEGIN
  SELECT COUNT(*) INTO total_rooms FROM rooms WHERE property_id = p_property_id;
  
  SELECT COUNT(DISTINCT r.id) INTO occupied_rooms
  FROM reservations r
  WHERE r.property_id = p_property_id
    AND r.status IN ('Checked-in', 'Completed')
    AND r.start_date <= p_date
    AND r.end_date > p_date;
  
  IF total_rooms = 0 THEN RETURN 0; END IF;
  RETURN ROUND(100.0 * occupied_rooms / total_rooms, 2);
END;
$$ LANGUAGE plpgsql;

-- Calculate total revenue for a property in a date range
CREATE OR REPLACE FUNCTION calculate_revenue(
  p_property_id TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS DECIMAL(15, 2) AS $$
DECLARE
  total_revenue DECIMAL(15, 2);
BEGIN
  SELECT COALESCE(SUM(total_price), 0) INTO total_revenue
  FROM reservations
  WHERE property_id = p_property_id
    AND status IN ('Checked-in', 'Completed')
    AND start_date >= p_start_date
    AND end_date <= p_end_date;
  
  RETURN total_revenue;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (Multi-tenant support)
-- =====================================================
-- Note: RLS policies require authenticated users
-- Uncomment these after setting up Supabase Auth:
/*

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (implement based on your auth strategy):
-- CREATE POLICY property_access ON properties FOR SELECT
--   USING (id IN (SELECT property_id FROM users WHERE id = auth.uid()));

*/

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================
-- Uncomment to insert sample data:
/*

INSERT INTO properties (id, name, city, country) VALUES 
  ('sample-prop-1', 'Luxury Resort', 'Casablanca', 'Morocco'),
  ('sample-prop-2', 'Mountain Lodge', 'Marrakech', 'Morocco');

INSERT INTO room_types (id, property_id, name, max_guests) VALUES 
  ('room-type-1', 'sample-prop-1', 'Deluxe Room', 2),
  ('room-type-2', 'sample-prop-1', 'Suite', 4);

*/

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================
