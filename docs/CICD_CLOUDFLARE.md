# Kijazo API deployment on every push to main

## How it works

`main` → GitHub Actions checks (`npm test`, `npm run check`) → `npx wrangler deploy` from `worker/` → API health check.

Workflow: [`.github/workflows/deploy-api.yml`](../.github/workflows/deploy-api.yml)

The API is deployed to `https://kijazo-api.mathenge2waweru.workers.dev`. This automation is **for the API only**, not the static `kijazo-web` landing page.

## Configure GitHub (required once)

In `M-Waweru/kijazo-sdk`, open **Settings → Secrets and variables → Actions**.

1. Under **Repository secrets**, create `CLOUDFLARE_API_TOKEN`. Generate a dedicated Cloudflare API token with the minimum permissions necessary to edit and deploy Workers in your account. Keep it private.
2. Under **Repository variables**, create `CLOUDFLARE_ACCOUNT_ID` with your Cloudflare account ID from the Cloudflare dashboard. It is a nonsecret identifier.
3. In **Settings → Environments**, create `production` or allow Actions to create it on the first run. Ensure its deployment protection rules do not require approvals if you want automatic deployment on every main push.

If the token is missing, the action fails with an explicit message rather than showing a false successful deployment.

## Configure runtime secrets (required separately)

Go to **Cloudflare → Workers & Pages → kijazo-api → Settings → Variables and Secrets**.

| Binding | Cloudflare type | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Secret | AI service |
| `GITHUB_TOKEN` | Secret | GitHub source editing and pull requests |
| `KIJAZO_EDITOR_KEY` | Secret | Temporary owner editor access |
| `KIJAZO_REPO` | Text | Default repository |
| `ALLOWED_ORIGINS` | Text | Approved browser origins |
| `OPENAI_MODEL` | Text | Model identifier |

**These runtime secrets are independent of the GitHub Actions deployment secret.** Do not put `OPENAI_API_KEY`, `GITHUB_TOKEN` or `KIJAZO_EDITOR_KEY` in GitHub Actions or the source code.

After creating or changing Cloudflare secrets through the dashboard, click **Deploy** to apply the new Worker configuration. Subsequent CI deployments use the Worker configuration in `worker/wrangler.toml`. Do not put actual secret values in `wrangler.toml`.

## Diagnosing the configuration error

The Worker returns `{"error":"Server not configured; set required Cloudflare secrets"}` when one or more of these three bindings is absent: `OPENAI_API_KEY`, `GITHUB_TOKEN`, `KIJAZO_EDITOR_KEY`.

Use the Cloudflare **Variables and Secrets** screen to verify **all three names** are on the production Worker (not just a preview environment), and deploy the changes. The `/health` endpoint confirms the Worker is online, **not** that all three secrets are configured. A real authenticated edit request is needed to verify the full AI → GitHub workflow.

## Why not Cloudflare native Git builds?

The linked Cloudflare account returned a disconnected-Git-connection error when attempting to configure a repository connection through Workers Builds. This GitHub Actions workflow is a reliable alternative once its deployment token is added.
