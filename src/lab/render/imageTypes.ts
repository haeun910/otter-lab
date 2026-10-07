/** Binary files live in IndexedDB; compact metadata can sync through Supabase. */
export interface GeneratedCardImage {
  id: string;
  fingerprint: string;
  width: number;
  height: number;
  createdAt: number;
}
export interface ImageResult {
  png: string;
  width: number;
  height: number;
}
