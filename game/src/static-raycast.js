import * as THREE from '../vendor/three.module.js?v=052';
let activeController = false;

// Static terrain broad phase only. Three retains the exact intersection math,
// world/instance transforms, material side, normals, UVs and original face IDs.
// A geometry-local hierarchy encloses whole triangles at every level, so large
// transformed cliff instances cannot collapse into an ineffective world cell.
export function createStaticRaycast(meshes = []) {
  if (activeController) throw new Error('Only one static raycast controller may be active; dispose it before replacing it.');
  activeController = true;
  const originalMeshRaycast = THREE.Mesh.prototype.raycast;
  const originalInstanceRaycast = THREE.InstancedMesh.prototype.raycast;
  const originalCompute = THREE.Mesh.prototype._computeIntersections;
  let trees = new WeakMap(), registered = new Set(), disposed = false, enabled = true;
  const instanceVersions = new WeakMap();
  let bypassDepth = 0;
  const dynamic = mesh => mesh.isSkinnedMesh || mesh.userData?.dynamicCollision || mesh.geometry?.userData?.dynamicCollision || mesh.geometry?.morphAttributes?.position?.length;
  const counts = { geometries: 0, triangles: 0, builds: 0, queries: 0, candidateTriangles: 0, bruteTriangles: 0, fallbacks: 0, buildMsTotal: 0, lastBuildMs: 0, rebuildMsTotal: 0, lastRebuildMs: 0 };
  const eligible = mesh => mesh?.isMesh && !mesh.isSkinnedMesh && !mesh.userData?.dynamicCollision &&
    !mesh.geometry?.userData?.dynamicCollision && !mesh.geometry?.morphAttributes?.position?.length;
  function build(geometry) {
    const buildStart = performance.now(); let nodeCount = 0;
    const position = geometry.attributes.position, index = geometry.index;
    if (!position || position.itemSize < 3) return null;
    const count = index ? index.count : position.count;
    if (count % 3) {
      // A valid drawRange may occupy only the complete triangles of a buffer.
      // Retain a versioned native-fallback entry so shared instances also notice
      // the changed geometry and refresh their aggregate bounds.
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const fallback = { unsupported: true, position, positionVersion: position.version ?? position.data?.version,
        index, indexVersion: index?.version ?? index?.data?.version, count, triangles: 0, nodes: 0, estimatedRetainedNumericBytes: 0 };
      trees.set(geometry, fallback); counts.builds++; counts.lastBuildMs = performance.now() - buildStart; counts.buildMsTotal += counts.lastBuildMs;
      return fallback;
    }
    const n = count / 3, bounds = new Float64Array(n * 6), centers = new Float64Array(n * 3);
    for (let t = 0; t < n; t++) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let j = 0; j < 3; j++) {
        const v = index ? index.getX(t * 3 + j) : t * 3 + j;
        const values = [position.getX(v), position.getY(v), position.getZ(v)];
        for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], values[a]); hi[a] = Math.max(hi[a], values[a]); }
      }
      for (let a = 0; a < 3; a++) { bounds[t * 6 + a] = lo[a]; bounds[t * 6 + a + 3] = hi[a]; centers[t * 3 + a] = (lo[a] + hi[a]) * .5; }
    }
    function node(ids) {
      nodeCount++;
      const box = new THREE.Box3();
      for (const t of ids) {
        box.min.x = Math.min(box.min.x, bounds[t * 6]); box.min.y = Math.min(box.min.y, bounds[t * 6 + 1]); box.min.z = Math.min(box.min.z, bounds[t * 6 + 2]);
        box.max.x = Math.max(box.max.x, bounds[t * 6 + 3]); box.max.y = Math.max(box.max.y, bounds[t * 6 + 4]); box.max.z = Math.max(box.max.z, bounds[t * 6 + 5]);
      }
      // Tiny expansion protects exact seam/tangent candidates from box rounding.
      box.expandByScalar(1e-8);
      if (ids.length <= 24) return { box, ids };
      const extent = box.getSize(new THREE.Vector3()), axis = extent.x >= extent.y && extent.x >= extent.z ? 0 : extent.y >= extent.z ? 1 : 2;
      ids.sort((a, b) => centers[a * 3 + axis] - centers[b * 3 + axis] || a - b);
      const mid = ids.length >> 1;
      return { box, left: node(ids.slice(0, mid)), right: node(ids.slice(mid)) };
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const tree = { root: n ? node(Array.from({ length: n }, (_, i) => i)) : null,
      position, positionVersion: position.version ?? position.data?.version, index, indexVersion: index?.version ?? index?.data?.version, count, triangles: n };
    tree.nodes = nodeCount;
    // Numeric payload estimate only: six bounds numbers/node and triangle IDs.
    // Excludes JS object/array overhead, engine metadata and shared geometry.
    tree.estimatedRetainedNumericBytes = nodeCount * 6 * 8 + n * 8;
    trees.set(geometry, tree); counts.builds++; counts.lastBuildMs = performance.now() - buildStart; counts.buildMsTotal += counts.lastBuildMs;
    return tree;
  }
  function ensure(geometry) {
    let tree = trees.get(geometry); if (!tree) return null;
    const p = geometry.attributes.position, idx = geometry.index;
    if (tree.position !== p || tree.positionVersion !== (p.version ?? p.data?.version) || tree.index !== idx || tree.indexVersion !== (idx?.version ?? idx?.data?.version) || tree.count !== (idx ? idx.count : p.count)) tree = build(geometry);
    return tree;
  }
  function meshRaycast(raycaster, intersects) {
    if (bypassDepth || dynamic(this)) { bypassDepth++; try { return originalMeshRaycast.call(this, raycaster, intersects); } finally { bypassDepth--; } }
    if (enabled && trees.has(this.geometry)) ensure(this.geometry); // Refresh bounds before Three's broad-phase test.
    return originalMeshRaycast.call(this, raycaster, intersects);
  }
  function instanceRaycast(raycaster, intersects) {
    if (bypassDepth || dynamic(this)) { bypassDepth++; try { return originalInstanceRaycast.call(this, raycaster, intersects); } finally { bypassDepth--; } }
    if (enabled && trees.has(this.geometry)) {
      const prior = trees.get(this.geometry), tree = ensure(this.geometry), v = instanceVersions.get(this);
      if (prior !== tree || !v || v.tree !== tree || v.version !== this.instanceMatrix.version || v.count !== this.count) {
        this.computeBoundingBox(); this.computeBoundingSphere();
        instanceVersions.set(this, { tree, version: this.instanceMatrix.version, count: this.count });
      }
    }
    return originalInstanceRaycast.call(this, raycaster, intersects);
  }
  function compute(raycaster, intersects, ray) {
    const g = this.geometry, tree = trees.get(g), range = g.drawRange, groups = g.groups;
    // Unusual partial primitive ranges retain the untouched Three implementation.
    if (bypassDepth || !enabled || !tree || tree.unsupported || this.isSkinnedMesh || this.morphTargetInfluences?.some(v => v !== 0) || range.start % 3 || Number.isFinite(range.count) && range.count % 3 ||
        Array.isArray(this.material) && groups.some(a => a.start % 3 || a.count % 3)) {
      if (tree) counts.fallbacks++;
      return originalCompute.call(this, raycaster, intersects, ray);
    }
    const candidates = [], stack = tree.root ? [tree.root] : [];
    while (stack.length) { const n = stack.pop(); if (!ray.intersectsBox(n.box)) continue; if (n.ids) candidates.push(...n.ids); else stack.push(n.right, n.left); }
    candidates.sort((a, b) => a - b); counts.queries++; counts.candidateTriangles += candidates.length; counts.bruteTriangles += tree.triangles;
    const savedStart = range.start, savedCount = range.count;
    function process(group = null) {
      const low = Math.max(0, savedStart, group ? group.start : 0), high = Math.min(tree.count, savedStart + savedCount, group ? group.start + group.count : Infinity);
      let first = -1, last = -1;
      function flush() { if (first < 0) return; range.start = first * 3; range.count = (last - first + 1) * 3; originalCompute.call(thisMesh, raycaster, intersects, ray); first = -1; }
      for (const t of candidates) { if (t * 3 < low || t * 3 >= high) continue; if (first >= 0 && t !== last + 1) flush(); if (first < 0) first = t; last = t; }
      flush();
    }
    const thisMesh = this;
    try {
      if (Array.isArray(this.material)) {
        // Original group order is retained even with overlapping material groups.
        for (const group of groups) { g.groups = [group]; process(group); }
      } else process();
    } finally { range.start = savedStart; range.count = savedCount; g.groups = groups; }
  }
  THREE.Mesh.prototype.raycast = meshRaycast;
  THREE.InstancedMesh.prototype.raycast = instanceRaycast;
  THREE.Mesh.prototype._computeIntersections = compute;
  function rebuild(next = [...registered]) {
    if (disposed) return;
    const rebuildStart = performance.now();
    registered = new Set(next.filter(eligible)); trees = new WeakMap();
    const seen = new Set(); counts.geometries = counts.triangles = 0;
    for (const mesh of registered) {
      const g = mesh.geometry; if (!seen.has(g)) { const tree = build(g); seen.add(g); if (tree) { counts.geometries++; counts.triangles += tree.triangles; } }
      // Instance transforms/count may have been cleared without a version bump;
      // an explicit world-collision rebuild always refreshes their aggregate bounds.
      if (mesh.isInstancedMesh) { mesh.computeBoundingBox(); mesh.computeBoundingSphere(); instanceVersions.set(mesh, { tree: trees.get(g), version: mesh.instanceMatrix.version, count: mesh.count }); }
    }
    counts.lastRebuildMs = performance.now() - rebuildStart; counts.rebuildMsTotal += counts.lastRebuildMs;
  }
  function dispose() {
    if (disposed) return; disposed = true; activeController = false;
    if (THREE.Mesh.prototype.raycast === meshRaycast) THREE.Mesh.prototype.raycast = originalMeshRaycast;
    if (THREE.InstancedMesh.prototype.raycast === instanceRaycast) THREE.InstancedMesh.prototype.raycast = originalInstanceRaycast;
    if (THREE.Mesh.prototype._computeIntersections === compute) THREE.Mesh.prototype._computeIntersections = originalCompute;
    trees = new WeakMap(); registered.clear();
  }
  try { rebuild(meshes); } catch (error) { dispose(); throw error; }
  function stats() {
    let nodes = 0, estimatedRetainedNumericBytes = 0;
    const seen = new Set();
    for (const mesh of registered) if (!seen.has(mesh.geometry)) { seen.add(mesh.geometry); const t = trees.get(mesh.geometry); if (t) { nodes += t.nodes; estimatedRetainedNumericBytes += t.estimatedRetainedNumericBytes; } }
    return { ...counts, meshes: registered.size, nodes, estimatedRetainedNumericBytes,
      memoryEstimateScope: 'Numeric bounds and triangle-ID payload only; excludes JS object/array overhead, shared geometry and transient build allocation. Not measured heap.', disposed, enabled };
  }
  return { rebuild, dispose, setEnabled(value) { enabled = !!value; }, stats };
}
