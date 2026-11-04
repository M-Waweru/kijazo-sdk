# Kijazo architecture and deployment

Kijazo is separate from the applications it edits.

```text
mwaweru.com --(@kijazo/sdk)--> api.kijazo.com (Cloudflare Worker)
   local visual edits             | server-side AI key
   element selection              | repository access key
   natural-language chat          | GitHub API
                                  v
                       task branch --> generated PR --> CI --> owner merge
```

## Cloudflare first

The API is designed for **Cloudflare Workers**, which can make outbound model/GitHub API requests and stream results. Secrets stay in encrypted bindings. The static product homepage can use Cloudflare Pages at `kijazo.com` and the agent API a Worker Custom Domain at `api.kijazo.com`.

Full code execution is a separate concern. Workers do **not** provide a general local POSIX shell or filesystem. To let an agent run and visually preview arbitrary modified applications, add Cloudflare Sandbox/Containers, or Docker workers on GCP or AWS, as a later component. The agent should never run arbitrary code directly in the API Worker isolate.

## GitHub authorization

Phase 1: fine-grained PAT only on the owner's site repository, as a Cloudflare secret. Temporary editor access key required by the public SDK to submit a request. Agent creates branches and PRs; it cannot directly merge.

Phase 2: a GitHub App. Its private key is stored server-side. Each project maps to an authorized App installation; users sign in through an identity provider. The server obtains short-lived installation tokens and enforces project-specific permissions.

Phase 3: open contribution mode. Anyone may log in and propose edits on independent workspaces after rate-limit and resource-spend checks. Automated merge/publish remains a separate configured policy. Visitors never receive GitHub credentials.

## Limitations of the first agent loop

It has read, list and write-file tools plus a bounded reasoning loop. It can make unconstrained **frontend source edits** within its authorization, but cannot yet run shell commands, install dependencies, run a browser, or test its edits in an isolated container. This is a proof of the model-to-code-to-GitHub flow, not a production-ready AI IDE. Repository CI validates proposed changes after creation.

The Worker enforces an editor key, an allowlisted repository and allowed site origins, while guarding secrets, workflows, lockfile and Git metadata paths. Additional authentication, durable tasks, quotas, audit logs, model-cost controls, branch cleanup and browser previews are required before enabling public agent use.

## Next milestone

Build a job queue + isolated sandbox service (Cloudflare Containers/Sandbox or GCP Cloud Run Jobs) that clones the task branch, launches Vite, runs tests and returns a preview URL and screenshots. Then allow multiple agents per project with separate task branches and a conflict-aware integration step.
