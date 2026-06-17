export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Not allowed", { status: 405, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Bad request", { status: 400, headers: corsHeaders });
    }

    // ── Save to D1 ──
    await env.DB.prepare(
      `INSERT INTO farmers 
       (farm_name, location, farming_experience, farming_duration, current_stage, 
        start_timeline, infrastructure, feed_budget_status, feed_budget_amount, 
        availability, phone, biggest_problem, score, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body["Name"] || "",
      body["Location"] || "",
      body["Farming Experience"] || "",
      body["Farming Duration"] || "(first time)",
      body["Current Stage"] || "",
      body["Start Timeline"] || "(n/a)",
      body["Infrastructure"] || "",
      body["Feed Budget Status"] || "",
      body["Feed Budget Amount"] || "(none)",
      body["Availability"] || "",
      body["WhatsApp Number"] || "",
      body["Biggest Problem"] || "(no answer)",
      body["Score"] || 0,
      body["Submitted At"] || ""
    ).run();

    // ── Get full leaderboard from D1 ──
    const leaderboardResult = await env.DB.prepare(
      `SELECT * FROM farmers ORDER BY score DESC`
    ).all();

    const totalFarmers = leaderboardResult.results.length;

    const leaderboard = leaderboardResult.results.map((e, i) =>
      `#${i+1}. ${e.farm_name} | ${e.location} | Score: ${e.score} | ${e.farming_experience} | Stage: ${e.current_stage} | Budget: ${e.feed_budget_amount} | Water: ${e.infrastructure} | Avail: ${e.availability} | WA: ${e.phone}`
    ).join("\n");

    // ── Top farmer ──
    const top = leaderboardResult.results[0];

    // ── Send email via Resend ──
    const emailText = `
NEW APPLICATION — SABII FARMS PROFITABLE POND PROGRAM
=====================================================

NAME:               ${body["Name"] || ""}
LOCATION:           ${body["Location"] || ""}
WHATSAPP:           ${body["WhatsApp Number"] || ""}
SCORE:              ${body["Score"] || 0}

FARMING EXPERIENCE: ${body["Farming Experience"] || ""}
FARMING DURATION:   ${body["Farming Duration"] || "(first time)"}
CURRENT STAGE:      ${body["Current Stage"] || ""}
START TIMELINE:     ${body["Start Timeline"] || "(n/a)"}
INFRASTRUCTURE:     ${body["Infrastructure"] || ""}
FEED BUDGET STATUS: ${body["Feed Budget Status"] || ""}
FEED BUDGET AMOUNT: ${body["Feed Budget Amount"] || "(none)"}
AVAILABILITY:       ${body["Availability"] || ""}

BIGGEST PROBLEM:
${body["Biggest Problem"] || "(no answer given)"}

=====================================================
TOTAL APPLICATIONS SO FAR: ${totalFarmers}

FULL LEADERBOARD — BEST TO LEAST:
=====================================================
${leaderboard}
    `.trim();

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + env.RESEND_API_KEY
      },
      body: JSON.stringify({
        from: "Sabii Farms <onboarding@resend.dev>",
        to: ["sabiifarmsincorporated@gmail.com"],
        subject: "🐟 New Entry: " + (body["Name"] || "Unknown") + " — Score " + (body["Score"] || 0),
        text: emailText
      })
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
