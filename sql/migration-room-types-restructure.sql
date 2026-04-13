
-- Add new columns to room_types table
ALTER TABLE room_types 
  ADD COLUMN IF NOT EXISTS thumbnail_image_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery_image_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS beds JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_amenities JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS number_of_rooms_available INT,
  ADD COLUMN IF NOT EXISTS assigned_room_numbers JSONB DEFAULT '[]'::jsonb;

-- Add amenities column to rooms table for room-specific amenities
ALTER TABLE rooms 
  ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_room_types_selected_amenities ON room_types USING GIN (selected_amenities);
CREATE INDEX IF NOT EXISTS idx_room_types_beds ON room_types USING GIN (beds);
CREATE INDEX IF NOT EXISTS idx_rooms_amenities ON rooms USING GIN (amenities);

-- Add comment for documentation
COMMENT ON COLUMN room_types.thumbnail_image_url IS 'Primary image URL for the room type';
COMMENT ON COLUMN room_types.gallery_image_urls IS 'Array of additional image URLs for the room type';
COMMENT ON COLUMN room_types.beds IS 'Array of bed configurations: [{type: "Twin"|"Double"|"Queen"|"King"|"Bunk"|"Sofa", count: number}]';
COMMENT ON COLUMN room_types.selected_amenities IS 'Array of amenity IDs selected for this room type';
COMMENT ON COLUMN room_types.number_of_rooms_available IS 'Count of rooms available for this type (optional)';
COMMENT ON COLUMN room_types.assigned_room_numbers IS 'Array of room numbers assigned to this type (optional)';
COMMENT ON COLUMN rooms.amenities IS 'Array of amenity IDs for this specific room (can override room type amenities)';
