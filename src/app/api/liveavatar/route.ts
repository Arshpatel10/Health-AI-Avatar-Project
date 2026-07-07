import { NextRequest, NextResponse } from "next/server";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY!;
const CONTEXT_ID = process.env.LIVEAVATAR_CONTEXT_ID!;
const AVATAR_ID = process.env.LIVEAVATAR_AVATAR_ID!;
const VOICE_ID = process.env.LIVEAVATAR_VOICE_ID!;

const API_BASE = "https://api.liveavatar.com/v1";

// POST /api/liveavatar - Create session and start it
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "create";

    if (action === "create") {
      // Create session token - the frontend SDK will handle starting the session
      const tokenResponse = await fetch(`${API_BASE}/sessions/token`, {
        method: "POST",
        headers: {
          "X-API-KEY": HEYGEN_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "FULL",
          is_sandbox: false,
          avatar_id: AVATAR_ID,
          avatar_persona: {
            voice_id: VOICE_ID,
            context_id: CONTEXT_ID,
            language: "en",
          },
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error("Token creation failed:", error);
        return NextResponse.json(
          { error: "Failed to create session token", details: error },
          { status: tokenResponse.status }
        );
      }

      const tokenData = await tokenResponse.json();
      const { session_id, session_token } = tokenData.data;

      return NextResponse.json({
        session_id,
        session_token,
      });
    } else if (action === "stop") {
      const { session_token } = body;

      if (!session_token) {
        return NextResponse.json(
          { error: "session_token required" },
          { status: 400 }
        );
      }

      const stopResponse = await fetch(`${API_BASE}/sessions/stop`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session_token}`,
        },
      });

      if (!stopResponse.ok) {
        const error = await stopResponse.text();
        return NextResponse.json(
          { error: "Failed to stop session", details: error },
          { status: stopResponse.status }
        );
      }

      return NextResponse.json({ success: true });
    } else if (action === "keepalive") {
      const { session_token } = body;

      if (!session_token) {
        return NextResponse.json(
          { error: "session_token required" },
          { status: 400 }
        );
      }

      const keepaliveResponse = await fetch(`${API_BASE}/sessions/keep-alive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session_token}`,
        },
      });

      if (!keepaliveResponse.ok) {
        const error = await keepaliveResponse.text();
        return NextResponse.json(
          { error: "Failed to send keepalive", details: error },
          { status: keepaliveResponse.status }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("LiveAvatar API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
