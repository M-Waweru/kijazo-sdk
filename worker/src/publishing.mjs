/**
 * Owner-approved publication of a Kijazo-generated pull request.
 * Never takes a repository URL or branch from the client as an authority.
 * All repository access remains server-side.
 */
const githubHeaders = env => ({
  Accept: 'application/vnd.github+json',
  Authorization: 'Bearer ' + env.GITHUB_TOKEN,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'Kijazo-Publisher',
  'Content-Type': 'application/json',
});

function allowedRepository(env, project) {
  let projects = {};
  if (env.KIJAZO_PROJECTS) {
    try { projects = JSON.parse(env.KIJAZO_PROJECTS); }
    catch { throw new PublishError(500, 'Invalid KIJAZO_PROJECTS server configuration.'); }
  }
  if (!project || typeof project !== 'string' || project.length > 120) {
    throw new PublishError(400, 'Invalid project identifier.');
  }
  const repo = Object.keys(projects).length ? projects[project] : env.KIJAZO_REPO;
  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new PublishError(403, 'This project has not been authorized for publication.');
  }
  return repo;
}

export class PublishError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'PublishError';
    this.status = status;
  }
}

async function github(env, repo, path, options={}) {
  const response = await fetch('https://api.github.com/repos/' + repo + path, {
    ...options, headers: {...githubHeaders(env), ...options.headers},
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) throw new PublishError(404, 'GitHub cannot find the pull request or the token cannot access this repository.');
    if (response.status === 401) throw new PublishError(401, 'The GitHub token has expired or is invalid.');
    if (response.status === 403) throw new PublishError(403, 'GitHub denied this operation. Check Contents, Pull requests, and Checks read permissions, as well as branch protection.');
    throw new PublishError(response.status, 'GitHub declined publication: ' + String(result.message||response.status).slice(0,180));
  }
  return result;
}

export async function publishPullRequest(env, input) {
  if (!env.GITHUB_TOKEN) throw new PublishError(503, 'The GitHub token is not configured.');
  if (!input || typeof input !== 'object') throw new PublishError(400, 'Expected a publication request.');
  const repository = allowedRepository(env, input.project);
  const number = Number(input.prNumber);
  if (!Number.isSafeInteger(number) || number < 1) throw new PublishError(400, 'A valid pull request number is required.');
  const pr = await github(env, repository, '/pulls/' + number);
  const head = pr.head?.ref;
  if (pr.state !== 'open' || pr.merged || pr.draft) throw new PublishError(409, 'This pull request is closed, merged, or still in draft.');
  if (pr.base?.ref !== 'main' || pr.base?.repo?.full_name !== repository) {
    throw new PublishError(403, 'Only PRs targeting the authorized main branch can be published.');
  }
  if (pr.head?.repo?.full_name !== repository || !/^kijazo\/[0-9]+-[0-9a-f]{8}$/.test(head||'')) {
    throw new PublishError(403, 'Only Kijazo-created branches in the authorized repository may be published.');
  }
  if (input.branch && input.branch !== head) throw new PublishError(409, 'The selected PR no longer matches this editing session.');
  const sha = pr.head?.sha;
  if (!/^[0-9a-f]{40}$/.test(sha||'')) throw new PublishError(409, 'GitHub did not return a stable PR commit to publish.');

  // Never merge source changes with pending or failing automated checks.
  const checks = await github(env, repository, '/commits/' + sha + '/check-runs?per_page=100');
  if (!Array.isArray(checks.check_runs) || checks.check_runs.length === 0) {
    throw new PublishError(409, 'No GitHub CI checks found for this change. Configure a build/test workflow before publishing.');
  }
  const notPassing = checks.check_runs.filter(c => c.status !== 'completed' || !['success','neutral','skipped'].includes(c.conclusion));
  if (notPassing.length) {
    const description = notPassing.slice(0,4).map(c => c.name + ' (' + (c.conclusion||c.status||'pending') + ')').join(', ');
    throw new PublishError(409, 'This PR is not yet ready for publication: ' + description);
  }
  if (pr.mergeable !== true || ['dirty','blocked','behind','draft','unknown'].includes(pr.mergeable_state||'')) {
    throw new PublishError(409, 'The PR is not mergeable yet. Check for conflicts or required approvals on GitHub.');
  }
  // Head SHA is passed to GitHub: a concurrent change to the PR cannot be silently merged.
  const merged = await github(env, repository, '/pulls/' + number + '/merge', {
    method: 'PUT',
    body: JSON.stringify({ merge_method: 'squash', sha, commit_title: 'Kijazo: publish ' + String(pr.title||'changes').slice(0,90) }),
  });
  if (!merged.merged || !/^[0-9a-f]{40}$/.test(merged.sha||'')) {
    throw new PublishError(502, 'GitHub did not confirm a successful merge.');
  }
  return {
    ok: true,
    repository,
    prNumber: number,
    prUrl: pr.html_url,
    mergeCommit: merged.sha,
    message: 'PR #' + number + ' merged. Waiting for the host application to deploy.',
  };
}
