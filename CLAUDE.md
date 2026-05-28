# CLAUDE.md

Guidance for AI assistants working in this repository. See also [AGENTS.md](AGENTS.md) for cloud-agent-specific instructions.

---

## Repository Overview

Remotion is a **React-based framework for programmatic video creation**. It is a large monorepo with 115+ packages managed by [Bun](https://bun.sh) and orchestrated by [Turbo](https://turbo.build).

The current version lives in `packages/core/src/version.ts` (auto-generated on publish). As of this writing it is `4.0.441`. When a new release is needed, increment the patch version by 1.

---

## Setup

```bash
# Requires Bun v1.3.3 — installed at ~/.bun/bin/bun
bun install

# Build all packages (must run before tests or Studio)
bun run build          # alias: bunx turbo run make

# Build a single package
bunx turbo run make --filter='@remotion/<package-name>'
```

Always use `bunx` (not `npx`) to run package binaries.

After `bun install`, **always run `bun run build`** before running tests or starting the Studio — many packages depend on built artifacts from sibling packages.

---

## Key Development Workflows

### Running the dev servers

| Command | Purpose | URL |
|---------|---------|-----|
| `cd packages/example && bun run dev` | Remotion Studio (main video testbed) | http://localhost:3000 |
| `cd packages/player-example && bun run dev` | `@remotion/player` testbed | http://localhost:3001 |
| `cd packages/docs && bun run start` | Docusaurus documentation site | http://localhost:3002 |

The Studio sometimes reports "Already running on port 3000" if a previous instance is still bound. Verify with `curl http://localhost:3000` before assuming failure.

### Rendering test videos (from `packages/example`)

```bash
bunx remotion compositions                              # list compositions
bunx remotion render <comp-id> --output ../../out/video.mp4
bunx remotion still <comp-id> --output ../../out/still.png
```

### Testing

```bash
bunx turbo run test                          # all packages
bunx turbo run test --filter='@remotion/core'  # single package
bun run stylecheck                           # lint + formatting check (run before committing)
```

---

## Before Committing

1. `bun run build` — verify all packages build successfully
2. `bun run stylecheck` — ensures CI passes (runs lint and formatting checks)
3. Include `bun.lock` when dependencies change

The pre-commit hook (`.githooks/pre-commit` → `pre-commit.ts`) auto-detects changed packages, runs `format` on each affected one, and re-stages the formatted files. It is installed via the root `package.json` `prepare` script.

### Pull Request title format

```
`@remotion/<package>`: Short imperative description
```

Example: `` `@remotion/player`: Add loop prop ``

---

## Repository Structure

```
remotion/
├── packages/                  # All 115+ packages
│   ├── core/                  # remotion — core React components & hooks
│   ├── cli/                   # @remotion/cli — the `remotion` CLI
│   ├── renderer/              # @remotion/renderer — Node.js/Bun rendering engine
│   ├── bundler/               # @remotion/bundler — Webpack bundling
│   ├── player/                # @remotion/player — React embed component
│   ├── studio/                # @remotion/studio — Studio APIs
│   ├── studio-server/         # @remotion/studio-server — Studio backend
│   ├── lambda/                # @remotion/lambda — AWS Lambda rendering
│   ├── cloudrun/              # @remotion/cloudrun — Google Cloud Run rendering
│   ├── serverless/            # @remotion/serverless — serverless rendering runtime
│   ├── media-parser/          # @remotion/media-parser — pure-JS video parser
│   ├── webcodecs/             # @remotion/webcodecs — browser-side media conversion
│   ├── three/                 # @remotion/three — React Three Fiber integration
│   ├── skia/                  # @remotion/skia — React Native Skia integration
│   ├── lottie/                # @remotion/lottie — Lottie animation support
│   ├── transitions/           # @remotion/transitions — scene transitions
│   ├── captions/              # @remotion/captions — caption/subtitle primitives
│   ├── google-fonts/          # @remotion/google-fonts — Google Fonts loader
│   ├── compositor/            # Rust binary (and platform-specific variants)
│   ├── example/               # Main dev testbed (private)
│   ├── it-tests/              # Integration tests (private)
│   ├── docs/                  # Docusaurus documentation site
│   ├── template-*/            # Project templates (15+ variants)
│   └── ...                    # Many more utilities, effects, integrations
├── turbo.json                 # Task orchestration (make → test → lint dependency graph)
├── package.json               # Root workspace; defines scripts & dependency catalog
├── tsconfig.json              # Root TS config; references all 68 package tsconfigs
├── .oxfmtrc.json              # oxfmt formatter config (primary formatter)
├── .prettierrc.js             # Prettier config (secondary / MDX)
├── pre-commit.ts              # Pre-commit hook script
├── publish.ts                 # Release/publish automation
├── set-version.ts             # Version bumping script
├── bun.lock                   # Bun lock file (commit when dependencies change)
└── go.work                    # Go workspace (for @remotion/lambda-go)
```

---

## Package Conventions

### Build system

- **`make` script** → compiles TypeScript with `tsgo -d` (generates `dist/` with both CJS and ESM outputs)
- **`bundle.ts`** → Webpack bundle step, present in packages that need a browser bundle
- All packages export from `dist/` — never import from `src/` across package boundaries
- Dual-format packages export CJS (`dist/index.js`) and ESM (`dist/esm/index.mjs`) via the `exports` field

### Versioning

All packages share the same version number. It lives in `packages/core/src/version.ts` and is stamped into every `package.json` at publish time by `set-version.ts` and `publish.ts`.

### Workspace dependencies

Internal packages use `"workspace:*"` as their version specifier in `package.json`. A shared dependency version catalog lives in root `package.json` under `"catalog"`.

### TypeScript

- Root `tsconfig.json` targets ES2018, CommonJS modules, strict mode, `react-jsx`
- Each package has its own `tsconfig.json` that extends `../../tsconfig.json`
- `skipLibCheck: true` at root

### Code style

- **oxfmt** is the primary formatter (single quotes, tabs, no bracket spacing, 80-char width)
- **Prettier** handles `.yml`, `.md`, and `.mdx` (no tabs, 300-char width for Markdown)
- **eslint** per-package; use `@remotion/eslint-config-flat` for ESLint ≥ 9 templates
- No comments unless the WHY is non-obvious
- Template packages (`template-*`) are excluded from oxfmt formatting rules

---

## Turbo Task Dependency Graph

Key dependency relationships (simplified):

```
^make            ← build sibling packages first
make             ← build this package
@remotion/example#bundle  ← needed by renderer tests, SSR tests, lambda tests
@remotion/it-tests#test   ← needed by @remotion/renderer#test
```

Run tasks with Turbo filters to avoid rebuilding the world:

```bash
bunx turbo run make --filter='@remotion/player'
bunx turbo run test --filter='@remotion/media-parser'
bunx turbo run lint --filter='@remotion/core'
```

---

## Known Caveats

- **`@remotion/lambda-go` lint** requires Go ≥ 1.23.0; the VM ships Go 1.22.2, so this package's lint will fail. Non-blocking for core development.
- **`@remotion/openai-whisper` tests** require `OPENAI_API_KEY`. Without it, 1 test fails. Expected and non-blocking.
- **`bun.lock`** (JSON format) must be committed when dependencies change. There is no `bun.lockb` binary lock in this repo.
- **Bun isolated linker** is configured in `bunfig.toml` — this is required; do not change it.

---

## Contributing

Full contribution guide: `packages/docs/docs/contributing/index.mdx`

- [Implementing a new feature](packages/docs/docs/contributing/feature.mdx)
- [Implementing a new option](packages/docs/docs/contributing/option.mdx)
- [Adding documentation](packages/docs/docs/contributing/docs.mdx)
- [Code formatting rules](packages/docs/docs/contributing/formatting.mdx)
