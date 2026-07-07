# Health AI Avatar

A Next.js AI health coaching application with an interactive, real-time talking avatar. Users speak to (or type at) an AI health assistant that responds with lip-synced avatar video and voice. The avatar is powered by HeyGen's LiveAvatar SDK.

Current phase: working demo running on a mock backend, ahead of integration with the real RAG (retrieval-augmented generation) backend.

## Features

- Real-time avatar video streaming with lip-sync
- Voice conversation: speak to the avatar, it speaks back (STT + TTS)
- Text chat as an input fallback
- Emergency guardrails that detect crisis keywords and show a warning
- Emotion-based UI states (supportive, warning, confused, neutral)
- Mic mute and unmute toggle with a visual indicator
- Mock backend simulating health coaching responses (to be replaced by the RAG backend)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Avatar | HeyGen LiveAvatar SDK |
| State | React hooks (no external state library) |

## Project Structure

```
src/
├── app/
│   ├── api/liveavatar/route.ts   # Backend proxy for the HeyGen API
│   ├── page.tsx                   # Main entry point
│   └── globals.css                # Theme + Tailwind
├── components/
│   ├── Chat.tsx                   # Main container, state management
│   ├── LiveAvatar.tsx             # HeyGen SDK wrapper
│   ├── MessageBubble.tsx          # Message display with emotions
│   ├── MessageInput.tsx           # Text input + mic toggle
│   └── WarningPopup.tsx           # Emergency warning modal
└── lib/
    ├── types.ts                   # TypeScript interfaces
    ├── mockBackend.ts             # Simulated health responses (temporary)
    ├── guardrails.ts              # Crisis keyword detection
    └── speech.ts                  # Browser TTS wrapper
```

## How a Conversation Flows

Safety checks run before and after the backend, not only at the end. This keeps the avatar consistent with the RAG backend, which screens unsafe or urgent questions before retrieval or answer generation.

```
User speaks
  -> SDK transcribes (speech to text)
  -> Input safety / urgent check      (screen unsafe or urgent symptoms first)
  -> RAG backend /ask                 (retrieval-augmented answer)
  -> Evidence gate / refusal          (answer only if backed by evidence)
  -> Final safety check               (re-screen the drafted answer)
  -> Avatar speaks                    (approved, safety-checked response)
```

Note: in the current demo the middle steps are handled by `mockBackend.ts`, which does keyword matching rather than real retrieval. The flow above is the target architecture once the RAG backend is wired in.

## Avatar and RAG Backend Integration

The avatar (frontend) and the RAG backend are two halves of one system. The frontend handles voice, transcription, and speaking; the backend owns safety, retrieval, and the evidence gate.

```
Avatar frontend                RAG backend /ask endpoint
---------------                -------------------------
User voice input        ->     Safety + urgent check
Speech-to-text                 Retrieval
Sends text to /ask             Evidence gate (refuse if unsupported)
Speaks approved reply   <-     Approved response
```

Integration work: replace `mockBackend.getCoachResponse()` with a call to the backend's `/ask` endpoint, and have the avatar speak only the approved response returned by the evidence gate.

## Key Components

1. **Chat.tsx** orchestrates everything: manages display state (idle, listening, thinking, speaking, warning), routes both voice and text input through the backend, and controls the avatar via ref methods.
2. **LiveAvatar.tsx** wraps the HeyGen integration: creates a session via `/api/liveavatar`, attaches the video stream to a `<video>` element, exposes `speakText()`, `interrupt()`, `muteVoice()`, and `unmuteVoice()`, and sends keep-alive pings every 2 minutes.
3. **mockBackend.ts** (temporary) simulates responses via keyword matching for health topics and returns a structured `CoachResponse` with an emotion state. This is the component the RAG backend replaces.

## Environment Variables

Create `.env.local` in the project root:

```env
HEYGEN_API_KEY=<your-api-key>
LIVEAVATAR_CONTEXT_ID=<context-id>
LIVEAVATAR_AVATAR_ID=<avatar-id>
LIVEAVATAR_VOICE_ID=<voice-id>
```

## Running the Project

```bash
npm install
npm run dev     # http://localhost:3000
```

Requires:
- Node.js
- Valid HeyGen API credentials in `.env.local`
- A browser with microphone access

## API Reference

### HeyGen LiveAvatar session methods

Available via `avatarRef.current`:

| Method | Purpose |
|--------|---------|
| `speakText(text)` | Make the avatar speak text verbatim (this is what we use) |
| `sendMessage(text)` | Send to HeyGen's built-in AI (not used, we run our own backend) |
| `interrupt()` | Stop the current speech |
| `muteVoice()` | Stop listening to the user |
| `unmuteVoice()` | Resume listening |

### Backend response format

```typescript
interface CoachResponse {
  answer: string;                    // What the avatar says
  evidence_used: EvidenceSource[];   // Citations
  guardrail_triggered: boolean;      // Show warning?
  emotion_state: "neutral" | "supportive" | "warning" | "confused";
}
```

## Known Limitations

- **No dynamic facial expressions.** HeyGen LiveAvatar does not support changing expressions during a live session. Expressions are fixed in the avatar's training video. Warnings are conveyed through UI (banners, emotion-coded states) instead. To change the look, swap in a more neutral avatar or train a custom one.
- **Session costs.** HeyGen bills by streamed minute, and tiers cap session length and concurrency. Monitor usage.
- **Avatar and voice switching mid-session** requires stopping and restarting the session.

## Roadmap

### High priority
- Replace `mockBackend.ts` with the real RAG backend via the `/ask` endpoint
- Avatar and voice selection UI (multiple `avatar_id` / `voice_id` options)
- Session management: timeouts and reconnection logic

### Medium priority
- Persist chat history (localStorage or database)
- User authentication and preferences
- Mobile-responsive layout

### Nice to have
- Multiple avatar options for users to pick
- Voice tone selection
- Usage analytics: common questions, guardrail triggers

## Notes for Developers

- **Avatar and voice selection is possible.** Use HeyGen's `List All Avatars V2` and `List All Voices V2` APIs to get options, then pass the chosen `avatar_id` and `voice_id` when creating a session. Switching mid-session requires a restart.
- **Expression control is not possible.** Do not spend time trying to change avatar expressions dynamically. It is a HeyGen limitation.
- **Session cleanup matters.** The code uses `sendBeacon` on page unload to stop sessions and prevent orphaned sessions that keep billing.
- **Privacy and ethics.** Voice, audio, and potentially health-related text pass through a third-party avatar service. Before real users, document the data flow, confirm vendor storage and retention, clarify vendor access, and align with Laurier and McMaster privacy and research-ethics (REB) requirements.
