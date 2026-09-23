# Health AI Avatar

A Next.js AI health information application with an interactive 3D talking avatar. Users speak to (or type at) an AI health assistant that responds with lip-synced avatar animation and voice. The avatar is powered by TalkingHead (3D rendering) and HeadTTS (browser-based neural TTS).

Current phase: Frontend integrated with RAG (retrieval-augmented generation) backend for document-grounded health information responses.

## Features

- **3D animated avatar** with real-time lip-sync via TalkingHead
- **Browser-based neural TTS** via HeadTTS (WebGPU accelerated, WASM fallback)
- **Voice conversation**: speak to the avatar using Web Speech API, it speaks back
- **Text chat** as input fallback when voice is unavailable
- **Safety guardrails** that detect urgent/crisis content and show emergency resources
- **Semantic expressions**: avatar mood and gestures driven by response content
- **Evidence-grounded responses**: answers cite source documents, partial evidence shown with amber warning
- **Configurable avatar**: male/female models with multiple voice options
- **Echo suppression**: 4-layer system prevents avatar from hearing itself

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| 3D Avatar | TalkingHead (self-hosted) |
| Text-to-Speech | HeadTTS (CDN, WebGPU/WASM) |
| Speech Recognition | Web Speech API (browser) |
| State | React hooks (no external state library) |

## Project Structure

```
src/
├── app/
│   ├── api/rag/route.ts          # Backend proxy for RAG API
│   ├── page.tsx                   # Main entry point
│   ├── layout.tsx                 # Preloads avatar libraries
│   └── globals.css                # Theme + Tailwind
├── components/
│   ├── Chat.tsx                   # Main container, state management
│   ├── TalkingHeadAvatar.tsx      # 3D avatar with TTS and speech recognition
│   ├── MessageBubble.tsx          # Message display with citations
│   ├── MessageInput.tsx           # Text input + mic toggle
│   └── WarningPopup.tsx           # Emergency warning modal
└── lib/
    ├── types.ts                   # TypeScript interfaces
    ├── ragBackend.ts              # RAG backend client
    ├── mockBackend.ts             # Fallback mock responses
    ├── metrics.ts                 # Latency and evaluation metrics
    └── speech.ts                  # Speech utilities
public/
└── lib/
    ├── talkinghead.mjs            # TalkingHead library (self-hosted)
    ├── three.module.js            # Three.js for 3D rendering
    └── three-addons/              # Three.js loaders and utilities
```

## How a Conversation Flows

```
User speaks or types
  → Speech recognition (Web Speech API)
  → RAG backend /api/rag (proxied)
      → Safety/urgent check
      → Document retrieval
      → Evidence gate (answer only if supported)
      → Response with citations
  → Avatar speaks response (HeadTTS → TalkingHead lip-sync)
  → Semantic analysis sets mood/gestures from response text
```

## Avatar System

### TalkingHead + HeadTTS Architecture

The avatar uses two libraries working together:

1. **HeadTTS** (browser-based neural TTS)
   - Converts text to speech audio
   - Generates viseme timing data for lip-sync
   - Runs on WebGPU (fast) or falls back to WebAssembly (slower)
   - Loaded from CDN with AI model dependencies

2. **TalkingHead** (3D avatar renderer)
   - Renders Ready Player Me compatible GLB avatars
   - Applies viseme morph targets for lip-sync
   - Supports moods: neutral, happy, sad, angry, fear, love, disgust, sleep
   - Supports gestures: nod, shake, shrug, point, thumbsup, thumbsdown, wave, ok, namaste

### Echo Suppression

Four-layer system prevents the avatar from transcribing its own speech:

| Layer | Mechanism |
|-------|-----------|
| 1 | Abort recognition before TTS playback |
| 2 | Reject results while speaking flag is set |
| 3 | 2000ms cooldown after speaking ends |
| 4 | Text matching against last spoken content |

### Semantic Expression

Avatar mood and gestures are selected by keyword matching in the response text:

| Keywords | Mood | Gesture |
|----------|------|---------|
| emergency, 911, crisis, urgent | fear | - |
| yes, correct, great, excellent | happy | nod |
| no, don't, avoid, never | - | head shake |
| maybe, perhaps, not sure | - | shrug |
| important, remember, must | - | point |

## Environment Variables

Create `.env.local` in the project root:

```env
RAG_BACKEND_URL=<url-to-rag-backend>
```

## Running the Project

```bash
npm install
npm run dev     # http://localhost:3000
```

Requires:
- Node.js
- RAG backend running (or falls back to mock responses)
- Browser with microphone access (for voice input)
- WebGPU support recommended (falls back to WASM)

## Backend Response Format

```typescript
interface CoachResponse {
  answer: string;                    // What the avatar speaks
  evidence_used: EvidenceSource[];   // Citations with doc_id, title, snippet
  evidence_sufficient: boolean;      // Full confidence or partial
  guardrail_triggered: boolean;      // Show safety modal?
  emotion_state: "supportive" | "warning" | "confused" | "neutral";
  answer_status: "full" | "partial" | "refused" | "safety";
  sufficiency_reason: string;        // Why this answer_status
}
```

## Response States

| State | UI Behavior |
|-------|-------------|
| full | Answer with citations, green status |
| partial | Answer with amber "limited evidence" warning |
| refused | Explains why question is out of scope |
| safety | Emergency modal with crisis resources, avatar shows fear expression |

## Metrics Collection

Built-in instrumentation for evaluation (accessible via `window.__metrics`):

- **Latency metrics**: T0-T5 timestamps for each conversation turn
- **Interaction metrics**: Response states and completion rates
- **Presentation metrics**: UI element verification
- **Echo suppression metrics**: Self-transcription detection
- **Viseme metrics**: Lip-sync timing accuracy

```javascript
// In browser console
window.__metrics.printAllSummaries()
window.__metrics.downloadMetrics()
```

## Known Limitations

- **Expression is keyword-driven**: Avatar mood comes from text analysis, not backend safety flag. A guardrail response without trigger words may not show concerned expression.
- **Backend latency**: With OpenAI-based backend, expect 20-30s response times. Local GPU deployment achieves 3-7s.
- **WebGPU required for fast TTS**: Without GPU acceleration, synthesis is significantly slower.
- **Speech recognition browser-dependent**: Best support in Chrome; limited/no support in Firefox.

## Roadmap

### High Priority
- Drive safety expression from backend flag (not just keywords)
- Streaming responses for faster perceived latency
- Reduce TTS synthesis time

### Medium Priority
- Persist chat history
- Mobile-responsive layout
- Offline fallback mode

### Nice to Have
- Additional avatar models
- User preference persistence
- Usage analytics

## Third-Party Licenses

| Library | License | Use |
|---------|---------|-----|
| TalkingHead | MIT | 3D avatar animation |
| HeadTTS | MIT | Neural text-to-speech |
| Three.js | MIT | 3D rendering |
| Next.js | MIT | Web framework |
| React | MIT | UI library |

All major dependencies are MIT licensed (permissive, commercial-friendly).
