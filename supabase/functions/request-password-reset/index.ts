import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, redirectTo } = await req.json();
    const normalized = String(email ?? "").trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 255) {
      return json({ error: "Please enter a valid email address." }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await admin
      .from("profiles")
      .select("id, is_active")
      .ilike("email", normalized)
      .maybeSingle();

    if (profile && profile.is_active === false) {
      return json({ inactive: true, error: "User is inactive. Kindly reach out to your administrator for assistance." });
    }

    if (profile) {
      const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { error } = await anon.auth.resetPasswordForEmail(normalized, { redirectTo });
      if (error) console.error("reset error", error.message);
    }
    // Generic success to avoid revealing which emails exist
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Unable to process request" }, 500);
  }
});
