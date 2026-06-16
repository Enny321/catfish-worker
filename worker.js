export default {
  async fetch(request, env) {

    // Allow requests from your Cloudflare Pages domain
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Not allowed", { status: 405 });
    }

    // ── Parse the submission ──
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Bad request", { status: 400, headers: corsHeaders });
    }

    // ── Store in KV (Cloudflare Key-Value storage) ──
    // Each entry stored under key: "entry_<timestamp>_<random>"
    const entryKey = `entry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await env.SABII_ENTRIES.put(entryKey, JSON.stringify(body));

    // ── Pull all entries, build leaderboard ──
    const allKeys = await env.SABII_ENTRIES.list();
    const allEntries = [];

    for (const key of allKeys.keys) {
      const raw = await env.SABII_ENTRIES.get(key.name);
      if (raw) {
        try { allEntries.push(JSON.parse(raw)); } catch (e) {}
      }
    }

    // Sort best to least
    allEntries.sort((a, b) => (b.Score || 0) - (a.Score || 0));

    const leaderboard = allEntries
      .map((e, i) =>
        `#${i + 1}. ${e["Name"] || "Unknown"} | ${e["Location"] || "?"} | Score: ${e["Score"] || 0} | ${e["Farming Experience"] || "?"} | Stage: ${e["Current Stage"] || "?"} | Budget: ${e["Feed Budget Amount"] || e["Feed Budget Status"] || "?"} | Water: ${e["Infrastructure"] || "?"} | Avail: ${e["Availability"] || "?"} | WA: ${e["WhatsApp Number"] || "?"}`
      )
      .join("\n");

    // ── Send email via MailChannels ──
    const emailBody = `
NEW ENTRY — SABII FARMS PROFITABLE POND PROGRAM
================================================

Name:               ${body["Name"] || ""}
Location:           ${body["Location"] || ""}
Farming Experience: ${body["Farming Experience"] || ""}
Farming Duration:   ${body["Farming Duration"] || "(first time)"}
Current Stage:      ${body["Current Stage"] || ""}
Start Timeline:     ${body["Start Timeline"] || "(n/a)"}
Infrastructure:     ${body["Infrastructure"] || ""}
Feed Budget Status: ${body["Feed Budget Status"] || ""}
Feed Budget Amount: ${body["Feed Budget Amount"] || "(none declared)"}
Availability:       ${body["Availability"] || ""}
WhatsApp Number:    ${body["WhatsApp Number"] || ""}
Score:              ${body["Score"] || 0}
Submitted At:       ${body["Submitted At"] || ""}

Biggest Problem:
${body["Biggest Problem"] || "(no answer given)"}

================================================
FULL LEADERBOARD — BEST TO LEAST
================================================
${leaderboard}
    `.trim();

    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: {
          email: "assessment@sabiifarmsincorporated.com",
          name: "Sabii Farms Assessment"
        },
        to: [{ email: "sabiifarmsincorporated@gmail.com" }],
        subject: `🐟 New Entry: ${body["Name"] || "Unknown"} — Score ${body["Score"] || 0}`,
        content: [{ type: "text/plain", value: emailBody }]
      })
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};