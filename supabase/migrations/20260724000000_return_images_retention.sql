-- Migration: Return Images Multi-Upload & 15-Day Retention Purge Schedule
-- Applied: July 2026

-- Add return_images JSONB column to hold name, url, and public_id of up to 4 images
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_images JSONB DEFAULT '[]'::jsonb;

-- Add scheduling column for image retention (sets date for 15 days after refund approval)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_images_deletion_scheduled_at TIMESTAMP WITH TIME ZONE;

-- Add boolean flag to track deletion completion
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_images_deleted BOOLEAN DEFAULT false;
