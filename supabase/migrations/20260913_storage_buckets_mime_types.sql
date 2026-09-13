-- Restrict property-photos (public bucket) to image mime types only,
-- reducing the attack surface of a bucket that serves content without auth.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'property-photos';
