-- Create guest_portals table
CREATE TABLE IF NOT EXISTS public.guest_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  portal_id TEXT NOT NULL,
  
  -- General settings
  portal_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  default_portal BOOLEAN DEFAULT false,
  properties TEXT[] DEFAULT '{}',
  room_types TEXT[] DEFAULT '{}',
  custom_domain TEXT,
  custom_domain_full TEXT,
  short_link_enabled BOOLEAN DEFAULT false,
  pre_arrival_days INTEGER DEFAULT 4,
  post_departure_days INTEGER DEFAULT 4,
  permanent_access_enabled BOOLEAN DEFAULT false,
  maintenance_mode BOOLEAN DEFAULT false,
  test_mode BOOLEAN DEFAULT false,
  global_kill_switch BOOLEAN DEFAULT false,
  authentication_method TEXT DEFAULT 'reservation-number',
  magic_link_expiration INTEGER DEFAULT 24,
  manual_login_fields TEXT[] DEFAULT '{}',
  keep_logged_in_enabled BOOLEAN DEFAULT false,
  device_limit INTEGER DEFAULT 3,
  auto_send_link_timing TEXT DEFAULT 'immediate',
  auto_send_triggers TEXT[] DEFAULT '{"booking-confirmed"}',
  pms_sync_status JSONB DEFAULT '{"status":"synced","message":"All synced"}',
  
  -- Branding settings
  logo TEXT,
  dark_logo TEXT,
  favicon TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  accent_color TEXT DEFAULT '#10B981',
  background_color TEXT DEFAULT '#FFFFFF',
  font_family TEXT DEFAULT 'Inter',
  dark_mode_enabled BOOLEAN DEFAULT false,
  welcome_title TEXT DEFAULT 'Welcome to Your Stay',
  welcome_message TEXT DEFAULT 'We are excited to host you!',
  hero_images TEXT[] DEFAULT '{}',
  hero_captions TEXT[] DEFAULT '{}',
  contact_phone TEXT,
  contact_whatsapp TEXT,
  contact_email TEXT,
  social_links JSONB DEFAULT '{}',
  footer_text TEXT DEFAULT 'Booking.com verified guest experience',
  copyright_text TEXT DEFAULT '© 2024 All rights reserved',
  legal_links JSONB DEFAULT '[]',
  
  -- Navigation settings
  menu_items JSONB DEFAULT '[{"label":"Home","enabled":true,"order":1},{"label":"My Booking","enabled":true,"order":2},{"label":"Messages","enabled":true,"order":3},{"label":"Services","enabled":true,"order":4},{"label":"Profile","enabled":true,"order":5}]',
  built_in_pages JSONB DEFAULT '{"home":true,"myBooking":true,"houseRules":true,"wifiInstructions":true,"localGuide":false,"addOns":true,"contact":true,"reviews":true}',
  custom_pages JSONB DEFAULT '[]',
  quick_links JSONB DEFAULT '[]',
  
  -- Features settings
  digital_check_in_enabled BOOLEAN DEFAULT true,
  check_in_steps JSONB DEFAULT '{"guestInfo":{"enabled":true,"required":true,"order":1},"additionalGuests":{"enabled":true,"required":false,"order":2},"idUpload":{"enabled":true,"required":true,"order":3},"registrationCard":{"enabled":true,"required":true,"order":4},"paymentAuth":{"enabled":true,"required":false,"order":5},"specialRequests":{"enabled":true,"required":false,"order":6},"houseRules":{"enabled":true,"required":true,"order":7}}',
  check_in_time_window TEXT DEFAULT '24h',
  mobile_key_enabled BOOLEAN DEFAULT true,
  access_code_delivery TEXT DEFAULT 'sms',
  in_portal_chat BOOLEAN DEFAULT true,
  folio_view_enabled BOOLEAN DEFAULT true,
  upsell_marketplace_enabled BOOLEAN DEFAULT true,
  review_request_timing TEXT DEFAULT 'post-stay',
  checkout_flow_enabled BOOLEAN DEFAULT true,
  qr_code_settings_enabled BOOLEAN DEFAULT false,
  
  -- Languages settings
  available_languages TEXT[] DEFAULT '{"en"}',
  default_language TEXT DEFAULT 'en',
  auto_detect TEXT DEFAULT 'browser',
  auto_translate_enabled BOOLEAN DEFAULT false,
  translation_completion JSONB DEFAULT '{"en":100}',
  
  -- Advanced settings
  data_retention INTEGER DEFAULT 365,
  https_enforced BOOLEAN DEFAULT true,
  analytic_pixel TEXT,
  custom_css TEXT,
  custom_js TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(property_id, portal_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_guest_portals_property_id ON public.guest_portals(property_id);
CREATE INDEX IF NOT EXISTS idx_guest_portals_portal_id ON public.guest_portals(portal_id);
CREATE INDEX IF NOT EXISTS idx_guest_portals_default ON public.guest_portals(property_id, default_portal);

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_guest_portals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guest_portals_update_timestamp ON public.guest_portals;
CREATE TRIGGER guest_portals_update_timestamp
BEFORE UPDATE ON public.guest_portals
FOR EACH ROW
EXECUTE FUNCTION update_guest_portals_updated_at();
