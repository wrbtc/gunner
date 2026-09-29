// Exact release identities for assets changed by the v0.54.89 remesh.
// Keep both sides until the older production identity is retired.
const assets = {
  'egg-shell-a': [
    [817236, '368d9e85c7a710b2edc02d2d5b212d590e4910e2b9cfec50d313a2b6ac85acc2'],
    [323500, '516613a95b3eba0fff77e2e78197cab6becebec7bcb91124517bb963ad6f994c'],
  ],
  'egg-maggot-fieldnotes-v02': [
    [1075680, '344d213134c8fbea68ee9e2f0b24c3031a7bf30c1aee5cde7ee4ca38317bae96'],
    [240068, 'dce9f57242857ebcf84a567a25932278ea1e6454cb3e6aeb2c26bc83a1402d7d'],
  ],
  'dragon-fg-a': [
    [64020728, '38fdb98e6c774ced70feb26041d3d142db292c1a45b160132bc4d0c356b28a27'],
    [3507348, '147cd4e06246c023242d89416f8a684a6bb7b7a31f98964bef43fa7527000e0f'],
  ],
  'rimmer-meshy-v2-rigged': [
    [18054908, 'e39e0226358fad716a20d9ac744c47fe8b7f00cfe958e07fc510ecbe24c97927'],
    [2473592, '1250e767ff6c24e4e932a0ac75236b32434626b0862e67e2a11ef685e8bcb6e1'],
  ],
};

export const isRemeshed = version => {
  const [major, minor, patch] = version.split('.').map(Number);
  return major > 0 || minor > 54 || (minor === 54 && patch >= 89);
};
export function assetIdentity(version, name) {
  const [bytes, sha256] = assets[name][isRemeshed(version) ? 1 : 0];
  return {bytes, sha256};
}
