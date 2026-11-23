import { LocalRepository } from "./localRepo";
import { SupabaseRepository } from "./supabaseRepo";
import type { Repository } from "./types";

/** ถ้าตั้งค่า Supabase ใน .env.local ใช้ Supabase ไม่อย่างนั้นใช้ localStorage */
export function createRepository(): Repository {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return url && key ? new SupabaseRepository(url, key) : new LocalRepository();
}
