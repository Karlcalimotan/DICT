# AGENTS.md

## What lives here
This repository is built and maintained with the help of AI coding agents.

## Models in use
- **Gemini 3.5 Flash (Low) / Gemini 1.5 Flash (cloud)** — used as primary coding agents for automated edits, refactoring, and sandbox tool operations.
- **Gemini (cloud)** — used for general content generation, documentation, and brainstorming.
- **Gemma 4 2B via Ollama or LM Studio (local)** — used for offline tasks, quick code review, and linting support.

## Agentic Coding Workflow & Operations
- **Tool Sandbox**: Agents have sandbox capabilities to perform grep searches, view files, write files, and execute commands.
- **Planning Mode**: Before executing major architectural updates or multi-phase refactoring tasks, agents are expected to draft an `implementation_plan.md` and obtain human approval. Progress is tracked incrementally in `task.md`.
- **Hot-Reloading Restrictions**: HMR is disabled via the `DISABLE_HMR` environment variable inside the workspace environment to prevent runtime flickering and optimize CPU usage during automated edits.
- **Slash Commands**: Recommended interaction shortcuts:
  - `/goal` — for complex, multi-step agent actions.
  - `/schedule` — for recurring verification or background timers.
  - `/grill-me` — for clarifying design decisions via interactive Q&A.

## Responsible AI rules
- Every model output is reviewed by a human before it is merged.
- No personal data, credentials, or proprietary code is sent to a public model.
- AI assistance is disclosed in PR descriptions and in the README footer.
- Known limitations: small local models may hallucinate citations; we verify every citation against the source PDF.
- High-risk changes (auth, payments, student records) require a second human reviewer.

## Verification & Health Checks
- Before proposing pull requests or final updates, verify typing correctness and syntax via:
  `npm run lint` (or `npx tsc --noEmit`)
- Verify complete webapp builds:
  `npm run build`

## Escalation
If a model produces something that looks wrong, stop and ask a human.

