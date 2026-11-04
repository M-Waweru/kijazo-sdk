# Deploy Kijazo to Cloudflare

Kijazo uses **two separate Cloudflare services**:

- `kijazo.com` — static public product website, deployed from the `site/` folder on Cloudflare Pages.
- `api.kijazo.com` — API Worker defined under `worker/`; owns AI/GitHub secrets and handles coding requests.

## 1. Product website — Cloudflare Pages

In the Cloudflare dashboard choose **Workers & Pages → Create → Pages → Connect to Git**.

Repository: `M-Waweru/kijazo-sdk`, production branch: `main`.

Set:

- Framework preset: **None**
- Build command: leave blank
- Build output directory: `site`
- Root directory: repository root

Connect the Pages project to the custom domain `kijazo.com`. Cloudflare must be authorized to manage the relevant domain/zone. No API secrets are required for this static website.

## 2. Kijazo agent — Cloudflare Workers

```bash
git clone https://github.com/M-Waweru/kijazo-sdk.git
cd kijazo-sdk/worker
npm install
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put KIJAZO_EDITOR_KEY
npx wrangler deploy
```

In `worker/wrangler.toml` review:

- `KIJAZO_REPO`: currently `M-Waweru/worldmwaweru`.
- `ALLOWED_ORIGINS`: browser domains permitted to submit changes.
- `OPENAI_MODEL`: current model name supported by your OpenAI API account.

In Workers & Pages, select the deployed `kijazo-api` Worker and add **Custom Domains → api.kijazo.com**. A custom domain requires the zone under the appropriate Cloudflare account.

For local development, create `worker/.dev.vars` with the same three secrets. This file is gitignored.

## 3. Connect World Mwaweru

Set the following *public connection URL* in World Mwaweru's website hosting environment and redeploy its frontend:

```env
VITE_KIJAZO_API_URL=https://api.kijazo.com
```

Open the deployed website with `?kijazo=1`. Provide the `KIJAZO_EDITOR_KEY` through the overlay (it remains in browser memory). Submit a request such as "Redesign the About panel with a warm cream background and typographic section headings."

The Worker should stream its read/edit steps and provide the GitHub pull request link. Review the diff and the GitHub CI results, and then merge.

## Scope and limitations

The first iteration is a **GitHub-writing AI agent** on a Cloudflare Worker. It cannot run a shell, execute tests or host live build previews. Builds/tests are delegated to GitHub Actions after the PR exists. The code is not yet deployed in your Cloudflare account, and adding the above secrets requires account-owner action.

The initial secret is a single-owner bootstrap, not public visitor authentication. Don't reuse passwords; use a random, dedicated long access key. For public editing, replace it with project-scoped sessions, per-user quotas, and moderation/approval policies. For multi-file tested previews, add a sandbox runtime and persistent job queue.
