# Kijazo — Chat-first visual coding for any software

Kijazo is an independent SDK and AI coding API. Install it in **a banking dashboard, CRM, accounting tool, expense app, SaaS platform, e-commerce site, content system, game or portfolio**. The host app is a customer of Kijazo, not the product itself.

## Developer experience

\`\`\`js
import { mountKijazo } from '@kijazo/sdk'

const editor = mountKijazo({
  title: 'Kijazo',
  project: 'my-saas-dashboard',
  apiUrl: 'https://api.kijazo.com',
  enableWhen: 'query-param', // on https://myapp.example/?kijazo=1
})
// Destroy on app unmount: editor.destroy()
\`\`\`

The SDK is pure browser JavaScript with a Shadow DOM overlay; no React-specific code. The host does **not** need to declare editable fields, CSS theme presets or a special site structure.

## What the editor can do

The composer is chat-first. It can attach screenshots via the upload button, **paste an image from the clipboard**, or request a user-approved **browser screen/tab capture**. Click **Mark up** to draw, circle, highlight, point arrows or crop to a relevant region. Click **Select** to pass a target DOM selector, element HTML/text and bounding box. All of that context accompanies a natural-language instruction to the AI service. The visual editing marks are pixels on an attached image: the model can see the annotated region but does not receive full DOM source unless an element is explicitly selected.

Screen capture uses \`getDisplayMedia()\`: browsers require a user gesture and permission. It may capture your entire screen or another tab, depending on what you explicitly select. Always review images from sensitive applications before sending. The capture is not stored in browser storage or sent until you press **Send**. The access key stays in memory during the session.

## AI implementation

\`worker/src/index.mjs\` runs on Cloudflare Workers, with \`OPENAI_API_KEY\` and \`GITHUB_TOKEN\` as encrypted Worker secrets. The API accepts a text instruction, selected DOM context and/or a JPEG screenshot as an image input to an image-capable OpenAI model. It reads/writes repository files through GitHub on a generated \`kijazo/...\` branch and opens a reviewable pull request. Subsequent chat messages in one session continue on that task branch and update its existing PR.

This is **arbitrary frontend code editing**, not a list of preset commands. It is not yet a local build sandbox, browser testing system, live AI preview, or authenticated shared workspace. Repository CI runs after proposed code changes. These are currently engineering limitations, not a scope restriction on Kijazo's eventual product vision.

For multiple apps use the allowlisted \`KIJAZO_PROJECTS\` setting in the Worker, mapping SDK \`project\` values to source repositories. Never accept arbitrary repository names from an untrusted visitor.

## Cloudflare setup

The API is deployed to:
\`https://kijazo-api.mathenge2waweru.workers.dev\`

In Cloudflare Dashboard:
**Workers & Pages → kijazo-api → Settings → Variables and Secrets → Add → Type: Secret**.

Create these three secrets:

| Name | Value |
| --- | --- |
| \`OPENAI_API_KEY\` | Your API project key with access to a vision-capable model |
| \`GITHUB_TOKEN\` | A fine-grained PAT with repository Contents read/write and Pull requests read/write |
| \`KIJAZO_EDITOR_KEY\` | A newly generated 32-byte random secret that you enter through the editor |

Select **Deploy** to apply the changes. Don't put secrets in GitHub, \`wrangler.toml\`, \`.env\` committed to source, or \`VITE_*\` frontend variables.

For nonsecret environment configuration, use **Type: Text**:
- \`KIJAZO_REPO=M-Waweru/worldmwaweru\` for a single-app test, **or**
- \`KIJAZO_PROJECTS={"worldmwaweru":"M-Waweru/worldmwaweru","expense-tool":"your-org/expense-tool-web"}\`
- \`ALLOWED_ORIGINS\` comma-separated website origin allowlist.
- \`OPENAI_MODEL\` a current image-capable model, e.g. \`gpt-4.1-mini\`.

For local development, place the same values in an uncommitted \`worker/.dev.vars\` and use \`npx wrangler dev\`. The \`.dev.vars\` file is gitignored.

**No Cloudflare secret was configured by the SDK repository deployment.** Having an API hostname live is not equivalent to an operational AI workflow.

## Security model

- The editor access key is temporary, shared-owner authentication, **not** individual SaaS-user identity.
- The Worker only allows registered repositories and creates reviewable branches; browser callers never receive GitHub/OpenAI keys.
- Public edit access requires real user sessions, quotas, abuse protection, versioning and publish approval.
- Screenshots of banking, customer or expense applications might contain private data. An operator should inspect and redact before sending to the model provider.
- The SDK does not provide access to the host application's database; only the configured source repository is edited.

## Tests

Run \`npm test\` and \`npm run check\` at the SDK root. GitHub Actions runs these on pushes and pull requests.
