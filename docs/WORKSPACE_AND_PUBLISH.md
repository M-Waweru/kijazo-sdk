# Kijazo: safe workspace preview and in-page publishing

## Current working milestone — GitHub editing

Kijazo embeds a chat/editor in the host application and edits the host's source on a \`kijazo/*\` GitHub branch. The agent proposes a pull request. It **does not yet compile, execute or preview source changes** inside a container.

This release adds *in-page publishing*, independent of the host framework:

1. Kijazo shows a **Publish to live app** action once its agent has opened a PR.
2. The user confirms.
3. The Cloudflare API checks the PR's repository, source branch, target branch, exact head SHA, mergeability and required CI result.
4. The server merges the PR using the authorized GitHub token; a user can never choose an arbitrary repository to merge.
5. The SDK polls the public application HTML and waits for the entrypoint assets to change, then reloads the **same application URL**. It records a transient confirmation in session storage so the refreshed editor can acknowledge success.
6. If the host's deployment cannot be observed after polling, the SDK reports that the merge succeeded but its deployment status is unknown. It offers a manual refresh instead of claiming a deployed site.

No GitHub token is included in the browser. As with AI editing, the owner's Kijazo editor key is required. A **production multi-user SaaS implementation** must replace the shared editor key with user accounts and authorization scoped to a project/role; merging requires an explicitly authenticated owner or publisher.

### API

\`POST /api/publish\`, JSON body \`{"project":"worldmwaweru","prNumber":123,"branch":"kijazo/<task-branch>"}\`.

Requires \`X-Kijazo-Editor-Key\`. The PR target is **always** \`main\` in the server's allowlisted GitHub repository; it does not accept a client-provided repository URL or base branch.

The GitHub token needs Contents read/write, Pull requests read/write, and Checks read for verifying CI. GitHub branch protection and review requirements are respected.

The host application needs a CI workflow running build and tests for PRs. If the checks are missing, pending or failing, Kijazo refuses the merge.

### Deployment detection

Kijazo's browser SDK compares the script and modulepreload asset URLs in the current HTML to a fresh response from the host URL. This detects hashed bundles from Vite and many other build tools. It's not a proof of application correctness, only that a new asset set was deployed.

For apps with non-hashed stable asset paths or deployments that don't change entrypoints, implement a host-specific \`build-id.json\` endpoint or a connector-provided deployment status. A future SDK adapter should accept \`getDeploymentVersion\` to cover those setups.

## Next milestone — one sandbox for each editing session

Use Cloudflare **Sandbox SDK on Cloudflare Containers** for isolated source code execution. The Worker remains the HTTP API and credentials holder; a sandbox holds a checked-out application worktree with no production secrets.

\`\`\`text
Existing host application with Kijazo SDK
      | Chat, visual selection, uploaded references
      v
Cloudflare API Worker
      | Auth + owner approval + task ID
      v
Sandbox registry (Durable Object/DB)
      | One sandbox per editing session (unique ID)
      v
Cloudflare Sandbox SDK / Container (Linux filesystem + tools)
      | Clone authorized repo at fixed base SHA
      | Edit any project files, install dependencies
      | Run typecheck, unit tests and build
      | Start application preview server
      | Stream stdout, stderr, build events, preview URL
      v
Kijazo chat with embedded preview (where embedding is permitted)
      | Iteratively edit, test, continue same branch
      | Publish when owner approves
      v
GitHub branch → PR → CI → approved merge → deploy → same page refresh
\`\`\`

Cloudflare's Sandbox SDK \`@next\` uses process handles rather than returning command results directly. For new sandbox implementations, pin both the Worker package and its Docker image to compatible preview versions, and verify method signatures against the installed SDK types.

Do not simply pass an arbitrary command from a web user into a shared shell. Each workspace needs sandbox isolation, resource budgets, expiry, scoped network access and separate filesystem. Real application credentials (especially banking/payments) must never be exposed in the sandbox. Use demo data and test-mode payments.

### Milestone order

- [x] Agent edits GitHub source and proposes PR
- [x] Human confirmation, CI-gated PR merge, same-page deployment refresh
- [ ] Per-session sandbox boot, repo clone and persistent workspace
- [ ] Run builds/tests and stream failures (including TypeScript, ESLint)
- [ ] Live preview URL and inline iframe panel with safe embedding policy
- [ ] Iterative task state and parallel agent worktrees
- [ ] Restore sessions, resource quotas and cleanup
- [ ] Per-user authentication and granular publisher permissions

**A green GitHub CI run is distinct from an actual Netlify/Cloudflare deployment.** Kijazo should track both before telling the user their application is live.
