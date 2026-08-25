import { NextRequest, NextResponse } from "next/server";

const RAG_BACKEND_URL = (
  process.env.RAG_BACKEND_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const RAG_BACKEND_TIMEOUT_MS = Number(
  process.env.RAG_BACKEND_TIMEOUT_MS || "300000",
);

async function backendJson(path: string, init?: RequestInit) {
  const response = await fetch(`${RAG_BACKEND_URL}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(RAG_BACKEND_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({
    detail: `Backend returned HTTP ${response.status}`,
  }));
  return { response, body };
}

export async function GET() {
  try {
    const [health, assistantInfo] = await Promise.all([
      backendJson("/health"),
      backendJson("/assistant-info"),
    ]);
    if (!health.response.ok || !assistantInfo.response.ok) {
      return NextResponse.json(
        { error: "RAG backend is not ready" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      backend: health.body,
      assistant: assistantInfo.body,
    });
  } catch (error) {
    console.error("RAG backend health check failed:", error);
    return NextResponse.json(
      { error: "Unable to reach the RAG backend" },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 },
      );
    }

    const { response, body: backendBody } = await backendJson("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    return NextResponse.json(backendBody, { status: response.status });
  } catch (error) {
    console.error("RAG backend request failed:", error);
    return NextResponse.json(
      { error: "Unable to reach the RAG backend" },
      { status: 502 },
    );
  }
}
