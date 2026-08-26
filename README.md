# Agent Control Lab

[Open the interactive simulation](https://abrahamkaunda-create.github.io/agent-control-lab/) · [Read the portfolio case study](https://abrahamkaunda-create.github.io/agent-control-lab.html)

Agent Control Lab is a browser-based simulation of AI-agent governance and security controls. It models how a synthetic support agent proposes a tool action, how a deterministic policy engine evaluates the assigned role, when human approval is required and what is recorded afterwards.

The project does **not** run a real language model, connect to organisational systems or provide a production security boundary. Its purpose is to make the control logic inspectable.

## What it demonstrates

- Three roles with visibly different permissions
- Five constrained synthetic tools
- Allow, approval-required and deny policy outcomes
- Injection-style and privilege-escalation scenarios
- Stable reason codes for every role/action decision
- Replayable scenarios and reset controls
- Browser-local chronological audit history
- JSON audit export
- A SHA-256 hash chain demonstrating tamper evidence, with each event hashed and linked to the preceding event
- Graceful in-memory fallback when `localStorage` is unavailable
- A complete 15-case role/action policy matrix
- Responsive layout, keyboard access and reduced-motion support
- Automated policy, audit and component tests

## Technology

- React
- TypeScript
- Vite
- Vitest
- React Testing Library
- Browser Web Crypto API
- `localStorage`

## Important limitations

- JSON fixtures, agent identifiers, assigned roles, targets and tool results are synthetic.
- The simulated agent produces predefined structured proposals; there is no LLM or external AI API.
- Client-side rules can be inspected or modified. They model an authorisation boundary within the demonstration but are not a secure server-side enforcement point.
- `localStorage` is browser-local and is not durable, shared or access-controlled audit storage.
- The hash chain can reveal simple changes, but a person controlling the browser can alter the implementation or recalculate the chain. It is not immutable.
- The project is a learning simulation, not a production-ready governance or cybersecurity platform.

## Run locally

```bash
pnpm install
pnpm dev
```

## Verify

```bash
pnpm test
pnpm build
```
