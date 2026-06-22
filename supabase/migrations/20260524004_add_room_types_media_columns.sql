-- Ensure room_types has media/amenity columns used by API queries.
-- Previous non-timestamped migration file is skipped by Supabase CLI.

ALTER TABLE public.room_types
  ADD COLUMN IF NOT EXISTS thumbnail_image_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery_image_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS beds JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_amenities JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS number_of_rooms_available INT,
  ADD COLUMN IF NOT EXISTS assigned_room_numbers JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_room_types_selected_amenities
  ON public.room_types USING GIN (selected_amenities);

CREATE INDEX IF NOT EXISTS idx_room_types_beds
  ON public.room_types USING GIN (beds);
