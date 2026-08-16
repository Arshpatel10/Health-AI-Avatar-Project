import { NextRequest, NextResponse } from "next/server";

// Use v1beta1 API for enableTimePointing support (needed for lip-sync)
const GOOGLE_TTS_API = "https://texttospeech.googleapis.com/v1beta1/text:synthesize";

interface TTSRequest {
  input: {
    text?: string;
    ssml?: string;
  };
  voice: {
    languageCode: string;
    name?: string;
    ssmlGender?: string;
  };
  audioConfig: {
    audioEncoding: string;
    speakingRate?: number;
    pitch?: number;
    volumeGainDb?: number;
    sampleRateHertz?: number;
  };
  enableTimePointing?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Cloud TTS API key not configured" },
        { status: 500 }
      );
    }

    const body: TTSRequest = await request.json();

    const response = await fetch(`${GOOGLE_TTS_API}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google TTS API error:", errorText);
      return NextResponse.json(
        { error: "TTS API request failed", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("TTS route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
