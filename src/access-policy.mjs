/**
 * Authorization policy for the future GitHub App integration.
 * Input must come from GitHub's VERIFIED API response, never a claimed user role.
 *
 * A repository contributor role alone does not grant permission to deploy.
 * The Kijazo project must also be installed/authorized, and publisher access
 * must be separately granted.
 */
const LEVEL={none:0,read:1,triage:1,write:2,maintain:3,admin:4};
export function authorizeProject({
  authenticated=false,
  appInstalled=false,
  repositoryAccessible=false,
  githubPermission='none',
  projectRole='member',
  allowedActions=[],
}={}) {
  const level=LEVEL[githubPermission]??0;
  const connected=Boolean(authenticated&&appInstalled&&repositoryAccessible&&level>=1);
  const canView=connected;
  const canEdit=connected&&level>=2&&['member','maintainer','owner'].includes(projectRole);
  const canReview=canEdit&&level>=3&&['maintainer','owner'].includes(projectRole);
  // Explicit project policy AND repository authority are both required.
  const canPublish=canReview&&level>=4&&allowedActions.includes('publish');
  return {
    canView,
    canEdit,
    canReview,
    canPublish,
    reason:!authenticated?'sign-in-required':!appInstalled?'app-install-required':!repositoryAccessible?'repository-not-authorized':level<1?'no-repository-access':'ok',
  };
}
