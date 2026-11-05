/**
 * Detects a new host application deployment without navigating away from its page.
 * Works with Vite and other bundlers that reference hashed entrypoint assets in HTML.
 * Does not assume that GitHub checks imply a Netlify/Cloudflare deployment completed.
 */
export function assetSignature(html) {
  if (typeof html !== 'string') return '';
  const found = [];
  for (const tag of html.match(/<(script|link)\b[^>]*>/gi) || []) {
    if (tag.startsWith('<link') && !/\brel\s*=\s*["']?modulepreload/i.test(tag)) continue;
    const src = tag.match(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/i)?.[2] || '';
    if (!src) continue;
    if (/^data:|^blob:/.test(src)) continue;
    found.push(src.replace(/[?#].*$/,''));
  }
  return found.sort().join('|');
}
export function deploymentChanged(before, after) {
  const earlier=assetSignature(before), later=assetSignature(after);
  return Boolean(earlier&&later&&earlier!==later);
}
export async function watchDeployment({ onStatus, onReady, maxAttempts=45, delayMs=3000, fetcher=fetch, pageUrl=location.href, originalHtml=document.documentElement.outerHTML, cancelled=()=>false }) {
  const baseline=originalHtml;
  for(let attempt=0;attempt<maxAttempts;attempt++){
    if(cancelled())return false;
    await new Promise(resolve=>setTimeout(resolve,delayMs));
    if(cancelled())return false;
    try {
      const address=new URL(pageUrl);
      address.searchParams.set('__kijazo_check',String(Date.now()));
      const response=await fetcher(address.toString(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
      if(!response.ok) {onStatus?.('Deployment not serving the page yet; checking again…');continue}
      const html=await response.text();
      if(deploymentChanged(baseline,html)){
        onStatus?.('New production deployment detected. Refreshing your application…');
        onReady?.();
        return true;
      }
      if(attempt===0||attempt%5===4)onStatus?.('Waiting for the updated application assets ('+(attempt+1)+'/'+maxAttempts+')…');
    }catch{onStatus?.('Could not check the deployed application; retrying…')}
  }
  onStatus?.('The merge succeeded but a new deployment could not be confirmed. You can refresh manually after hosting finishes.');
  return false;
}
