import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { needsRegistration, safeNext } from "@/lib/registration";

export async function updateSession(request: NextRequest) {
  const env = publicEnv();
  if (!env) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isRoom = path.startsWith("/room");
  const isAdmin = path.startsWith("/admin");
  const isReport = path.startsWith("/report");
  const isPulse = path.startsWith("/pulse");
  const isPending = path === "/pending";
  const isSignin = path === "/signin";
  const isRegister = path === "/register";
  const memberArea = isRoom || isAdmin || isReport || isPulse;

  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  };

  const here = `${path}${request.nextUrl.search}`;

  if (!user && (memberArea || isPending || isRegister)) {
    const requested = isRegister ? request.nextUrl.searchParams.get("next") : here;
    return redirectTo("/signin", `?next=${encodeURIComponent(safeNext(requested))}`);
  }

  if (user && (memberArea || isPending || isSignin || isRegister)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("verification_status, university_id, registered_at")
      .eq("id", user.id)
      .maybeSingle();
    const verified = profile?.verification_status === "verified";
    const rejected = profile?.verification_status === "rejected";
    const unregistered = needsRegistration(profile);

    let home = "/room/funaab";
    if (profile?.university_id) {
      const { data: uni } = await supabase
        .from("universities")
        .select("slug")
        .eq("id", profile.university_id)
        .maybeSingle();
      if (uni?.slug) home = `/room/${uni.slug}`;
    }

    if (unregistered && (memberArea || isPending || isSignin)) {
      const dest = isSignin ? safeNext(request.nextUrl.searchParams.get("next")) : safeNext(here);
      return redirectTo("/register", `?next=${encodeURIComponent(dest)}`);
    }
    if (rejected && (memberArea || isRegister || isSignin)) return redirectTo("/pending");
    if (memberArea && !verified) return redirectTo("/pending");
    if ((isPending || isSignin || isRegister) && verified) {
      const dest = isSignin ? safeNext(request.nextUrl.searchParams.get("next")) : home;
      return redirectTo(dest);
    }

    if (isAdmin && verified) {
      const slug = path.split("/")[2] ?? "";
      const { data: uni } = await supabase
        .from("universities")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      const { data: roles } = await supabase
        .from("admin_roles")
        .select("role, university_id")
        .eq("profile_id", user.id);
      const allowed = (roles ?? []).some(
        (role) =>
          role.role === "super_admin" || (uni && role.university_id === uni.id && role.role === "university_admin"),
      );
      if (!allowed) return redirectTo(home);
    }
  }

  return supabaseResponse;
}
