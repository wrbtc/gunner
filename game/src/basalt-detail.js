import * as THREE from '../vendor/three.module.js?v=052';

// Original, tileable vesicular basalt microstructure. One RGBA texel carries
// tangent slope (RG), pore/cavity depth (B) and dry mineral roughness (A).
// Generated once, on the CPU; it consumes no world or gameplay random stream.
export function basaltDetailPixels(size = 256) {
  const wrap = (x, n) => ((x % n) + n) % n;
  const hash = (x, y, n) => {
    let h = Math.imul(wrap(x, n) + 17, 374761393) ^ Math.imul(wrap(y, n) + 71, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (u, v, n) => {
    const x = u * n, y = v * n, a = Math.floor(x), b = Math.floor(y);
    const fx = x - a, fy = y - b, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a, b, n), hash(a + 1, b, n), sx), THREE.MathUtils.lerp(hash(a, b + 1, n), hash(a + 1, b + 1, n), sx), sy);
  };
  const heights = new Float32Array(size * size), pores = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    // Rounded gas vesicles have a raised weathered lip and an inset cavity.
    const px = u * 19, py = v * 19, bx = Math.floor(px), by = Math.floor(py);
    let cavity = 0, lip = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = bx + i, cy = by + j, h = hash(cx, cy, 19);
      if (h < .57) continue;
      const dx = (px - cx - .2 - hash(cx + 39, cy, 19) * .6) * (1 + h * .6);
      const dy = py - cy - .2 - hash(cx, cy + 53, 19) * .6;
      const r = Math.hypot(dx, dy) / (.13 + h * .18);
      cavity = Math.max(cavity, 1 - THREE.MathUtils.smoothstep(r, .22, .90));
      lip = Math.max(lip, Math.exp(-Math.pow((r - .98) * 5, 2)) * .10);
    }
    const grain = noise(u, v, 37) * .52 + noise(u, v, 83) * .20 + noise(u, v, 127) * .07;
    heights[y * size + x] = grain - cavity * .48 + lip;
    pores[y * size + x] = cavity;
  }
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, k = i * 4;
    const dx = (heights[y * size + wrap(x + 1, size)] - heights[y * size + wrap(x - 1, size)]) * 2.5;
    const dy = (heights[wrap(y + 1, size) * size + x] - heights[wrap(y - 1, size) * size + x]) * 2.5;
    pixels[k] = Math.round(THREE.MathUtils.clamp(.5 - dx * .5, 0, 1) * 255);
    pixels[k + 1] = Math.round(THREE.MathUtils.clamp(.5 - dy * .5, 0, 1) * 255);
    pixels[k + 2] = Math.round((1 - pores[i] * .83) * 255);
    pixels[k + 3] = Math.round(THREE.MathUtils.clamp(.40 + heights[i] * .65 + pores[i] * .21, .25, .98) * 255);
  }
  return pixels;
}

export function createBasaltDetail() {
  const texture = new THREE.DataTexture(basaltDetailPixels(), 256, 256, THREE.RGBAFormat);
  texture.name = 'Original basalt vesicles: slope, cavity and mineral roughness';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
  return texture;
}
