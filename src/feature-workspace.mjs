/**
 * Core identifiers and lifecycle policy for Feature Workspaces.
 *
 * This module describes orchestration intent; it never creates a container,
 * clones a repository or exposes production credentials by itself.
 */
const STATES = Object.freeze([
  'requested','queued','provisioning','building','testing',
  'preview_ready','review_requested','approved','publishing',
  'live','failed','cancelled','archived'
]);
const NEXT = Object.freeze({
  requested: ['queued','cancelled'],
  queued: ['provisioning','cancelled','failed'],
  provisioning: ['building','failed','cancelled'],
  building: ['testing','failed','cancelled'],
  testing: ['preview_ready','building','failed','cancelled'],
  preview_ready: ['building','review_requested','cancelled','archived'],
  review_requested: ['building','approved','cancelled'],
  approved: ['building','publishing','cancelled'],
  publishing: ['live','failed'],
  live: ['archived'],
  failed: ['queued','cancelled','archived'],
  cancelled: ['archived'],
  archived: []
});
const isId = value => typeof value==='string' && /^[a-z0-9][a-z0-9-]{0,62}$/.test(value);
const assertId = (value,name) => {if(!isId(value))throw new TypeError(name+' must be a lowercase slug (letters, numbers, hyphens)');};
export function workspaceNamespace(projectId, featureId) {
  assertId(projectId,'projectId');assertId(featureId,'featureId');
  return 'kj--'+projectId+'--'+featureId;
}
export function createFeatureWorkspace({projectId,featureId,title,requestedBy,baseRefs={},services=[]}) {
  const namespace=workspaceNamespace(projectId,featureId);
  if(typeof title!=='string'||!title.trim())throw new TypeError('Feature title is required');
  if(typeof requestedBy!=='string'||!requestedBy.trim())throw new TypeError('requester is required');
  if(!Array.isArray(services)||!services.every(s=>s&&typeof s.name==='string'&&isId(s.name)&&Number.isInteger(s.internalPort)&&s.internalPort>=1&&s.internalPort<=65535))
    throw new TypeError('Each service needs a name and an internal TCP port');
  if(new Set(services.map(s=>s.name)).size!==services.length)throw new TypeError('Service names must be unique per workspace');
  if(!baseRefs||typeof baseRefs!=='object'||Object.values(baseRefs).some(x=>typeof x!=='string'||!x.trim()))throw new TypeError('Invalid pinned repository refs');
  return {
    id:featureId,
    projectId,
    namespace,
    title:title.trim(),
    requestedBy,
    state:'requested',
    baseRefs:{...baseRefs},
    // Services communicate only inside this workspace's private network.
    // Port 3000 / 8000 / 5432 can be reused by different features safely.
    services:services.map(s=>({
      name:s.name,internalPort:s.internalPort,
      internalHost:s.name+'.internal',
      previewUrl:null,health:'not_started',
    })),
    database:{mode:'isolated-test-data',productionConnectionAllowed:false},
    preview:{state:'not_provisioned',url:null,expiresAt:null},
    artifacts:{logs:[],screenshots:[],testResults:[]},
    git:{branches:{},pullRequests:[]},
  };
}
export function transitionWorkspace(workspace,to,{actor,reason}={}) {
  if(!workspace||typeof workspace!=='object'||!STATES.includes(workspace.state))throw new TypeError('Unknown workspace state');
  if(!STATES.includes(to)||!NEXT[workspace.state].includes(to))throw new Error('Invalid transition '+workspace.state+' → '+to);
  if(typeof actor!=='string'||!actor.trim())throw new TypeError('Every state transition needs an actor');
  return {...workspace,state:to,lastTransition:{from:workspace.state,to,actor,reason:typeof reason==='string'?reason:null}};
}
export function featureSummary(workspace) {
  return {
    featureId:workspace.id,
    projectId:workspace.projectId,
    title:workspace.title,
    state:workspace.state,
    previewReady:workspace.state==='preview_ready'||workspace.state==='review_requested'||workspace.state==='approved',
    previewUrl:workspace.preview?.url||null,
    services:workspace.services.map(s=>({name:s.name,health:s.health})),
  };
}
