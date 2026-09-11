// Deterministic acting shared by cloned rigid rigs and instanced horde joints.
// Local -Z is the authored face direction; positive X rotation raises that face.
// The runtime owns root motion, facing, contact height, attacks and health.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
const LEG_PHASE_OFFSETS = [0, Math.PI, Math.PI + .22, .22];
const smooth = (v, lo, hi) => { const t = clamp((v - lo) / (hi - lo), 0, 1); return t * t * (3 - 2 * t); };

export function createCreaturePoseState() { return {}; }
export function createCreatureJointPose() { return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }; }

export function evaluateCreaturePose(out, aggression, time = 0, seed = 0, role = 'crawler') {
  const a = aggression || {};
  time = Number.isFinite(time) ? time : 0;
  seed = Number.isFinite(seed) ? seed : 0;
  const personality = Math.sin(seed * 1.73) * .5 + .5;
  out.engagement = clamp(a.engagement, 0, 1);
  out.alert = clamp(a.alert ?? out.engagement, 0, 1);
  out.suppression = clamp(a.suppression, 0, 1);
  // No clock-driven walking: a stopped creature keeps its last step phase and
  // lowers that step into a planted stance as the runtime's stride eases down.
  out.phase = Number.isFinite(a.gaitPhase) ? a.gaitPhase : seed;
  out.turnRate = clamp(a.turnRate, -3.2, 3.2);
  out.speed = clamp(a.speed ?? (a.stride || 0) * 2.4, 0, 24);
  const motion = Math.max(out.speed / 1.8, Math.abs(out.turnRate) * .7);
  out.stride = clamp(a.stride, 0, 1) * smooth(motion, .015, .13) * (1 - .7 * out.suppression);
  out.lunge = clamp(a.lunge, 0, 1) * (1 - .85 * out.suppression);
  out.roar = clamp(a.roar, 0, 1) * (1 - .75 * out.suppression);
  out.headPitch = clamp(a.headPitch ?? .10, -.2, role === 'maw' ? 1.12 : .85);
  out.headYaw = clamp(a.headYaw, -.85, .85);
  out.breath = Math.sin(time * (1.55 + personality * .32) + seed);
  out.sway = Math.sin(out.phase);
  out.bodyPitch = .018 * out.alert + .044 * out.stride + .13 * out.roar + .07 * out.lunge - .085 * out.suppression;
  out.bodyRoll = out.sway * .027 * out.stride + out.turnRate * .028 * (.3 + .7 * out.alert);
  out.bodyLift = .008 * out.breath + .028 * (1 - Math.cos(out.phase * 2)) * out.stride;
  out.bodyLift += .030 * out.roar - .045 * out.lunge - .060 * out.suppression;
  out.tailBeat = time * (.85 + personality * .18) + out.phase * .62 + seed;
  out.swipeSide = Math.sin(seed * 1.71) < 0 ? 0 : 1;
  out.swipe = out.lunge * (.37 + .12 * out.engagement);
  out.maw = role === 'maw';
  if (out.maw) { out.stride *= .28; out.bodyLift *= .35; out.bodyRoll *= .4; }
  return out;
}

