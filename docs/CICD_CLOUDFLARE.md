# Kijazo API continuous deployment

Cloudflare Workers Builds is the **single deployment pipeline** for the API. The connected GitHub repository is `M-Waweru/kijazo-sdk`. Pushes to `main` trigger a Cloudflare build and deploy; the separate GitHub `SDK checks` workflow also runs tests, but does **not** deploy.

## Cloudflare build settings

Open Cloudflare → Workers & Pages → `kijazo-api` → Settings → Builds.

- Repository: `M-Waweru/kijazo-sdk`
- Branch: `main`
- Root directory: `/`
- Build command: `npm test && npm run check`
- Deploy command: `cd worker && npm install --no-audit --no-fund && npx wrangler deploy`
- Worker name in `worker/wrangler.toml`: `kijazo-api`

The repository has its SDK, Worker, and website in separate directories. Running `npm run build` at the repository root is **incorrect**: the root package has no build script.

The Cloudflare Builds trigger was created using a previously existing Cloudflare build token. If deployment fails with a permission or authentication error, assign a dedicated Workers deployment token to this trigger in the Cloudflare dashboard.

## Secrets

The Worker runtime secrets are managed **only in Cloudflare**, not GitHub Actions:

| Binding | Type |
| --- | --- |
| `OPENAI_API_KEY` | Secret |
| `GITHUB_TOKEN` | Secret |
| `KIJAZO_EDITOR_KEY` | Secret |
| `KIJAZO_REPO` | Variable |
| `ALLOWED_ORIGINS` | Variable |
| `OPENAI_MODEL` | Variable |

Cloudflare → Workers & Pages → `kijazo-api` → Settings → Variables and Secrets.

Never commit secret values to source control or put them in `wrangler.toml`. Wrangler preserves existing secret bindings during deployment. For dashboard-managed plain-text settings, keep the values synchronized with `worker/wrangler.toml` to avoid overwrites.

## Verification

After a push to `main`, check **Cloudflare → kijazo-api → Deployments/Builds** and confirm the build, deploy and production health endpoint succeed.

Health endpoint: https://kijazo-api.mathenge2waweru.workers.dev/health

A working health endpoint does not prove model or GitHub authorization. Test the actual editor request separately.

## Troubleshooting

- `Server not configured; set required Cloudflare secrets`: at least one runtime secret is absent from the deployed Worker.
- `npm run build` missing: change the build command to `npm test && npm run check` at repository root.
- `wrangler.toml` not found: deploy from the `worker/` directory.
- Git account disconnected: reconnect the GitHub repository under the Worker's Builds settings.
- Deployment permission denied: review the Build Token configured in Cloudflare Builds.
