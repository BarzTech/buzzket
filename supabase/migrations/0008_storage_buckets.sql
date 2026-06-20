-- Create a public bucket for event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public select and authenticated insert
CREATE POLICY "Public Read Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-images');

CREATE POLICY "Authenticated Insert Access" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-images');
