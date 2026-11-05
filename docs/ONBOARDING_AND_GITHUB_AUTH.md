# Kijazo: application onboarding and GitHub-based identity

## Product goal

Kijazo is the software development and lifecycle platform for **existing applications**. Users should think in terms of features, not branches, IDE commands or deployments.

Two surfaces share the same projects, features, permissions, previews and deployment history:

1. **\`app.kijazo.com\`**: sign in, connect repositories, register production/staging environments, inspect active features, preview changes and monitor releases.
2. **\`customer-app.com/editor\`**: SDK embedded into that application; GitHub sign-in grants project-scoped editing, chat/snips/attachments generate features; review and publish without leaving the host app.

\`/editor\` is a proposed host-app integration convention, **not yet an installed production route**. The SDK currently activates on \`?kijazo=1\`. A framework adapter must install/route \`/editor\` without accidentally changing the app's original routing.

## Identity and GitHub integration

Implement Kijazo as a **GitHub App** with user-to-server authorization and selected-repository installation.

\`\`\`text
Visit app.kijazo.com or customer-app.com/editor
   → Continue with GitHub
   → GitHub App OAuth authorization (state, PKCE if supported)
   → Cloudflare API exchanges code, stores encrypted user token server-side
   → Kijazo creates HttpOnly Secure SameSite session cookie
   → User selects organization and GitHub repository
   → GitHub App installed/approved for that repository
   → Server checks BOTH the GitHub user and App installation can access it
   → Server reads effective collaborator permission (read/write/maintain/admin)
   → Project membership and explicit publisher policy determine allowed actions
   → Chat/build/test/publish permissions available in both dashboard and editor
\`\`\`

Use \`GET /user\` for identity, GitHub App user installation/repositories APIs for available projects, and \`GET /repos/{owner}/{repo}/collaborators/{username}/permission\` (with appropriately authorized app identity) to inspect repository permission where needed. Do not derive authority from whether the user has **ever committed** to a repository: a past contributor may have no current permission. Likewise, the host app's public visitor account does not automatically grant coding rights.

No browser-provided username, repo name or role is trusted. API checks are performed server-side **on every sensitive operation** with a project authorization policy, not only on login. Read access is not equivalent to permission to edit; code write access is not equivalent to permission to merge. Revalidate access periodically and on GitHub App installation/uninstallation, user authorization revoked, or repository permission changes.

**Role model**:

| GitHub permission | Kijazo role / capabilities |
| --- | --- |
| Read | View application, feature requests, builds, permitted previews |
| Write | Edit source in sandbox, submit AI coding tasks, propose PR |
| Maintain | Review/approve within project's policy |
| Admin | May become publisher, **only** if the project explicitly authorizes production publication |

Project security also needs explicit tenant membership, app installation authorization, and per-environment access. Protected branches, CI and approvals remain enforced.

App installation tokens are obtained server-side to clone/create branches/PRs **after authorization**. User access tokens can be used for operations performed on the user's behalf. Do not send either token to the browser or into an untrusted sandbox; use narrowly scoped short-lived credentials or a controlled broker.

The current \`KIJAZO_EDITOR_KEY\` is an owner-only MVP bootstrap. It must be retired when the first signed-in dashboard and verified session flow are ready. It is **not** suitable for publicly accessible multi-tenant editing.

## Repository onboarding

When a user connects a repository, do discovery **read-only**:

- Inspect file tree and supported manifests (\`package.json\`, \`requirements.txt\`, \`manage.py\`, \`wrangler.toml\`, \`netlify.toml\`, \`Dockerfile\`, GitHub Actions).
- Identify likely frontend, backend, framework, scripts, hosting provider, databases and relationships between multiple repositories.
- Inspect available branches but **ask the user to confirm** production/staging branches and deployment target. Do not assume \`main\` is production or \`staging\` exists.
- Save an application manifest in a Kijazo control-plane database (D1 or PostgreSQL). Store projectId, GitHub installation ID, owner/repo, base SHA, branch environments, framework adapters, CI commands, hosting connections, preview policy, allowed owners and publishers.
- Propose an SDK installation PR for compatible frontend frameworks. Backend-only repositories get a server-side integration; don't attempt to insert a browser SDK into Python/Django.
- On owner approval, merge the installation PR, verify deployment, and show \`yourapp.com/editor\` ready.
- Detect hosting providers but **connect** Netlify, Cloudflare, etc through each provider's permissions. GitHub repo access by itself does not grant hosting deployment access.

\`src/discovery.mjs\` is the first read-only framework/hosting detector. It does **not** install packages, create PRs or deploy.

## Feature execution lifecycle

\`\`\`text
feature_requested
 → requirements_confirmed
 → sandbox_queued
 → sandbox_running (isolated clone of pinned SHA)
 → editing (live file/tool/terminal events)
 → checks_running
 → preview_ready (test-only database & credentials)
 → review_requested
 → approved
 → PR_created / merged
 → deploying
 → production_verified
 → completed
\`\`\`

Failures preserve logs and rollback options. The user sees feature statuses, screenshots, test summaries, database/schema changes and live URLs rather than a list of Git operations.

Recommended infrastructure:
- Cloudflare Worker for authenticated API, GitHub App OAuth callbacks and provider webhooks.
- D1 for users/projects/features, permissions, deployments and activity summaries (or existing PostgreSQL through Hyperdrive).
- Durable Objects and Workflows for per-session coordination, reproducible long-running tasks and state transitions.
- Cloudflare Sandbox SDK + Containers for isolated filesystem, shell, test runners and preview servers (one workspace per task). No production credentials or production database allowed.
- R2 for user attachments, screenshots, logs and artifacts, with tenant-level access control and retention limits.
- Hosting adapters for Netlify/Cloudflare/others to initiate builds and confirm actual deployment health rather than infer success from GitHub PR merge.

Build preview replicas with **synthetic/sanitized data**, same schema, migrations and representative flows. Avoid copying sensitive production banking/customer data; integration tests use sandbox payment credentials. Preview and production have distinct secrets and resources.

## Initial MVP and implementation order

1. **Read-only onboarding**: GitHub App authorization + repository listing + framework discovery and user-confirmed branch/hosting mapping. No auto install until explicit approval.
2. **SDK installation PR**: one-click install for React/Vite first, then Next.js/Vue, with a \`/editor\` adapter. Verified user sessions replace shared editor keys.
3. **Cloudflare Sandbox per feature**: clone/edit/build/test, preview with test credentials and scoped resources.
4. **Feature tracking and in-page review**: task timeline, test/build logs, screenshot diffs, reusable instructions and environment changes.
5. **Hosting integrations**: Netlify and Cloudflare deployment verification, staged rollout, release health and rollback.
6. **Full-stack apps and parallel agents**: frontend/backend and migrations, test DB clones, safe coordination across multiple repositories.

## What exists today vs proposed

**Existing**: standalone browser SDK; screenshot/chat/annotation; owner-key-protected Cloudflare AI Worker; GitHub branch/PR edits; CI-gated in-page merge and asset-based refresh; native Cloudflare main deploy.

**New in this PR**: pure read-only framework/hosting detection and an authorization policy module with tests; architecture for GitHub sign-in and multi-app onboarding.

**Not yet implemented**: GitHub OAuth callback, GitHub App registration, authenticated login/session storage, repo-onboarding UI, persistence, \`/editor\` integration, automated SDK installation, sandbox execution, backend previews, staging databases, actual deployment provider connectors and tenant billing. These require dedicated implementation stages and real provider credentials.
