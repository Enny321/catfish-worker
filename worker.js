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
      return new Response("Not allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Bad request", { status: 400, headers: corsHeaders });
    }

    // ── Store in D1 Database ──
    await env.DB.exec(
      `INSERT INTO farmers 
       (farm_name, location, farming_experience, farming_duration, current_stage, 
        start_timeline, infrastructure, feed_budget_status, feed_budget_amount, 
        availability, phone, biggest_problem, score, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    );

    // ── Get top farmer from D1 ──
    const result = await env.DB.exec(
      `SELECT * FROM farmers ORDER BY score DESC LIMIT 1`
    );
    const topFarmer = result.results[0];

    // ── Get total count ──
    const countResult = await env.DB.exec(
      `SELECT COUNT(*) as total FROM farmers`
    );
    const totalFarmers = countResult.results[0].total;

    // ── Get full leaderboard ──
    const leaderboardResult = await env.DB.exec(
      `SELECT * FROM farmers ORDER BY score DESC`
    );
    
    const leaderboard = leaderboardResult.results
      .map((e, i) =>
        `#${i + 1}. ${e.farm_name} | ${e.location} | Score: ${e.score} | ${e.farming_experience} | Stage: ${e.current_stage} | Budget: ${e.feed_budget_amount} | ${e.availability} | WA: ${e.phone}`
      )
      .join("\n");

    // ── Send email via Resend ──
    const emailBody = `
🐟 NEW CATFISH FARMER APPLICATION — SABII FARMS
================================================

NAME:               ${topFarmer.farm_name}
LOCATION:           ${topFarmer.location}
PHONE:              ${topFarmer.phone}
SCORE:              ${topFarmer.score} points

FARMING EXPERIENCE: ${topFarmer.farming_experience}
DURATION:           ${topFarmer.farming_duration}
CURRENT STAGE:      ${topFarmer.current_stage}
INFRASTRUCTURE:     ${topFarmer.infrastructure}
FEED BUDGET:        ${topFarmer.feed_budget_amount}
AVAILABILITY:       ${topFarmer.availability}

BIGGEST PROBLEM:
${topFarmer.biggest_problem}

================================================
TOTAL APPLICATIONS: ${totalFarmers}
FULL LEADERBOARD:
================================================
${leaderboard}

Submitted At: ${topFarmer.timestamp}
    `.trim();

    const RESEND_API_KEY = env.RESEND_API_KEY; // Get from Worker variables

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: "Sabii Farms <onboarding@resend.com>",
        to: ["sabiifarmsincorporated@gmail.com"],
        subject: `🐟 New Entry: ${body["Name"] || "Unknown"} — Score ${body["Score"] || 0}`,
        text: emailBody
      })
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
