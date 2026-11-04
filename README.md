# Kijazo SDK

**Kijazo** is a plug-in development environment for existing websites. Users edit page content in place or ask an AI coding agent to change the real application's frontend code.

Built as an **independent project**. The host website installs the SDK rather than owning Kijazo's implementation.

## Repository structure

- `src/browser.mjs` — framework-independent UI, content editing, element selection, chat and live agent events.
- `src/browser.d.ts` — TypeScript declarations.
- `worker/src/index.mjs` — Cloudflare Worker providing the server-side AI/GitHub editing service.
- `worker/wrangler.toml` — Cloudflare deployment configuration.
- `tests/` — smoke tests.
- `docs/ARCHITECTURE.md` — security, product scope, deployment and next milestones.

## Install into a React/Vite website

Install from this repository using npm, pinned to a reviewed commit:

```bash
npm install git+https://github.com/M-Waweru/kijazo-sdk.git
```

After the host mounts, you can use:

```tsx
import { mountKijazo } from '@kijazo/sdk'

const editor = mountKijazo({
  title: 'Kijazo',
  project: 'worldmwaweru',
  apiUrl: import.meta.env.VITE_KIJAZO_API_URL,
  initialContent: { welcomeTitle: 'Hello world' },
  onContentChange: (draft) => {
    // Your own app reacts to edits and renders the updated content.
  },
})
// Cleanup: editor.destroy()
```

Default `enableWhen: 'query-param'` means the editor appears only on URLs with `?kijazo=1`. To enable it on every page use `enableWhen: 'always'`.

The SDK contains **no provider keys**, GitHub tokens or backend credentials.

## Deploy Kijazo API to Cloudflare

Use a Cloudflare account with Workers enabled:

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put KIJAZO_EDITOR_KEY
npx wrangler deploy
```

Edit `worker/wrangler.toml` for your allowlisted website origins, target repository and model. Route the deployed Worker to `api.kijazo.com` inside Cloudflare, then configure the host website with `VITE_KIJAZO_API_URL=https://api.kijazo.com`.

For this initial owner-controlled test, `GITHUB_TOKEN` is a fine-grained GitHub token with **Contents: Read and write** and **Pull requests: Read and write** on **only** the website repository. This token is a temporary bootstrap approach; the long-term design uses a GitHub App with installation-scoped credentials. Do not enter secrets into public repository files or Vite variables.

`KIJAZO_EDITOR_KEY` is a temporary access key typed by the site owner; the SDK keeps it in memory and does not persist it. Do not open this API for anonymous public agents until per-user sessions, abuse controls and spending limits are implemented.

## What works now

- Website overlay with page-element selection and host-driven live content editing.
- Free-form chat requests submitted to the Cloudflare agent endpoint.
- AI tool loop reading and rewriting source files on a new GitHub branch.
- SSE progress updates and a GitHub PR link.
- No need for a dedicated coding server for this GitHub-only phase.

## What does not work yet

- No in-browser live preview of AI-rewritten source before merging; local content edits are immediately visible.
- No sandbox execution of builds, browsers or tests inside the Worker. GitHub CI can run after a PR is opened.
- No public user accounts, anonymous editing, multiplayer sessions, GitHub App authentication, or job persistence.
- No Cloudflare deployment has occurred yet. The Worker requires your Cloudflare credentials and secrets.

## Validate

```bash
npm test
npm run check
```
