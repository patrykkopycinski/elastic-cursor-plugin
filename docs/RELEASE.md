# Release and publishing workflow

**GATE: Do not run `npm publish` or submit to any marketplace without explicit approval.**

This document describes how releases are prepared and published once approval is granted. No publishing is performed by this repo by default.

## Scope

- **Root:** `elastic-cursor-plugin` is `"private": true` and must not be published.
- **Publishable units (when approved):** Individual packages under `packages/` (e.g. `@elastic-cursor-plugin/mcp-server`, `@elastic-cursor-plugin/tools-elasticsearch`, etc.) may be published to npm with scope `@elastic-cursor-plugin`.
- **Distribution channels (when approved):** Cursor marketplace, Claude Code marketplace, npm, Docker (see main README Distribution section).

## Preparing a release (no publish)

1. **Version:** Bump version in root `package.json` and in each package `package.json` as needed (e.g. `npm version patch -ws` or manual).
2. **Build:** From repo root run:
   ```bash
   npm run build
   npm run test
   ```
3. **Produce tarballs (for review or CI):**
   ```bash
   npm pack -w @elastic-cursor-plugin/mcp-server
   # Or from a package directory:
   cd packages/mcp-server && npm pack
   ```
   This creates a `.tgz` that can be inspected or used for installation without publishing.

## Publishing (requires approval)

- **npm:** After approval, configure registry and run `npm publish` from each package directory (or use a workspace-aware publish script). Ensure ` .npmignore` and `package.json` `files` (if used) exclude source and dev-only files.
- **Cursor / Claude marketplace:** Follow each platform’s submission process; do not submit until approval.
- **Docker:** Build and push images only after approval; use the repo Dockerfile and document the image name and registry.

## Checklist before any publish

- [ ] Explicit approval obtained.
- [ ] Versions bumped and changelog/release notes updated.
- [ ] `npm run build` and `npm run test` pass.
- [ ] No secrets or PII in published artifacts (see telemetry privacy tests).
