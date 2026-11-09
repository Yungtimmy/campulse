import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

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
  const isPending = path === "/pending";
  const isSignin = path === "/signin";

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  };

  if (!user && (isRoom || isAdmin || isPending)) {
    return redirectTo("/signin");
  }

  if (user && (isRoom || isAdmin || isPending || isSignin)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("verification_status, university_id")
      .eq("id", user.id)
      .maybeSingle();
    const verified = profile?.verification_status === "verified";

    let home = "/room/funaab";
    if (profile?.university_id) {
      const { data: uni } = await supabase
        .from("universities")
        .select("slug")
        .eq("id", profile.university_id)
        .maybeSingle();
      if (uni?.slug) home = `/room/${uni.slug}`;
    }

    if ((isRoom || isAdmin) && !verified) return redirectTo("/pending");
    if ((isPending || isSignin) && verified) return redirectTo(home);

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
