/**
 * Kijazo project discovery: inspect evidence from an authorized Git repository.
 * No external calls, credentials or automatic deployments are performed here.
 * Used by the future onboarding control plane to propose an application manifest.
 */
const has = (files, path) => files.has(path);
const safeParse = text => { try { return JSON.parse(text || '{}'); } catch { return {}; } };
function evidence(framework, confidence, paths) { return { framework, confidence, evidence: paths }; }

export function discoverApplication({ paths = [], files = {}, branches = [], repository } = {}) {
  if (!Array.isArray(paths)) throw Error('paths must be an array');
  const known = new Set(paths.filter(p => typeof p === 'string').slice(0, 5000));
  const packageJson = safeParse(files['package.json']);
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const frontend = [], backend = [], hosts = [];
  const evidencePaths = (...v) => v.filter(p => known.has(p));
  if (deps.next) frontend.push(evidence('nextjs', 'high', evidencePaths('package.json','next.config.js','next.config.mjs','next.config.ts')));
  if (deps.vite || has(known,'vite.config.ts') || has(known,'vite.config.js')) {
    if (deps.react || deps['react-dom']) frontend.push(evidence('react-vite','high',evidencePaths('package.json','vite.config.ts','vite.config.js')));
    else if (deps.vue) frontend.push(evidence('vue-vite','high',evidencePaths('package.json','vite.config.ts','vite.config.js')));
    else if (deps.svelte) frontend.push(evidence('svelte-vite','high',evidencePaths('package.json','vite.config.ts','vite.config.js')));
    else frontend.push(evidence('vite','medium',evidencePaths('package.json','vite.config.ts','vite.config.js')));
  }
  if (deps['@sveltejs/kit']) frontend.push(evidence('sveltekit','high',evidencePaths('package.json')));
  if (deps['@angular/core']) frontend.push(evidence('angular','high',evidencePaths('package.json')));
  const backendFiles = [files['requirements.txt']||'',files['pyproject.toml']||'',files['Pipfile']||''].join('\n').toLowerCase();
  if (has(known,'manage.py') || /\bdjango\b/.test(backendFiles)) backend.push(evidence('django',has(known,'manage.py')?'high':'medium',evidencePaths('manage.py','requirements.txt','pyproject.toml')));
  if (/\bflask\b/.test(backendFiles)) backend.push(evidence('flask','high',evidencePaths('requirements.txt','pyproject.toml')));
  if (/\bfastapi\b/.test(backendFiles)) backend.push(evidence('fastapi','high',evidencePaths('requirements.txt','pyproject.toml')));
  if (deps.express || deps.fastify || deps.nestjs || deps['@nestjs/core']) backend.push(evidence(deps.express?'express':deps.fastify?'fastify':'nestjs','high',evidencePaths('package.json')));
  if (has(known,'netlify.toml') || has(known,'public/_redirects')) hosts.push(evidence('netlify','medium',evidencePaths('netlify.toml','public/_redirects')));
  if (has(known,'wrangler.toml') || has(known,'wrangler.jsonc') || has(known,'wrangler.json') || has(known,'worker/wrangler.toml')) hosts.push(evidence('cloudflare','medium',evidencePaths('wrangler.toml','wrangler.jsonc','wrangler.json','worker/wrangler.toml')));
  if (has(known,'vercel.json')) hosts.push(evidence('vercel','medium',evidencePaths('vercel.json')));
  if (has(known,'Dockerfile') || has(known,'docker-compose.yml') || has(known,'compose.yaml')) hosts.push(evidence('docker','medium',evidencePaths('Dockerfile','docker-compose.yml','compose.yaml')));
  const manifest = {
    schemaVersion: 1,
    name: typeof packageJson.name==='string'?packageJson.name:repository?.split('/').at(-1)||'new-project',
    repository: repository || null,
    detected: { frontend, backend, hosting: hosts },
    environments: {
      production: { branch: null, url: null },
      staging: { branch: null, url: null },
    },
    checks: {
      install: typeof packageJson.scripts?.build==='string'?'npm ci':null,
      build: typeof packageJson.scripts?.build==='string'?'npm run build':null,
      test: typeof packageJson.scripts?.test==='string'?'npm test':null,
    },
    integration: { mode: frontend.length?'sdk':'server-side', status: 'not-installed' },
    reviewRequired: true,
  };
  const branchNames = new Set(branches.filter(v=>typeof v==='string'));
  return {
    manifest,
    branchSuggestions: [...branchNames].filter(v=>['main','master','staging','develop','development'].includes(v)),
    warnings: [
      ...(frontend.length===0?['No supported frontend detected. Kijazo needs a framework adapter or backend-only integration.']:[]),
      ...(hosts.length===0?['Hosting provider not detected from repository files. Link it manually.']:[]),
      'Choose and confirm production/staging branches and host deployment targets before any installation.',
      'No branch, SDK, deployment or production resource has been modified.',
    ],
  };
}
