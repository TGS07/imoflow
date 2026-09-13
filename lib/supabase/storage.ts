import type { SupabaseClient } from '@supabase/supabase-js'

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
): Promise<{ path: string } | { error: string }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false })

  if (error) return { error: error.message }
  return { path: data.path }
}

/**
 * Returns the public URL for a file in a Supabase Storage bucket.
 * Note: this always returns a URL, even for private buckets — access to the
 * underlying file is still gated by the bucket's RLS policies.
 */
export function getPublicUrl(supabase: SupabaseClient, bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/**
 * Deletes a file from a Supabase Storage bucket.
 */
export async function deleteFile(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<{ error: string } | { success: true }> {
  const { error } = await supabase.storage.from(bucket).remove([path])

  if (error) return { error: error.message }
  return { success: true }
}

/**
 * Lists files in a Supabase Storage bucket under the given prefix (folder).
 */
export async function listFiles(supabase: SupabaseClient, bucket: string, prefix: string) {
  return supabase.storage.from(bucket).list(prefix)
}
