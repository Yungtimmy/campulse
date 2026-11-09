"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

export function createClient() {
  const env = publicEnv();
  if (!env) {
    throw new Error("Supabase environment variables are not set");
  }
  return createBrowserClient(env.url, env.key);
}
