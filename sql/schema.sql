-- =====================================================
-- SUPABASE SQL SCHEMA FOR PMS (Property Management System)
-- =====================================================
-- This script sets up the complete database schema
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. PROPERTIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  check_in_time TIME DEFAULT '14:00',
  check_out_time TIME DEFAULT '12:00',
  currency VARCHAR(3) DEFAULT 'USD',
  time_zone VARCHAR(50) DEFAULT 'UTC',
  language VARCHAR(10) DEFAULT 'en',
  
  -- Legal Information
  company_name VARCHAR(255),
  legal_form VARCHAR(100),
  capital_amount VARCHAR(100),
  business_address TEXT,
  rc_number VARCHAR(50),
  if_number VARCHAR(50),
  patente_number VARCHAR(50),
  ice_number VARCHAR(50),
  tva_info VARCHAR(100),
  bank_account_number VARCHAR(50),
  iban VARCHAR(50),
  
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
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'manager',
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  country VARCHAR(100),
  passport_id VARCHAR(100),
  loyalty_points INT DEFAULT 0,
  preferred_room_type_id UUID REFERENCES room_types(id),
  special_requests TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. RATE PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  base_rate DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, room_type_id, name)
);

-- =====================================================
-- 7. PROMOTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('percentage', 'flat_rate')),
  discount_value DECIMAL(12, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  applicable_room_types JSONB DEFAULT '[]',
  code VARCHAR(50) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. RESERVATIONS TABLE (CORE)
-- =====================================================
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id),
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255),
  guest_phone VARCHAR(20),
  guest_country VARCHAR(100),
  guest_passport_id VARCHAR(100),
  
  source VARCHAR(50) DEFAULT 'Direct' CHECK (source IN ('Direct', 'Walk-in', 'OTA')),
  status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Canceled', 'No-Show', 'Checked-in', 'Completed')),
  reservation_number VARCHAR(100) UNIQUE,
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  rooms_data JSONB NOT NULL DEFAULT '[]',
  selected_extras JSONB DEFAULT '[]',
  
  total_price DECIMAL(12, 2),
  price_before_discount DECIMAL(12, 2),
  discount_amount DECIMAL(12, 2),
  rooms_total DECIMAL(12, 2),
  extras_total DECIMAL(12, 2),
  tax_amount DECIMAL(12, 2),
  
  payment_status VARCHAR(50) DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Partial', 'Refunded')),
  partial_payment_amount DECIMAL(12, 2),
  paid_with_points BOOLEAN DEFAULT FALSE,
  
  promotion_applied JSONB,
  package_info JSONB,
  
  notes TEXT,
  color VARCHAR(50),
  
  actual_check_in_time TIMESTAMP WITH TIME ZONE,
  actual_check_out_time TIMESTAMP WITH TIME ZONE,
  is_checked_out BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 9. SERVICES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(12, 2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'one_time' CHECK (unit IN ('one_time', 'per_night', 'per_guest', 'per_night_per_guest')),
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, name)
);

-- =====================================================
-- 10. MEAL PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(12, 2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'per_night' CHECK (unit IN ('one_time', 'per_night', 'per_guest', 'per_night_per_guest')),
  meals JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, name)
);

-- =====================================================
-- 11. TASKS TABLE (Housekeeping)
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Completed', 'Pending')),
  assigned_to_uid UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_role VARCHAR(50),
  estimated_duration INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 12. PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Card', 'Bank Transfer', 'PayPal', 'Stripe', 'Other')),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  transaction_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Completed' CHECK (status IN ('Pending', 'Completed', 'Failed', 'Refunded')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 13. EXPENSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  expense_date DATE NOT NULL,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 14. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Unread' CHECK (status IN ('Unread', 'Read', 'Archived')),
  related_to VARCHAR(50),
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Reservations indexes
CREATE INDEX idx_reservations_property_id ON reservations(property_id);
CREATE INDEX idx_reservations_start_date ON reservations(start_date);
CREATE INDEX idx_reservations_end_date ON reservations(end_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_payment_status ON reservations(payment_status);

-- Rooms indexes
CREATE INDEX idx_rooms_property_id ON rooms(property_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_cleaning_status ON rooms(cleaning_status);

-- Guests indexes
CREATE INDEX idx_guests_property_id ON guests(property_id);
CREATE INDEX idx_guests_email ON guests(email);

-- Tasks indexes
CREATE INDEX idx_tasks_property_id ON tasks(property_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to_uid);

-- Payments indexes
CREATE INDEX idx_payments_property_id ON payments(property_id);
CREATE INDEX idx_payments_reservation_id ON payments(reservation_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- Users indexes
CREATE INDEX idx_users_property_id ON users(property_id);
CREATE INDEX idx_users_email ON users(email);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
-- This ensures data is filtered by property_id for multi-tenant access

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE BASIC RLS POLICIES
-- =====================================================

-- Users can view their own property data
CREATE POLICY "users_view_own_property" ON properties
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM users WHERE property_id = properties.id)
  );

CREATE POLICY "users_view_own_reservations" ON reservations
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM users WHERE property_id = reservations.property_id)
  );

CREATE POLICY "users_view_own_rooms" ON rooms
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM users WHERE property_id = rooms.property_id)
  );

-- =====================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- =====================================================

-- Function to calculate occupancy rate
CREATE OR REPLACE FUNCTION calculate_occupancy_rate(p_property_id UUID, p_date DATE)
RETURNS DECIMAL AS $$
DECLARE
  total_rooms INT;
  occupied_rooms INT;
BEGIN
  SELECT COUNT(*) INTO total_rooms FROM rooms WHERE property_id = p_property_id;
  
  SELECT COUNT(DISTINCT r.id) INTO occupied_rooms 
  FROM reservations r
  WHERE r.property_id = p_property_id 
    AND r.status IN ('Confirmed', 'Checked-in')
    AND r.start_date <= p_date 
    AND r.end_date > p_date;
  
  IF total_rooms = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN (occupied_rooms::DECIMAL / total_rooms::DECIMAL) * 100;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate revenue
CREATE OR REPLACE FUNCTION calculate_revenue(p_property_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS DECIMAL AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(total_price), 0) 
    FROM reservations 
    WHERE property_id = p_property_id 
      AND status IN ('Checked-in', 'Completed')
      AND start_date >= p_start_date 
      AND end_date <= p_end_date
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================
-- Uncomment to insert sample data

-- INSERT INTO properties (name, city, country, currency, time_zone)
-- VALUES ('Sample Hotel', 'Marrakech', 'Morocco', 'MAD', 'UTC+01:00-Casablanca');

-- =====================================================
-- GRANTS FOR APPLICATION USER (if needed)
-- =====================================================
-- GRANT USAGE ON SCHEMA public TO anon;
-- GRANT USAGE ON SCHEMA public TO authenticated;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
