# Contributing

Thanks for your interest in improving the Bedrock Bridge MCP server.

## Development setup

```sh
npm install
```

## Checks

Every change must pass the same gates CI runs:

```sh
npm run typecheck    # strict TypeScript
npm run lint         # ESLint, type-checked rules
npm run format:check # Prettier
npm test             # vitest
npm run build        # emits dist/
```

`npm run format` applies formatting, and `npm run test:watch` runs the tests in watch mode.

## Conventions

- TypeScript, strict mode, ESM. No `any` — prefer `unknown` and narrow.
- Small, focused modules; one responsibility per file. Domain-driven names — no `utils` or
  `helpers` grab-bags.
- Tests exercise behavior, not implementation details.
- Tools live in `src/tools/<domain>-tools.ts` and are exported through `src/tools/index.ts`.
  Most are `defineQueuedTool` (a pass-through to the behavior pack); filesystem and event
  tools use `defineLocalTool`. New tools follow the `mc_<domain>_<action>` naming and ship
  with a `zod` input schema.
- The bridge protocol (`src/protocol/`) is the wire contract with the behavior pack. Change
  it deliberately, and bump `PROTOCOL_VERSION` when you do.

## Pull requests

Keep pull requests focused on a single change. Describe what changed and how you verified it.
