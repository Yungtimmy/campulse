import { NextResponse } from "next/server";
import { needsRegistration, safeNext } from "@/lib/registration";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("registered_at, verification_status")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.verification_status === "rejected") {
          return NextResponse.redirect(`${origin}/pending`);
        }
        if (needsRegistration(profile)) {
          return NextResponse.redirect(`${origin}/register?next=${encodeURIComponent(next)}`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/signin?error=link`);
}
