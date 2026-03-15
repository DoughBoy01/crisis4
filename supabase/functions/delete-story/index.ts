import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role = user.app_metadata?.role;
    if (role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const storyTitle: string = body.title;

    if (!storyTitle || typeof storyTitle !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: rows, error: fetchError } = await adminClient
      .from("feed_cache")
      .select("id, payload")
      .order("created_at", { ascending: false })
      .limit(5);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let deletedCount = 0;

    for (const row of rows ?? []) {
      const payload = row.payload as {
        sources: Array<{ items?: Array<{ title: string }> }>;
      };

      let changed = false;

      for (const source of payload.sources ?? []) {
        if (!source.items) continue;
        const before = source.items.length;
        source.items = source.items.filter(
          (item) => item.title.trim().toLowerCase() !== storyTitle.trim().toLowerCase()
        );
        if (source.items.length < before) changed = true;
      }

      if (changed) {
        const { error: updateError } = await adminClient
          .from("feed_cache")
          .update({ payload })
          .eq("id", row.id);

        if (!updateError) deletedCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, rowsUpdated: deletedCount }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