export function sampleCreatureJoint(out, kind, pose) {
  out.x = out.y = out.z = out.rx = out.ry = out.rz = 0;
  if (kind === 'body') {
    out.y = pose.bodyLift;
    out.rx = pose.bodyPitch;
    out.rz = pose.bodyRoll;
    // The shoulder compresses toward the ground before each committed surge.
    out.z = -.08 * pose.lunge;
  } else if (kind === 'head') {
    // The eyes lead the turn. Resolve the desired gaze through the chest lean
    // instead of adding Euler yaw to pitch (which would make the gaze droop).
    const pitch = pose.headPitch + .018 * pose.roar + .004 * pose.breath;
    const yaw = pose.headYaw;
    const dx = -Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = -Math.cos(yaw) * Math.cos(pitch);
    const cb = Math.cos(pose.bodyPitch), sb = Math.sin(pose.bodyPitch);
    const cr = Math.cos(pose.bodyRoll), sr = Math.sin(pose.bodyRoll);
    const y1 = cb * dy + sb * dz, z1 = -sb * dy + cb * dz;
    const x2 = cr * dx + sr * y1, y2 = -sr * dx + cr * y1;
    out.rx = Math.atan2(y2, -z1);
    out.ry = Math.asin(clamp(-x2, -1, 1));
    out.rz = -pose.bodyRoll * .70 + yaw * .025 * pose.alert;
    out.z = -.07 * pose.lunge;
  } else if (kind === 'jaw') {
    const breath = (.5 + pose.breath * .5) * .010 * pose.alert;
    out.rx = -(.025 + .055 * pose.alert + .49 * pose.roar + .095 * pose.lunge + breath) * (1 - .42 * pose.suppression);
  } else if (kind.startsWith('leg')) {
    const i = Number(kind.slice(3));
    const front = i < 2, left = i % 2 === 0;
    // FL/RR and FR/RL alternate. A small fore/hind offset avoids a rigid trot.
    const phase = pose.phase + LEG_PHASE_OFFSETS[i];
    const lift = Math.pow(Math.max(0, Math.sin(phase)), 2);
    const turnBias = 1 + (left ? -1 : 1) * clamp(pose.turnRate * .08, -.18, .18);
    const amplitude = (front ? .45 : .34) * pose.stride * turnBias;
    const swipe = front && i === pose.swipeSide ? pose.swipe : 0;
    out.ry = (left ? -1 : 1) * (.035 * pose.stride + .095 * swipe);
    out.rz = (left ? 1 : -1) * (.07 * lift * pose.stride + .12 * swipe);
    // Solve the authored lower claw tip's height by rotating at the shoulder.
    // This preserves the connected rigid anatomy while giving the supporting
    // diagonal real planted contact. The forward half-cycle lifts and reaches.
    // The anchors are the original demon-002 rig: fore Y 1.65 / rear Y 1.25.
    const side = left ? -1 : 1, pivotY = front ? 1.65 : 1.25, pivotZ = front ? -.85 : 1.05;
    const tipX = side * .73, tipY = .02 - pivotY, tipZ = -.97;
    const cz = Math.cos(out.rz), sz = Math.sin(out.rz), cy = Math.cos(out.ry), sy = Math.sin(out.ry);
    const x1 = cz * tipX - sz * tipY, y1 = sz * tipX + cz * tipY;
    const x2 = cy * x1 + sy * tipZ, z2 = -sy * x1 + cy * tipZ;
    const cb = Math.cos(pose.bodyPitch), sb = Math.sin(pose.bodyPitch);
    const cr = Math.cos(pose.bodyRoll), sr = Math.sin(pose.bodyRoll);
    const anchorY = pose.bodyLift + cb * (sr * (side * .88 + x2) + cr * pivotY) - sb * pivotZ;
    const a = cb * cr * y1 - sb * z2, b = -cb * cr * z2 - sb * y1;
    const contactY = .04 + Math.abs(pose.bodyRoll) * .22;
    let plant = Math.atan2(b, a) - Math.acos(clamp((contactY - anchorY) / Math.hypot(a, b), -1, 1));
    if (plant > Math.PI) plant -= Math.PI * 2;
    if (plant < -Math.PI) plant += Math.PI * 2;
    plant = clamp(plant, -.62, .62);
    out.rx = plant + lift * amplitude + swipe + (front ? .16 : 0) * pose.roar;
  } else if (kind.startsWith('tail')) {
    const i = Number(kind.slice(4));
    const amplitude = (.018 + .026 * pose.alert + .095 * pose.stride + .036 * pose.roar) * (1 + i * .22);
    out.ry = Math.sin(pose.tailBeat - i * .84) * amplitude;
    out.ry -= pose.sway * pose.stride * .045 + pose.turnRate * (.052 + i * .014);
    out.rx = .012 * Math.sin(pose.tailBeat * .7 - i * .65) - .055 * pose.lunge;
    if (i === 0) out.rx -= pose.bodyPitch * .65;
  }
  return out;
}
