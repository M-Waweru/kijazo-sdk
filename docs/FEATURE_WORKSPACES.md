# Feature Workspaces: collaborative agentic development without Cursor worktree confusion

## Product principle

In **Cursor (the AI code editor)**, multiple Git worktrees made parallel development possible, but the developer still had to keep track of which local frontend, backend, database and port belonged to which worktree. Worktrees isolate **code**, not application runtime resources.

**Kijazo's unit of work is a Feature Workspace, not a Git worktree, PR, chat, Docker container or localhost port.**

A Feature Workspace contains the request, contributors, agent sessions, repository revisions, isolated runtime, preview, test results, review feedback and publication history.

One app may have dozens of features in progress simultaneously. One feature may involve many repositories, agents and changes.

## User experience

The application dashboard lists features as cards:
- *Donations progress tracking* — Preview ready, 3 services healthy, tests passed, requested by Joanne, last activity 7 minutes ago.
- *Recurring donation schedules* — Building, backend integration test running, draft preview unavailable.
- *Campaign landing redesign* — Review requested, visual comparison ready.

Click a feature to open a **Feature Workspace** with:
1. Conversation and brief; human and agent attribution.
2. A live activity timeline (commands, files edited, tests, migrations, logs).
3. A preview embedded in the same interface with desktop/mobile widths and test credentials.
4. Service status for frontend, backend and isolated database; links to test output and schema/migration changes.
5. Review controls: approve, request changes, publish, rollback. Git PR links appear under technical details, not as the main user journey.

Opening a feature from the installed SDK at \`customer-app.com/editor\` must lead to the **same workspace and history** as opening it in the Kijazo dashboard. Chat stays the primary interaction.

## Isolation and addressing

\`\`\`text
Project: Thenks Impact
  ├── Feature A: donation-progress-001
  │     ├── frontend     :3000 (PRIVATE container network A)
  │     ├── backend      :8000 (PRIVATE container network A)
  │     ├── PostgreSQL   :5432 (PRIVATE container network A)
  │     └── one authenticated preview URL A
  │
  ├── Feature B: recurring-donations-002
  │     ├── frontend     :3000 (PRIVATE container network B)
  │     ├── backend      :8000 (PRIVATE container network B)
  │     ├── PostgreSQL   :5432 (PRIVATE container network B)
  │     └── one authenticated preview URL B
  │
  └── Production (separate environment and credentials)
\`\`\`

Port numbers **can repeat** between isolated networks. Kijazo gives each workspace a unique opaque sandbox ID and authenticated public preview URL; developers must never be shown raw ports unless actively troubleshooting.

The preview router maps \`featureId + serviceName\` to the appropriate internal service. Use one preview origin for browser UI and reverse-proxy \`/api\` to the workspace backend to avoid accidental cross-feature API calls and CORS misconfiguration. If separate origins are necessary, inject per-feature runtime config and explicit allowed origins. Don't share a PostgreSQL instance or volume across features without per-feature database credentials/schema isolation.

The UI must show the **feature name, owner, last updated timestamp, revision and health**, not only a random preview hostname. Preview URLs should be access-controlled, revocable and expired automatically.

## Parallel agents and source changes

All agents for a feature share **one logical feature workspace**, but concurrency must be coordinated:
- An agent gets an isolated working tree/task, and the orchestrator serializes conflicting writes or merges independent patches.
- Each service's code is pinned to a known base SHA; both frontend and backend revisions are recorded.
- A feature changes through snapshots/checkpoints. Human feedback refers to a checkpoint so the preview matches what was tested.
- Distinct features have independent branches, filesystems, databases, ports and runtime secrets; one failing build cannot disturb another feature.
- Keep Git as the underlying version-control system: a feature may create one PR per affected repo, but all PRs belong to **the same feature** and can be reviewed together.

## Staged preview and release

1. **Requested:** description, image, acceptance criteria, feature owner and repositories.
2. **Provisioning:** create isolated sandbox and test-only database; clone pinned frontend/backend refs.
3. **Building:** stream agent tool calls and real file diffs. Support retries and checkpoints.
4. **Testing:** install dependencies; run unit tests, typecheck, integration tests, migration checks and optionally browser smoke tests.
5. **Preview ready:** expose authenticated preview, seed representative **synthetic/redacted** data, run health checks; allow collaborators to test.
6. **Review requested:** collect comments, annotate a screenshot, compare revisions, request another iteration.
7. **Approved:** enforce checks, reviewer access and any release constraints.
8. **Publishing:** create/merge associated PRs in the configured order, apply approved migrations, trigger hosting providers, monitor release health.
9. **Live:** show version/deployment evidence; rollback if health degrades.
10. **Archived:** expire sandbox, revoke access and dispose of test data according to retention policy.

For full-stack changes, the application must be tested at the same frontend/backend/database schema revision set. Releasing a schema migration to production requires a compatible rollout plan and backup/recovery strategy; don't treat moving a test database to production as a safe deployment.

## Platform approach

- **Cloudflare API/Workers:** authentication, project registry, feature management and preview gateway.
- **D1 or Postgres:** durable project, feature, task, release and authorization metadata.
- **Cloudflare Workflows / Durable Objects:** task coordination and exactly one logical owner for workspace orchestration state.
- **Cloudflare Sandbox SDK + Containers:** isolated Linux filesystem/processes, builds/tests, databases or a separately managed ephemeral test DB; compute quotas and TTLs.
- **R2:** screenshots, logs and build artifacts, access scoped to a feature.
- **GitHub App:** repository installation and user-scoped permissions, branches and PRs.
- **Hosting adapters:** Netlify, Cloudflare Pages/Workers and others. Confirm deployed version by provider API/healthchecks.

For the Cloudflare Sandbox 1.0 preview SDK, use the exact matching \`@cloudflare/sandbox@next\` package/image and verify its API signatures before implementation. Preview URLs may use authenticated Workers routing or Cloudflare Sandbox tunnels. Cloudflare's older SDK port exposure APIs should not be copied into a new 1.0 implementation without checking compatibility.

## What exists versus what still needs building

**Exists:** Kijazo browser chat/visual context, GitHub-backed code editing, PR creation, CI-gated in-editor publish and refresh; read-only repo discovery and access policy foundations.

**Added in this design PR:** a pure Feature Workspace manifest, collision-free namespace identity, service topology, state transition validation and unit tests. These are not deployed sandboxes.

**Not implemented yet:** real container allocation, backend/DB boot, previews, persistent feature registry, concurrent agent patch coordination, resource cleanup, authentication/quotas, and cross-repo release orchestration.

**Recommended next implementation:** one full-stack Feature Workspace for Thenks Impact, with one React/Vite frontend, one Django API, an isolated Postgres test DB, one authenticated preview and a build/test/feedback loop. Prove two such features can run simultaneously with identical internal service port numbers without collisions.

This addresses the specific coordination problem experienced in Cursor without requiring teams to abandon Git.
