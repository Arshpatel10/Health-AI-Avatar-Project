# Technical Plan — Health AI Avatar (Frontend)

Week 1 (June 22 - June 26)
## Purpose
This document outlines the frontend approach for the AI avatar health coach. It covers the stack, structure, and the backend response format the UI is built against. 
The backend RAG/LLM system is developed separately, so the frontend is built against a mock that mirrors the expected response shape.

## Stack

- **Next.js (App Router) + React** — component-based UI and file-based routing.
- **TypeScript** — typed data contracts between the mock backend and the UI.
- **Tailwind CSS** — styling and responsive layout.
- **Avatar/animation (later week):** the lead choice is **Rive**, because its state-machine model fits the avatar's interaction and emotional states well, and it is designer-editable. **SVG + CSS** is the documented fallback if Rive's tooling proves too heavy. The avatar is not built in Week 1; this is the intended direction, to be validated when the avatar is prototyped. Also looking into **Canvas API** for building out avatar and its associated animations.

## Folder structure

    src/
      app/
        layout.tsx
        page.tsx            # main chat page
      components/
        Chat.tsx            # message list + input container, owns chat state
        MessageBubble.tsx   # one message (user / assistant / urgent)
        MessageInput.tsx    # text input + send button
      lib/
        types.ts            # backend response contract
        mockBackend.ts      # mock responses + simulated latency
        guardrails.ts       # provisional safe/urgent detection

## Backend response format (provisional)

The UI is built against this shape. It is provisional and to be confirmed with the backend team.

    {
      "answer": "Plain-language educational response text.",
      "evidence_used": [
        { "document_id": "doc_1", "chunk_id": "chunk_2", "title": "Source title", "snippet": "Short excerpt." }
      ],
      "guardrail_triggered": false,
      "emotion_state": "neutral | supportive | warning"
    }

- `answer` — the response text shown to the user and (later) spoken aloud.
- `evidence_used` — sources behind the answer; `title`/`snippet` are optional display fields. Empty when there is no source.
- `guardrail_triggered` — true when the query is high-risk; drives the urgent response display.
- `emotion_state` — drives the avatar's emotional state in later weeks.

## Chat data flow (Week 1)

`page.tsx` renders `Chat`, which owns the message list and a `handleSend` function. On send: the user message is added, a loading/thinking state is shown, the mock backend is called, and the assistant response is added when it returns. `MessageBubble` renders each message, with distinct urgent styling when `guardrail_triggered` is true. A provisional keyword-based guardrail in `guardrails.ts` flags high-risk queries in the mock, pending the decision on where guardrails live in production.

## Questions to consider moving forward
 - Any specific design requirments
 - Will there be any authentication and session requirements?

 - What does the schema look like, will the field names and types need changing?
 - Do we need a seperate chat area for different types of responses, i.e. Urgent responses showing up in a different box.


realistic avatar - user friendly 