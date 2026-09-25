import type { SupabaseClient } from '@supabase/supabase-js'
import type { FileObject } from '@supabase/storage-js'

/**
 * Uploads a file to a Supabase Storage bucket.
 * The `supabase` client is provided by the caller (server or browser client) —
 * this function does not create its own client.
 */
export async function uploadFile(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File | Blob
): Promise<{ data: { path: string } | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false })

  if (error) return { data: null, error: error.message }
  return { data: { path: data.path }, error: null }
}

/**
 * Returns the public URL for a file in a Supabase Storage bucket.
 * Note: this always returns a URL, even for private buckets — access to the
 * underlying file is still gated by the bucket's RLS policies.
 */
export function getPublicUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): { data: { publicUrl: string } | null; error: string | null } {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { data, error: null }
}

export async function deleteFile(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<{ data: FileObject[] | null; error: string | null }> {
  const { data, error } = await supabase.storage.from(bucket).remove([path])

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
