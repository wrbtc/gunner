import * as THREE from '../vendor/three.module.js?v=052';
import { createCreaturePoseState, createCreatureJointPose, evaluateCreaturePose, sampleCreatureJoint } from './creature-pose.js?v=052';

// Many gameplay-owned fodder roots, one set of rigid-joint instance batches.
// No hit, health, position, targeting, death or director state is changed here.
export function createHordeField({ scene, assetKit, actors } = {}) {
  if (!scene || !assetKit?.cloneDemon || !Array.isArray(actors)) {
    throw new Error('createHordeField requires scene, assetKit and actors');
  }
  const capacity = actors.length;
  const template = assetKit.cloneDemon('crawler');
  template.root.updateMatrixWorld(true);
  const group = new THREE.Group();
  group.name = 'Instanced shootable reptile packs';
  scene.add(group);

  const jointKinds = new Map([[template.body, 'body'], [template.head, 'head'], [template.jaw, 'jaw']]);
  template.limbs.forEach((node, i) => jointKinds.set(node, `leg${i}`));
  template.tailParts.forEach((node, i) => jointKinds.set(node, `tail${i}`));
  const nodes = [], indices = new Map(), parts = [];
  template.root.traverse(node => {
    const index = nodes.length;
    indices.set(node, index);
    node.updateMatrix();
    nodes.push({
      parent: indices.get(node.parent) ?? -1,
      position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(),
      local: node.matrix.clone(), world: new THREE.Matrix4(), kind: jointKinds.get(node) || '',
    });
    if (!node.isMesh) return;
    // Geometry, vertex palette and procedural skin shaders remain exactly the
    // asset kit's. Three's normal pipeline handles each instance transform.
    const mesh = new THREE.InstancedMesh(node.geometry, node.material, Math.max(1, capacity));
    mesh.name = `horde-${node.name || index}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = node.receiveShadow;
    mesh.count = 0;
    group.add(mesh);
    parts.push({ mesh, node: index, triangles: (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 });
  });

  // Adopt the scene's authored black contact planes without changing their
  // geometry, material, texture, placement or parent-marker scale compensation.
  const contactBatches = [], contactGroups = new Map();
  const contacts = actors.map(actor => {
    const marker = actor?.marker;
    const source = marker?.children.find(child => child.isMesh && child.geometry?.type === 'PlaneGeometry'
      && child.material?.isMeshBasicMaterial && child.material.transparent && child.material.map
      && child.material.color.r + child.material.color.g + child.material.color.b < .001);
    if (!source) return null;
    source.updateMatrix();
    const key = `${source.geometry.uuid}:${source.material.uuid}`;
    let batch = contactGroups.get(key);
    if (!batch) {
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, Math.max(1, capacity));
      mesh.name = 'horde-contact-shadows';
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
      mesh.renderOrder = source.renderOrder; mesh.count = 0;
      group.add(mesh);
      batch = { mesh, visible: 0, previousVisible: 0 };
      contactGroups.set(key, batch); contactBatches.push(batch);
    }
    const contact = { source, parent: marker, local: source.matrix.clone(), batch };
    source.removeFromParent();
    return contact;
  });

  const inverseGroup = new THREE.Matrix4(), actorMatrix = new THREE.Matrix4(), instanceMatrix = new THREE.Matrix4();
  const local = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion();
  const turn = new THREE.Quaternion(), rotation = new THREE.Euler();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const origin = new THREE.Vector3(), phaseOffsets = actors.map((actor, i) => Number.isFinite(actor.initialPhase) ? actor.initialPhase : Number.isFinite(actor.phase) ? actor.phase : i * 2.399963);
  let visible = 0, dead = 0, outOfRange = 0, hidden = 0, disposed = false;

  const poseState = createCreaturePoseState(), jointPose = createCreatureJointPose();
  function pose(node) {
    if (!node.kind) return node.local;
    sampleCreatureJoint(jointPose, node.kind, poseState);
    position.copy(node.position); quaternion.copy(node.quaternion);
    position.x += jointPose.x; position.y += jointPose.y; position.z += jointPose.z;
    rotation.set(jointPose.rx, jointPose.ry, jointPose.rz);
    quaternion.multiply(turn.setFromEuler(rotation));
    return local.compose(position, quaternion, node.scale);
  }

  function update(time = 0, planePosition = origin) {
    if (disposed) return;
    time = Number.isFinite(time) ? time : 0;
    group.updateWorldMatrix(true, false);
    inverseGroup.copy(group.matrixWorld).invert();
    const previousVisible = visible;
    visible = dead = outOfRange = hidden = 0;
    for (const batch of contactBatches) { batch.previousVisible = batch.visible; batch.visible = 0; }
    for (let actorIndex = 0; actorIndex < capacity; actorIndex++) {
      const actor = actors[actorIndex], marker = actor?.marker;
      if (!actor || actor.dead) { dead++; continue; }
      if (!marker || marker.visible === false) { hidden++; continue; }
      marker.updateWorldMatrix(true, false);
      const m = marker.matrixWorld.elements;
      const dx = m[12] - planePosition.x, dy = m[13] - planePosition.y, dz = m[14] - planePosition.z;
      if (dx * dx + dy * dy + dz * dz > 400 * 400) { outOfRange++; continue; }
      actorMatrix.multiplyMatrices(inverseGroup, marker.matrixWorld);
      evaluateCreaturePose(poseState, actor.aggression, time, phaseOffsets[actorIndex], actor.role || 'crawler');
      // These matrices are reused for the next actor, not cloned scene graphs.
      for (const node of nodes) {
        const transform = pose(node);
        if (node.parent < 0) node.world.copy(transform);
        else node.world.multiplyMatrices(nodes[node.parent].world, transform);
      }
      for (const part of parts) {
        instanceMatrix.multiplyMatrices(actorMatrix, nodes[part.node].world);
        part.mesh.setMatrixAt(visible, instanceMatrix);
      }
      const contact = contacts[actorIndex];
      if (contact?.source.visible) {
        instanceMatrix.multiplyMatrices(actorMatrix, contact.local);
        contact.batch.mesh.setMatrixAt(contact.batch.visible++, instanceMatrix);
      }
      visible++;
    }
    // Compact visible actors so distant/dead creatures cost no vertex work.
    // Stale slots are zeroed before lowering count, including an empty field.
    for (const part of parts) {
      for (let slot = visible; slot < previousVisible; slot++) part.mesh.setMatrixAt(slot, zero);
      part.mesh.count = visible;
      part.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const batch of contactBatches) {
      for (let slot = batch.visible; slot < batch.previousVisible; slot++) batch.mesh.setMatrixAt(slot, zero);
      batch.mesh.count = batch.visible;
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function stats() {
    return {
      actors: capacity, visible, dead, outOfRange, hidden,
      batches: parts.length, contactBatches: contactBatches.length,
      contacts: contactBatches.reduce((sum, batch) => sum + batch.visible, 0),
      drawCalls: (visible ? parts.length : 0) + contactBatches.filter(batch => batch.visible > 0).length,
      trianglesPerActor: parts.reduce((sum, part) => sum + part.triangles, 0),
      submittedTriangles: visible * parts.reduce((sum, part) => sum + part.triangles, 0)
        + contactBatches.reduce((sum, batch) => sum + batch.visible * (batch.mesh.geometry.index?.count ?? batch.mesh.geometry.attributes.position.count) / 3, 0),
      range: 400,
    };
  }
  function dispose() {
    if (disposed) return;
    disposed = true; group.removeFromParent();
    // Shared asset geometry/materials are owned by assetKit and stay alive.
    for (const part of parts) part.mesh.dispose();
    for (const batch of contactBatches) batch.mesh.dispose();
    for (const contact of contacts) if (contact && !contact.source.parent) contact.parent.add(contact.source);
  }
  return { update, stats, dispose, group };
}
