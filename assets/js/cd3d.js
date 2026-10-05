
const BASE = "/assets/cd/";
const CD_ORDER = ["self", "growth", "lost", "tech", "future"];
const rad = (d) => (d * Math.PI) / 180;

export async function initCd3d(opts) {
  const container = opts.container;
  if (!container) return null;
  const report = (p, label) => {
    if (opts.onProgress) opts.onProgress(Math.max(0, Math.min(96, Math.round(p * 0.96))), label || "");
  };
  report(3, "登入验证:锚点身份");

  let m;
  try {
    const r = await fetch(BASE + "manifest.json", { cache: "no-cache" });
    if (!r.ok) {
      console.error("[cd3d] manifest.json 请求失败:HTTP " + r.status + "(检查文件是否存在于 /assets/cd/)");
      return null;
    }
    m = await r.json();
  } catch (e) {
    console.error(
      "[cd3d] manifest.json 解析失败(JSON 语法错误 / 文件编码非 UTF-8):" + (e && e.message)
    );
    return null;
  }
  if (!(await probe(m.model))) {
    console.error("[cd3d] 模型文件不可访问:" + m.model);
    return null;
  }

  let THREE, GLTFLoader, RoomEnvironment;
  report(10, "调取上次纠错记录");
  try {
    THREE = await import("three");
    ({ GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"));
    ({ RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js"));
  } catch (e) {
    console.error("[cd3d] three.js 模块加载失败(检查 /vendor/three/ 下文件是否完整):", e && e.message);
    return null;
  }

  let audio = null;
  if (opts.audioUrl) {
    try {
      const mod = await import(opts.audioUrl);
      audio = mod.initCdAudio(m.audio || {});
    } catch (e) {
      console.warn("[cd3d] 音效模块加载失败(画面不受影响):" + (e && e.message));
    }
  }

  let createFx = null;
  if (opts.fxUrl) {
    try {
      ({ createFx } = await import(opts.fxUrl));
    } catch (e) {
      console.warn("[cd3d] 可视化模块加载失败(画面不受影响):" + (e && e.message));
    }
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
  renderer.domElement.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:auto;";
  container.appendChild(renderer.domElement);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = m.exposure != null ? m.exposure : 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 400);

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    let envScene;
    if (m.envMode === "room") {
      envScene = new RoomEnvironment();
    } else {
      envScene = new THREE.Scene();
      const S = m.envStudio || {};
      envScene.background = new THREE.Color(S.bgColor || 0x0b0e14);
      const addPanel = (color, intensity, pos, scale, rotY) => {
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
        mat.color.multiplyScalar(intensity);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(scale[0], scale[1]), mat);
        mesh.position.set(pos[0], pos[1], pos[2]);
        mesh.lookAt(0, 0, 0);
        if (rotY) mesh.rotateZ(rotY);
        envScene.add(mesh);
      };
      addPanel(S.keyColor || 0xd8ecff, S.keyIntensity != null ? S.keyIntensity : 3.2, [4, 2, 3], [6, 6]);
      addPanel(S.fillColor || 0x5a6a86, S.fillIntensity != null ? S.fillIntensity : 0.5, [-5, 0.5, 1.5], [5, 5]);
      addPanel(S.topColor || 0x2a3244, S.topIntensity != null ? S.topIntensity : 0.35, [0, 5, 0], [8, 8]);
    }
    const envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = envRT.texture;
    if ("environmentIntensity" in scene) {
      scene.environmentIntensity = m.envIntensity != null ? m.envIntensity : 0.95;
    }
    pmrem.dispose();
  } catch (e) {}

  const L = m.light || {};
  const sun = new THREE.DirectionalLight(L.color || 0xbfe6ff, L.intensity || 1.7);
  sun.position.fromArray(L.position || [4.1, 2.4, 2.6]);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(L.rimColor || 0x8fd8ff, L.rimIntensity || 1.15);
  rim.position.fromArray(L.rimPosition || [-3.4, 2.2, -2.2]);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b1f27, 0.45));
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  let gltf;
  try {
    report(18, "人格基线比对:漂移 +0.83σ");
    gltf = await new Promise((res, rej) =>
      new GLTFLoader().load(
        m.model,
        res,
        (xhr) => {
          if (xhr && xhr.total) {
            report(18 + (xhr.loaded / xhr.total) * 70, "挂载情感引擎");
          } else if (xhr && xhr.loaded) {
            report(Math.min(88, 18 + (xhr.loaded / 2600000) * 70), "下载 3D 模型");
          }
        },
        rej
      )
    );
  } catch (e) {
    console.error("[cd3d] 模型加载失败:", e && e.message);
    renderer.dispose();
    container.removeChild(renderer.domElement);
    return null;
  }
  report(90, "排队第 27 次人格修正");
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  scene.add(root);

  const cdHolder = new THREE.Group();
  root.add(cdHolder);
  const cdItems = [];
  const standRotX = rad(m.cdStandRotX != null ? m.cdStandRotX : 90);
  const flipRotY = rad(m.cdFlipDeg != null ? m.cdFlipDeg : 180);

  CD_ORDER.forEach((key) => {
    const name = (m.cdNodes && m.cdNodes[key]) || (m.cds && m.cds[key] && m.cds[key].mesh) || key;
    const node = root.getObjectByName(name);
    if (!node) return;
    const g = new THREE.Group();
    g.rotation.order = "YXZ";
    const stand = new THREE.Group();
    cdHolder.add(g);
    g.add(stand);
    stand.attach(node);
    stand.rotation.set(standRotX, 0, 0);
    node.rotation.set(0, flipRotY, 0);
    g.userData.cdKey = key;
    g.userData.target = new THREE.Vector3();
    cdItems.push({ key: key, group: g, mesh: node, userData: { target: new THREE.Vector3(), tween: null } });
  });
  if (!cdItems.length) {
    renderer.dispose();
    container.removeChild(renderer.domElement);
    return null;
  }

  root.updateMatrixWorld(true);
  const cdBox = new THREE.Box3().setFromObject(cdItems[0].mesh);
  const cdSize = cdBox.getSize(new THREE.Vector3());
  const cdR = Math.max(cdSize.x, cdSize.y) / 2 || 1;
  const cdDiameter = cdR * 2;

  const matCfg = m.cdMaterial || {};
  function upgradeCdMaterials(mesh) {
    mesh.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const isArr = Array.isArray(o.material);
      const src = isArr ? o.material : [o.material];
      const upgraded = src.map((old) => {
        if (!old || old.isMeshPhysicalMaterial) return old;
        const mat = new THREE.MeshPhysicalMaterial({
          name: old.name,
          map: old.map || null,
          color: old.color ? old.color.clone() : new THREE.Color(0xffffff),
          alphaMap: old.alphaMap || null,
          transparent: !!old.transparent,
          opacity: old.opacity != null ? old.opacity : 1,
          side: old.side,
          normalMap: old.normalMap || null,
          normalScale: old.normalScale ? old.normalScale.clone() : undefined,
          roughnessMap: old.roughnessMap || null,
          metalnessMap: old.metalnessMap || null,
          emissive: old.emissive ? old.emissive.clone() : new THREE.Color(0x000000),
          emissiveMap: old.emissiveMap || null
        });
        const hasRoughMap = !!mat.roughnessMap;
        const hasMetalMap = !!mat.metalnessMap;
        mat.roughness =
          matCfg.roughness != null ? matCfg.roughness : hasRoughMap ? 1 : 0.18;
        mat.metalness =
          matCfg.metalness != null ? matCfg.metalness : hasMetalMap ? 1 : 0.35;
        mat.clearcoat = matCfg.clearcoat != null ? matCfg.clearcoat : 0.6;
        mat.clearcoatRoughness = matCfg.clearcoatRoughness != null ? matCfg.clearcoatRoughness : 0.2;
        mat.iridescence = matCfg.iridescence != null ? matCfg.iridescence : 0.7;
        mat.iridescenceIOR = matCfg.iridescenceIOR != null ? matCfg.iridescenceIOR : 1.35;
        mat.iridescenceThicknessRange = matCfg.iridescenceThicknessRange || [120, 420];
        mat.anisotropy = matCfg.anisotropy != null ? matCfg.anisotropy : 0.4;
        mat.anisotropyRotation = matCfg.anisotropyRotation != null ? matCfg.anisotropyRotation : Math.PI / 2;
        mat.envMapIntensity = matCfg.envMapIntensity != null ? matCfg.envMapIntensity : 1.2;
        return mat;
      });
      o.material = isArr ? upgraded : upgraded[0];
      if (matCfg.anisotropy) {
        try {
          if (o.geometry && !o.geometry.attributes.tangent && o.geometry.attributes.uv) {
            o.geometry.computeTangents();
          }
        } catch (e) {}
      }
    });
  }
  cdItems.forEach((item) => upgradeCdMaterials(item.mesh));

  const driveCfg = m.driveMaterial || {};
  function upgradeDriveMaterials(group) {
    group.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const isArr = Array.isArray(o.material);
      const src = isArr ? o.material : [o.material];
      const upgraded = src.map((old) => {
        if (!old) return old;
        const mat = new THREE.MeshPhysicalMaterial({
          name: old.name,
          map: old.map || null,
          color: old.color ? old.color.clone() : new THREE.Color(0xffffff),
          normalMap: old.normalMap || null,
          normalScale: old.normalScale ? old.normalScale.clone() : undefined,
          roughnessMap: old.roughnessMap || null,
          metalnessMap: old.metalnessMap || null,
          aoMap: old.aoMap || null,
          aoMapIntensity: old.aoMapIntensity != null ? old.aoMapIntensity : 1,
          emissive: old.emissive ? old.emissive.clone() : new THREE.Color(0x000000),
          emissiveMap: old.emissiveMap || null,
          transparent: !!old.transparent,
          opacity: old.opacity != null ? old.opacity : 1,
          side: old.side
        });
        const hasRoughMap = !!mat.roughnessMap;
        const hasMetalMap = !!mat.metalnessMap;
        mat.roughness = driveCfg.roughness != null ? driveCfg.roughness : (hasRoughMap ? 0.72 : 0.42);
        mat.metalness = driveCfg.metalness != null ? driveCfg.metalness : (hasMetalMap ? 0.95 : 0.8);
        mat.clearcoat = driveCfg.clearcoat != null ? driveCfg.clearcoat : 0.35;
        mat.clearcoatRoughness = driveCfg.clearcoatRoughness != null ? driveCfg.clearcoatRoughness : 0.3;
        mat.envMapIntensity = driveCfg.envMapIntensity != null ? driveCfg.envMapIntensity : 1.5;
        return mat;
      });
      o.material = isArr ? upgraded : upgraded[0];
    });
  }

  const driveHolder = new THREE.Group();
  root.add(driveHolder);
  const driveNode = root.getObjectByName(m.driveNode || "");
  if (driveNode) {
    driveHolder.attach(driveNode);
    upgradeDriveMaterials(driveHolder);
  }
  const driveRot = m.driveRot || [0, 0, 0];
  driveHolder.rotation.set(rad(driveRot[0] || 0), rad(driveRot[1] || 0), rad(driveRot[2] || 0));
  root.updateMatrixWorld(true);
  const dBox = new THREE.Box3().setFromObject(driveHolder.children.length ? driveHolder : root);
  const dCenter = dBox.getCenter(new THREE.Vector3());
  const dSize = dBox.getSize(new THREE.Vector3());

  const hub = new THREE.Vector3().fromArray(m.hub || [0, 0, 0]);
  const driveOffset = new THREE.Vector3().fromArray(m.driveOffset || [0, 0, 0]);
  if (driveHolder.children.length) {
    driveHolder.position.copy(hub).add(driveOffset).sub(dCenter);
  }

  root.updateMatrixWorld(true);
  let slotTargetVec = null;
  let internalDisc = null;
  (function findInternalDisc() {
    const tmpBox = new THREE.Box3();
    driveHolder.traverse((o) => {
      if (internalDisc || !o.isMesh) return;
      tmpBox.setFromObject(o);
      const s = tmpBox.getSize(new THREE.Vector3());
      const d = Math.max(s.x, s.y, s.z);
      if (Math.abs(d - cdDiameter) < cdDiameter * 0.25) {
        internalDisc = o;
      }
    });
    if (internalDisc) {
      const wp = new THREE.Vector3();
      internalDisc.getWorldPosition(wp);
      slotTargetVec = cdHolder.worldToLocal(wp.clone());
      internalDisc.visible = false;
    }
  })();

  const cdZ = m.cdZ != null ? m.cdZ : 0;
  const fov = (m.camera && m.camera.fov) || 30;
  const driveHFrac = m.driveHeightFraction != null ? m.driveHeightFraction : 0.5;
  const viewH = dSize.y > 0 ? dSize.y / driveHFrac : 10;
  const spacingRatio = m.cdSpacingRatio != null ? m.cdSpacingRatio : 0.538;
  const orbitRatio = m.cdOrbitRatio != null ? m.cdOrbitRatio : 0.64;
  const spacing =
    m.cdSpacing != null && m.cdSpacing > 0 ? m.cdSpacing : viewH * spacingRatio;
  const R =
    m.cdOrbitRadius != null && m.cdOrbitRadius > 0 ? m.cdOrbitRadius : viewH * orbitRatio;
  const curve = m.cdCurve != null ? m.cdCurve : 0.08;
  const rightMargin = m.driveRightMargin != null ? m.driveRightMargin : 0;

  const centerY = hub.y + driveOffset.y;
  const driveRight = hub.x + driveOffset.x + dSize.x / 2;

  const baseCam = new THREE.Vector3();
  function fit() {
    const aspect = (container.clientWidth || 1) / (container.clientHeight || 1);
    camera.aspect = aspect;
    const dist = viewH / 2 / Math.tan(rad(fov / 2));
    const viewW = viewH * aspect;
    const camX = driveRight + rightMargin - viewW / 2;
    baseCam.set(camX, centerY, dist);
    camera.position.copy(baseCam);
    camera.lookAt(camX, centerY, 0);
    camera.updateProjectionMatrix();
  }
  fit();

  let selIndex = opts.selIndex || 0;
  let insertedKey = null;
  let centerKey = cdItems[selIndex] ? cdItems[selIndex].key : null;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const rackMoveMs = m.rackMoveMs != null ? m.rackMoveMs : 450;
  const spinBackMs = m.spinBackMs != null ? m.spinBackMs : 350;
  const flyMs = m.insertFlyMs != null ? m.insertFlyMs : 520;
  const settleMs = m.settleMs != null ? m.settleMs : 300;
  const riseY = m.slotRiseY != null ? m.slotRiseY : 0.6;
  const slotPoint = (slotTargetVec || new THREE.Vector3(hub.x, hub.y, cdZ)).clone();
  if (m.slotOffset) slotPoint.add(new THREE.Vector3().fromArray(m.slotOffset));
  const spinNormal = m.cdSpinDegPerSec != null ? m.cdSpinDegPerSec : 12;

  const driveDist = m.driveEjectDist != null ? m.driveEjectDist : dSize.x;
  const driveOvershoot = m.driveEjectOvershoot != null ? m.driveEjectOvershoot : 0.1;
  const driveTuck = driveDist * (1 + driveOvershoot);
  const driveBaseX = driveHolder.position.x;
  const ejectMs = m.driveEjectMs != null ? m.driveEjectMs : 620;
  const dropHeight = m.cdDropHeight != null ? m.cdDropHeight : 1.1;
  const dropMs = m.cdDropMs != null ? m.cdDropMs : 720;
  const retractMs2 = m.retractMs != null ? m.retractMs : 620;
  const retractPauseMs = m.retractPauseMs != null ? m.retractPauseMs : 260;
  const retractSnapMs = m.retractSnapMs != null ? m.retractSnapMs : 170;
  const ejectDelayMs = m.driveEjectDelayMs != null ? m.driveEjectDelayMs : 1000;

  let driveShift = 0;
  let driveTween = null;
  let rideDrive = false;
  const easeOutBack = (p) => 1 + 2.4 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2);

  function animateDrive(to, dur, ease, delay, onDone) {
    driveTween = {
      from: driveShift,
      to: to,
      t0: performance.now() + (delay || 0),
      dur: dur,
      ease: ease || easeInOut,
      onDone: onDone || null
    };
  }

  function rackListForInsert(excludeKey) {
    return cdItems.filter((it) => it.key !== excludeKey);
  }

  function rackList() {
    return cdItems.filter((it) => it.key !== insertedKey);
  }
  function rackTargetFor(item) {
    const list = rackList();
    let centerItem = cdItems.find((it) => it.key === centerKey && it.key !== insertedKey);
    if (!centerItem) {
      const startIdx = Math.max(0, cdItems.findIndex((it) => it.key === centerKey));
      for (let d = 1; d < cdItems.length; d++) {
        const prev = cdItems[startIdx - d];
        const next = cdItems[startIdx + d];
        if (prev && prev.key !== insertedKey) { centerItem = prev; centerKey = prev.key; break; }
        if (next && next.key !== insertedKey) { centerItem = next; centerKey = next.key; break; }
      }
    }
    let selRank = centerItem ? list.indexOf(centerItem) : 0;
    if (selRank < 0) selRank = 0;
    const k = list.indexOf(item) - selRank;
    const y = hub.y - k * spacing;
    const x = hub.x - Math.max(0.25, R - curve * y * y);
    return new THREE.Vector3(x, y, cdZ + (k === 0 ? 0.03 : 0));
  }

  function setPath(item, points, durs, delayMs, instant) {
    if (instant) {
      item.group.position.copy(points[points.length - 1]);
      item.userData.path = null;
      return;
    }
    item.userData.path = {
      points: points.map((p) => p.clone()),
      durs: durs.slice(),
      idx: 0,
      from: item.group.position.clone(),
      t0: performance.now() + (delayMs || 0),
      segStart: 0
    };
  }

  function moveToRack(item, instant, idxOverride) {
    setPath(item, [rackTargetFor(item)], [rackMoveMs], 0, instant);
  }

  let previewAllowed = true;

  function place(idx, instant, silent) {
    selIndex = idx;
    if (cdItems[idx]) centerKey = cdItems[idx].key;
    if (previewAllowed && !silent && audio && cdItems[idx]) audio.music.preview(cdItems[idx].key);
    cdItems.forEach((item) => {
      if (item.key === insertedKey) return;
      moveToRack(item, instant);
      if (item !== cdItems[idx]) item.group.rotation.set(0, 0, 0);
    });
    if (window.__cd3dDebug) window.__cd3dDebug.selIndex = idx;
  }
  place(selIndex, true, true);
  if (insertedKey) {
    const ins = cdItems.find((it) => it.key === insertedKey);
    if (ins) {
      ins.group.position.copy(slotPoint);
      ins.userData.spinFrozen = true;
    }
  }

  function setInserted(key) {
    const prevInserted = insertedKey;
    insertedKey = key;
    rideDrive = false;
    const insertTotal = spinBackMs + 60 + flyMs + settleMs;
    const ejectTotal = 160 + flyMs + settleMs;

    cdItems.forEach((item) => {
      if (item.key === key) {
        const cur = item.userData.spinAngle || 0;
        const delta = ((-cur % 360) + 540) % 360 - 180;
        item.userData.spinTween = {
          from: cur,
          to: cur + delta,
          t0: performance.now(),
          dur: spinBackMs,
          freezeAfter: true
        };
        const from = item.group.position.clone();
        const p1 = new THREE.Vector3(from.x, slotPoint.y + riseY, from.z);
        const p2 = new THREE.Vector3(slotPoint.x, slotPoint.y + riseY, slotPoint.z);
        const p3 = slotPoint.clone();
        setPath(item, [p1, p2, p3], [spinBackMs + 60, flyMs, settleMs], 0);
        item.userData.path.points[0].z = from.z;
        if (audio) audio.play("disc", { lead: spinBackMs + 60, ms: flyMs, settle: settleMs });
        return;
      }
      if (item.key === prevInserted) {
        item.userData.spinFrozen = false;
        const tgt = rackTargetFor(item);
        const p1 = new THREE.Vector3(item.group.position.x, slotPoint.y + riseY, item.group.position.z);
        const p2 = new THREE.Vector3(tgt.x, tgt.y + riseY, tgt.z);
        setPath(item, [p1, p2, tgt], [160, flyMs, settleMs], 260);
        return;
      }
      setPath(
        item,
        [rackTargetFor(item)],
        [rackMoveMs],
        key ? insertTotal + 40 : 0
      );
    });
    if (window.__cd3dDebug) window.__cd3dDebug.insertedKey = key;
  }

  function ejectDrive(cb) {
    if (driveShift <= -driveDist + 0.001) {
      if (cb) cb();
      return;
    }
    if (audio) audio.play("eject", { ms: ejectMs, shift: +driveShift.toFixed(3) });
    animateDrive(-driveDist, ejectMs, easeOutBack, 0, cb);
  }

  function retractDrive(cb) {
    const from = driveShift;
    if (from >= -0.001) {
      if (cb) cb();
      return;
    }
    const toPause = from * 0.12;
    if (audio) audio.play("insert", { ms: retractMs2, shift: +driveShift.toFixed(3) });
    animateDrive(toPause, retractMs2, easeInOut, 0, function () {
      if (audio) audio.play("snap", { ms: retractSnapMs, delayMs: retractPauseMs, shift: +driveShift.toFixed(3) });
      animateDrive(0, retractSnapMs, easeInOut, retractPauseMs, function () {
        if (audio) audio.play("clack", { shift: +driveShift.toFixed(3) });
        if (cb) cb();
      });
    });
  }

  function insertCd(key, cb) {
    const item = cdItems.find((it) => it.key === key);
    if (!item) {
      if (cb) cb();
      return;
    }
    const prev = insertedKey;
    if (prev && prev !== key) {
      const old = cdItems.find((it) => it.key === prev);
      if (old) {
        old.userData.spinFrozen = false;
        setPath(old, [rackTargetFor(old)], [700], 0);
      }
    }
    rideDrive = false;
    const cur = item.userData.spinAngle || 0;
    const delta = ((-cur % 360) + 540) % 360 - 180;
    item.userData.spinTween = {
      from: cur,
      to: cur + delta,
      t0: performance.now(),
      dur: spinBackMs,
      freezeAfter: true
    };
    const liftMs = 280;
    const seatMs = 180;
    const slotNow = new THREE.Vector3(slotPoint.x + driveTuck + driveShift, slotPoint.y, slotPoint.z);
    const from = item.group.position.clone();
    const p1 = new THREE.Vector3(from.x, slotPoint.y + dropHeight, from.z);
    const p2 = new THREE.Vector3(slotNow.x, slotNow.y + 0.3, slotNow.z);
    const p3 = slotNow.clone();
    setPath(item, [p1, p2, p3], [liftMs, dropMs, seatMs], spinBackMs + 60);
    if (audio) audio.play("disc", { lead: spinBackMs + 60 + liftMs, ms: dropMs, settle: seatMs });
    item.userData.onPathDone = function () {
      rideDrive = true;
      insertedKey = key;
      if (window.__cd3dDebug) window.__cd3dDebug.insertedKey = key;
      cdItems.forEach((it) => {
        if (it.key !== key) setPath(it, [rackTargetFor(it)], [rackMoveMs], 0);
      });
      if (cb) cb();
    };
  }

  function resetDrive() {
    driveTween = null;
    driveShift = 0;
    rideDrive = false;
    if (driveHolder.children.length) driveHolder.position.x = driveBaseX + driveTuck;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tilt = { x: 0, y: 0 };
  const tiltTarget = { x: 0, y: 0 };
  const TILT_MAX = m.tiltMaxDeg != null ? m.tiltMaxDeg : 14;
  const tiltYawSign = m.tiltYawSign != null ? m.tiltYawSign : 1;
  const tiltPitchSign = m.tiltPitchSign != null ? m.tiltPitchSign : 1;

  function pickIndexAt(clientX, clientY) {
    const r = container.getBoundingClientRect();
    const cx = clientX - r.left;
    const cy = clientY - r.top;
    const v = new THREE.Vector3();
    let best = -1;
    let bestD = Infinity;
    cdItems.forEach((item, i) => {
      item.group.getWorldPosition(v);
      const dist = camera.position.distanceTo(v);
      const pxRadius = (cdR / (2 * Math.tan(rad(fov / 2)) * dist)) * r.height;
      v.project(camera);
      const sx = ((v.x + 1) / 2) * r.width;
      const sy = ((1 - v.y) / 2) * r.height;
      const d = Math.hypot(cx - sx, cy - sy);
      if (d <= pxRadius * 1.05 && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  let lastPointerHandled = 0;
  function handlePointerAt(clientX, clientY) {
    const r = container.getBoundingClientRect();
    pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    let key = null;
    const idx = pickIndexAt(clientX, clientY);
    if (idx >= 0) {
      key = cdItems[idx].key;
    } else {
      const hits = raycaster.intersectObjects(
        cdItems.map((i) => i.mesh),
        true
      );
      if (hits.length) {
        let o = hits[0].object;
        while (o && !o.userData.cdKey) o = o.parent;
        if (o) key = o.userData.cdKey;
      }
    }
    if (window.__cd3dDebug) {
      window.__cd3dDebug.lastPointer = { x: Math.round(clientX), y: Math.round(clientY), pickIndex: idx, key: key };
    }
    if (key && opts.onCdClick) opts.onCdClick(key);
  }

  const pv = new THREE.Vector3();
  let hoverIndex = -1;
  const TILT_TARGET_MODE = m.tiltTarget === "hover" ? "hover" : "selected";

  function resolveTiltItem() {
    if (TILT_TARGET_MODE === "hover") {
      return hoverIndex >= 0 ? cdItems[hoverIndex] : null;
    }
    const sel = cdItems[selIndex];
    return sel && sel.key !== insertedKey ? sel : null;
  }

  function computeTiltFor(item, clientX, clientY) {
    const r = container.getBoundingClientRect();
    item.group.getWorldPosition(pv);
    const dist = camera.position.distanceTo(pv);
    const pxR = Math.max(8, (cdR / (2 * Math.tan(rad(fov / 2)) * dist)) * r.height);
    pv.project(camera);
    const sx = ((pv.x + 1) / 2) * r.width;
    const sy = ((1 - pv.y) / 2) * r.height;
    const nx = (clientX - r.left - sx) / (pxR * 2.2);
    const ny = (clientY - r.top - sy) / (pxR * 2.2);
    const cx = Math.max(-1, Math.min(1, nx));
    const cy = Math.max(-1, Math.min(1, ny));
    tiltTarget.y = cx * TILT_MAX * tiltYawSign;
    tiltTarget.x = cy * TILT_MAX * tiltPitchSign;
  }

  function onPointerMove(e) {
    hoverIndex = pickIndexAt(e.clientX, e.clientY);
    const item = resolveTiltItem();
    if (item) {
      computeTiltFor(item, e.clientX, e.clientY);
    } else {
      tiltTarget.x = 0;
      tiltTarget.y = 0;
    }
  }
  function onPointerLeave() {
    hoverIndex = -1;
    tiltTarget.x = 0;
    tiltTarget.y = 0;
  }
  function onPointerDown(e) {
    lastPointerHandled = Date.now();
    handlePointerAt(e.clientX, e.clientY);
  }
  function onClick(e) {
    if (Date.now() - lastPointerHandled < 500) return;
    handlePointerAt(e.clientX, e.clientY);
  }
  const wheelCooldownMs = m.wheelCooldownMs != null ? m.wheelCooldownMs : rackMoveMs + 80;
  let lastWheelAt = 0;
  function onWheel(e) {
    const now = performance.now();
    if (now - lastWheelAt < wheelCooldownMs) return;
    if (cdItems.some((it) => it.userData.path || it.userData.spinTween)) return;
    lastWheelAt = now;
    if (opts.onScroll) opts.onScroll(e.deltaY > 0 ? 1 : -1);
  }

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: true });

  let raf = 0;
  let paused = false;
  let pauseWhenIdle = false;
  const tmp = new THREE.Vector3();
  let lastT = performance.now();

  let cdRadius = 0;
  {
    cdItems.forEach((it) => {
      try {
        const g = it.mesh.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        const b = g.boundingBox;
        const ws = new THREE.Vector3();
        it.mesh.getWorldScale(ws);
        const rx = (Math.abs(b.max.x - b.min.x) / 2) * Math.abs(ws.x || 1);
        const ry = (Math.abs(b.max.y - b.min.y) / 2) * Math.abs(ws.y || 1);
        cdRadius = Math.max(cdRadius, rx, ry);
      } catch (e) {}
    });
    if (!(cdRadius > 0)) cdRadius = 1.0;
    if (m.cdRadius != null && m.cdRadius > 0) cdRadius = m.cdRadius;
    console.info("[cd3d] CD 模型半径 = " + cdRadius.toFixed(3) + (m.cdRadius != null ? "(manifest 指定)" : "(几何体实测)"));
  }
  let fx = null;
  let fxEnabled = true;

  const NEB = Object.assign({
    count: 420,
    radius: 1.34,
    spread: 0.17,
    thickness: 0.03,
    spin: 0.085,
    size: 0.055,
    ballR: 0.07,
    drift: 0.30,
    seekDur: 0.13,
    depth: 0.5,
    gapLow: 0.22,
    irregular: 0.075,
    linkSpread: 1.55,
    maxLinks: 1400,
    axis: "z",
    tilt: 0.17,
    beatGain: 1.0,
    spring: 26,
    damp: 5.2
  }, (m.nebula || {}));

  let nebula = null;
  let nebTint = new THREE.Color(0x22d3ee);
  let nebSpin = 0;
  let nebVarsAge = 0;
  let beatPulse = 0, lastBeatMs = 0, fluxAvg = 0, prevBands = null, beatCount = 0;
  let nebVis = 1;

  function dotTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.30, "rgba(255,255,255,0.6)");
    grd.addColorStop(0.7, "rgba(255,255,255,0.12)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function buildNebula() {
    const n = NEB.count;
    const R = cdRadius * NEB.radius;
    const parts = [];
    for (let i = 0; i < n; i++) {
      let th = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
      let tries = 0;
      while (tries++ < 24) {
        const dens = 0.5 + 0.5 * Math.sin(th * 2.3 + 0.7) * Math.sin(th * 1.7 - 1.1);
        if (Math.random() < NEB.gapLow + (1 - NEB.gapLow) * dens) break;
        th += (Math.random() - 0.5) * 0.5;
      }
      const wob = 1 + NEB.irregular * (Math.sin(th * 2.7 + 1.4) + 0.55 * Math.sin(th * 5.1 - 0.6));
      const k = Math.pow(Math.random(), 0.7);
      const gz = ((Math.random() + Math.random() + Math.random()) - 1.5) / 1.5;
      parts.push({
        r: R * wob * (1 + (k - 0.5) * NEB.spread * 2),
        th: th,
        x0: gz * NEB.depth * cdRadius,
        ox: 0, oy: 0, oz: 0,
        vx: 0, vy: 0, vz: 0,
        tx: 0, ty: 0, tz: 0,
        seek: 0
      });
    }
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: NEB.size * cdRadius,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
      map: dotTexture(),
      vertexColors: true
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    scene.add(pts);

    const lpos = new Float32Array(NEB.maxLinks * 6);
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
    lgeo.setDrawRange(0, 0);
    const lmat = new THREE.LineBasicMaterial({
      color: 0x9ec8ff, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const lines = new THREE.LineSegments(lgeo, lmat);
    lines.frustumCulled = false;
    lines.renderOrder = 2;
    scene.add(lines);

    nebula = {
      pts: pts, geo: geo, mat: mat, lines: lines, lgeo: lgeo, lmat: lmat, lpos: lpos,
      parts: parts, n: n, R: R, color: col, grid: new Map()
    };
  }

  function beatTick(dt, lv) {
    if (!lv || !lv.bands || !lv.playing) return 0;
    const nb = lv.bands.length;
    const lowN = Math.max(4, Math.round(nb * 0.25));
    if (!prevBands || prevBands.length !== nb) prevBands = new Float32Array(nb);
    let flux = 0;
    for (let i = 0; i < lowN; i++) {
      const d = lv.bands[i] - prevBands[i];
      if (d > 0) flux += d;
      prevBands[i] = lv.bands[i];
    }
    flux /= lowN;
    fluxAvg += (flux - fluxAvg) * Math.min(1, dt * 1.2);
    const over = flux / Math.max(0.004, fluxAvg) - 1.25;
    const now = performance.now();
    if (over > 0 && now - lastBeatMs > 95) {
      lastBeatMs = now;
      const hit = Math.min(1, over * 4);
      beatPulse = Math.max(beatPulse, hit);
      beatCount++;
      return hit;
    }
    return 0;
  }

  function updateNebula(dt, world, lv) {
    if (!nebula) return;
    const n = nebula.n, parts = nebula.parts;
    const hit = beatTick(dt, lv);
    beatPulse *= Math.pow(0.5, dt / 0.18);
    nebSpin += dt * NEB.spin;
    const impulse = cdRadius * 0.22 * NEB.beatGain;
    const k = NEB.spring, c = NEB.damp;
    const tint = nebTint;
    const maxR = nebula.R * 1.2;
    const pos = nebula.geo.attributes.position.array;
    const col = nebula.color;
    const cx = world.x, cy = world.y, cz = world.z;
    const ct = Math.cos(NEB.tilt), st = Math.sin(NEB.tilt);

    const ballR = cdRadius * NEB.ballR;
    const driftV = ballR * NEB.drift;
    const seekK = Math.min(1, dt / Math.max(0.02, NEB.seekDur));
    for (let i = 0; i < n; i++) {
      const p = parts[i];
      if (hit > 0) {
        const u = Math.random() * 2 - 1;
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.cbrt(Math.random()) * ballR;
        const sq = Math.sqrt(Math.max(0, 1 - u * u));
        p.tx = rad * sq * Math.cos(ang);
        p.ty = rad * sq * Math.sin(ang);
        p.tz = rad * u;
        p.seek = 1;
      }
      if (p.seek) {
        p.ox += (p.tx - p.ox) * seekK;
        p.oy += (p.ty - p.oy) * seekK;
        p.oz += (p.tz - p.oz) * seekK;
        const d2 = p.ox * p.ox + p.oy * p.oy + p.oz * p.oz;
        if (d2 < ballR * ballR * 0.0025) {
          p.seek = 0;
          p.vx = (Math.random() * 2 - 1) * driftV;
          p.vy = (Math.random() * 2 - 1) * driftV;
          p.vz = (Math.random() * 2 - 1) * driftV;
        }
      } else {
        p.ox += p.vx * dt;
        p.oy += p.vy * dt;
        p.oz += p.vz * dt;
        const d2 = p.ox * p.ox + p.oy * p.oy + p.oz * p.oz;
        if (d2 > ballR * ballR) {
          const d = Math.sqrt(d2) || 1;
          p.ox = p.ox / d * ballR; p.oy = p.oy / d * ballR; p.oz = p.oz / d * ballR;
          p.vx = -p.vx * 0.7 + (Math.random() * 2 - 1) * driftV * 0.5;
          p.vy = -p.vy * 0.7 + (Math.random() * 2 - 1) * driftV * 0.5;
          p.vz = -p.vz * 0.7 + (Math.random() * 2 - 1) * driftV * 0.5;
        }
      }

      const rr = p.r;
      const speed = 1 + 1.5 * (1 - Math.min(1, rr / maxR));
      const th = p.th + nebSpin * speed;
      const px = Math.cos(th) * rr, py = Math.sin(th) * rr;
      const i3 = i * 3;
      if (NEB.axis === "x") {
        pos[i3] = cx + p.x0 + p.ox;
        pos[i3 + 1] = cy + px + p.oy;
        pos[i3 + 2] = cz + py + p.oz;
      } else {
        pos[i3] = cx + px + p.ox;
        pos[i3 + 1] = cy + py * ct + p.x0 * st + p.oy;
        pos[i3 + 2] = cz + py * st + p.x0 * ct + p.oz;
      }
      const kk = Math.min(1, rr / maxR);
      const b = (0.5 + 0.5 * (1 - kk)) * (0.75 + beatPulse * 0.7);
      col[i3] = tint.r * b + 0.10 * kk;
      col[i3 + 1] = tint.g * b + 0.12 * kk;
      col[i3 + 2] = tint.b * b + 0.28 * kk;
    }
    nebula.geo.attributes.position.needsUpdate = true;
    nebula.geo.attributes.color.needsUpdate = true;
    nebula.mat.size = NEB.size * cdRadius * (1 + beatPulse * 0.35);
    nebula.mat.opacity = (0.75 + beatPulse * 0.25) * nebVis;

    const bandW = NEB.spread * 2 * nebula.R;
    const spacing = Math.sqrt((Math.PI * 2 * nebula.R) * bandW / n);
    const linkD = spacing * NEB.linkSpread, linkD2 = linkD * linkD;
    const cell = linkD;
    const grid = nebula.grid;
    grid.clear();
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const key = (Math.floor(pos[i3] / cell) + 512) * 1048576 +
        (Math.floor(pos[i3 + 1] / cell) + 512) * 1024 + (Math.floor(pos[i3 + 2] / cell) + 512);
      let bucket = grid.get(key);
      if (!bucket) { bucket = []; grid.set(key, bucket); }
      bucket.push(i);
    }
    const lpos = nebula.lpos;
    let seg = 0;
    const keys = Array.from(grid.keys());
    for (let gi = 0; gi < keys.length && seg < NEB.maxLinks; gi++) {
      const key = keys[gi];
      const b0 = grid.get(key);
      const kx = Math.floor(key / 1048576) - 512;
      const ky = (Math.floor(key / 1024) % 1024) - 512;
      const kz = (key % 1024) - 512;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (dx < 0 || (dx === 0 && dy < 0) || (dx === 0 && dy === 0 && dz < 0)) continue;
            const other = grid.get((kx + dx + 512) * 1048576 + (ky + dy + 512) * 1024 + (kz + dz + 512));
            if (!other) continue;
            const same = other === b0;
            for (let ii = 0; ii < b0.length && seg < NEB.maxLinks; ii++) {
              const ia = b0[ii] * 3;
              for (let jj = same ? ii + 1 : 0; jj < other.length && seg < NEB.maxLinks; jj++) {
                const ib = other[jj] * 3;
                const ddx = pos[ia] - pos[ib], ddy = pos[ia + 1] - pos[ib + 1], ddz = pos[ia + 2] - pos[ib + 2];
                if (ddx * ddx + ddy * ddy + ddz * ddz > linkD2) continue;
                const o = seg * 6;
                lpos[o] = pos[ia]; lpos[o + 1] = pos[ia + 1]; lpos[o + 2] = pos[ia + 2];
                lpos[o + 3] = pos[ib]; lpos[o + 4] = pos[ib + 1]; lpos[o + 5] = pos[ib + 2];
                seg++;
              }
            }
          }
        }
      }
    }
    nebula.lgeo.attributes.position.needsUpdate = true;
    nebula.lgeo.setDrawRange(0, seg * 2);
    nebula.lmat.opacity = (0.16 + beatPulse * 0.26) * nebVis;
    if (window.__cd3dDebug) window.__cd3dDebug.links = seg;
  }

  buildNebula();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = now || performance.now();
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    if (document.hidden) return;
    if (pauseWhenIdle) {
      const animating =
        !!driveTween || cdItems.some((it) => it.userData.path || it.userData.spinTween);
      if (!animating) {
        paused = true;
        pauseWhenIdle = false;
      }
    }
    if (!paused) {
      cdItems.forEach((item, i) => {
        const path = item.userData.path;
        if (path) {
          const elapsed = t - path.t0;
          if (elapsed >= 0) {
            let acc = 0;
            let seg = -1;
            let localP = 0;
            for (let s = 0; s < path.durs.length; s++) {
              if (elapsed < acc + path.durs[s]) {
                seg = s;
                localP = (elapsed - acc) / path.durs[s];
                break;
              }
              acc += path.durs[s];
            }
            if (seg === -1) {
              item.group.position.copy(path.points[path.points.length - 1]);
              item.userData.path = null;
              if (item.userData.onPathDone) {
                const cb = item.userData.onPathDone;
                item.userData.onPathDone = null;
                cb();
              }
            } else {
              const from = seg === 0 ? path.from : path.points[seg - 1];
              item.group.position.lerpVectors(from, path.points[seg], easeInOut(localP));
            }
          }
        }

        const st = item.userData.spinTween;
        if (st) {
          const p = Math.min(1, (t - st.t0) / st.dur);
          item.userData.spinAngle = st.from + (st.to - st.from) * easeInOut(p);
          if (p >= 1) {
            item.userData.spinAngle = st.to % 360;
            item.userData.spinTween = null;
            if (st.freezeAfter) item.userData.spinFrozen = true;
          }
        } else if (!item.userData.spinFrozen) {
          const a = (item.userData.spinAngle || 0) + spinNormal * dt;
          item.userData.spinAngle = a % 360;
        }
        item.mesh.rotation.y = flipRotY + rad(item.userData.spinAngle || 0);
      });

      if (driveTween) {
        const el = t - driveTween.t0;
        if (el >= 0) {
          const p = Math.min(1, el / driveTween.dur);
          driveShift = driveTween.from + (driveTween.to - driveTween.from) * driveTween.ease(p);
          if (p >= 1) {
            const cb = driveTween.onDone;
            driveTween = null;
            if (cb) cb();
          }
        }
      }
      if (driveHolder.children.length) {
        driveHolder.position.x = driveBaseX + driveTuck + driveShift;
      }
      if (rideDrive && insertedKey) {
        const ins = cdItems.find((it) => it.key === insertedKey);
        if (ins && !ins.userData.path) {
          ins.group.position.set(slotPoint.x + driveTuck + driveShift, slotPoint.y, slotPoint.z);
        }
      }

      tilt.x += (tiltTarget.x - tilt.x) * 0.1;
      tilt.y += (tiltTarget.y - tilt.y) * 0.1;
      const tiltItem = resolveTiltItem();
      cdItems.forEach((item) => {
        if (item === tiltItem) {
          item.group.rotation.set(rad(tilt.x), rad(tilt.y), 0);
        } else if (item.group.rotation.x !== 0 || item.group.rotation.y !== 0) {
          item.group.rotation.set(0, 0, 0);
        }
      });
      if (window.__cd3dDebug) {
        window.__cd3dDebug.selectedTilt = [+tilt.x.toFixed(2), +tilt.y.toFixed(2)];
        window.__cd3dDebug.hoverKey = hoverIndex >= 0 ? cdItems[hoverIndex].key : null;
        window.__cd3dDebug.tiltedKeys = cdItems
          .filter((it) => it.group.rotation.x !== 0 || it.group.rotation.y !== 0)
          .map((it) => it.key);
        if (tiltItem) {
          window.__cd3dDebug.hoverRot = [
            +tiltItem.group.rotation.x.toFixed(3),
            +tiltItem.group.rotation.y.toFixed(3),
            tiltItem.group.rotation.order
          ];
        }
      }

      const sel = cdItems[selIndex];
      if (window.__cd3dDebug && sel) {
        sel.group.getWorldPosition(tmp);
        tmp.project(camera);
        const r = container.getBoundingClientRect();
        window.__cd3dDebug.selectedScreen = [
          Math.round(((tmp.x + 1) / 2) * r.width),
          Math.round(((1 - tmp.y) / 2) * r.height)
        ];
        try {
          const geo = sel.mesh.geometry;
          if (!geo.boundingSphere) geo.computeBoundingSphere();
          const ws = new THREE.Vector3();
          sel.mesh.getWorldScale(ws);
          const worldR = geo.boundingSphere.radius * Math.max(ws.x, ws.y, ws.z);
          const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
          const cw = sel.group.getWorldPosition(new THREE.Vector3());
          const edge = cw.add(camRight.multiplyScalar(worldR)).project(camera);
          const cx = ((tmp.x + 1) / 2) * r.width;
          const ex = ((edge.x + 1) / 2) * r.width;
          window.__cd3dDebug.selectedScreenR = Math.round(Math.abs(ex - cx));
        } catch (e) { window.__cd3dDebug.selectedScreenR = null; }
        window.__cd3dDebug.wheelRect = [Math.round(r.width), Math.round(r.height)];
        if (insertedKey) {
          const ins = cdItems.find((it) => it.key === insertedKey);
          if (ins) {
            window.__cd3dDebug.insertedPos = [
              +ins.group.position.x.toFixed(3),
              +ins.group.position.y.toFixed(3),
              +ins.group.position.z.toFixed(3)
            ];
            window.__cd3dDebug.insertedArrived =
              slotPoint && ins.group.position.distanceTo(slotPoint) < 0.05;
          }
        }
        window.__cd3dDebug.rackLive = cdItems
          .filter((it) => it.key !== insertedKey)
          .map((it) => [it.key, +it.group.position.x.toFixed(2), +it.group.position.y.toFixed(2)]);
        const rr = container.getBoundingClientRect();
        window.__cd3dDebug.cdScreens = cdItems.map((it) => {
          const v = it.group.position.clone().project(camera);
          return [it.key, Math.round(((v.x + 1) / 2) * rr.width), Math.round(((1 - v.y) / 2) * rr.height)];
        });
        window.__cd3dDebug.driveShift = +driveShift.toFixed(3);
        window.__cd3dDebug.driveTuck = +driveTuck.toFixed(3);
        window.__cd3dDebug.rideDrive = rideDrive;
        window.__cd3dDebug.spacing = +spacing.toFixed(4);
        window.__cd3dDebug.viewH = +viewH.toFixed(4);
        window.__cd3dDebug.spacingRatio = +(spacing / viewH).toFixed(4);
        window.__cd3dDebug.fxOn = fxEnabled;
        window.__cd3dDebug.nebula = nebula ? nebula.pts.visible : false;
        window.__cd3dDebug.beats = beatCount;
        window.__cd3dDebug.beatPulse = +beatPulse.toFixed(3);
      }
    }
    renderer.render(scene, camera);
    if (!paused) fxFrame(dt, true);
  }
  frame();

  function onResize() {
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    fit();
  }
  window.addEventListener("resize", onResize);

  function fxFrame(dt, visible) {
    if (!nebula) return;
    const r = container.getBoundingClientRect();
    const sel = cdItems[selIndex] || cdItems[0];
    const lv = (audio && audio.music && visible && fxEnabled) ? audio.music.levels() : null;
    const world = sel ? sel.group.getWorldPosition(tmp) : null;
    nebula.pts.visible = !!visible && fxEnabled && nebVis > 0.01;
    nebula.lines.visible = nebula.pts.visible;
    if (nebula.pts.visible && world) updateNebula(dt, world, lv);
    nebVarsAge += dt;
    if (sel && world && nebVarsAge > 0.05) {
      nebVarsAge = 0;
      const w = world.clone().project(camera);
      const rackEl = container.parentNode;
      if (rackEl && rackEl.style) {
        rackEl.style.setProperty("--cd-x", (((w.x + 1) / 2) * r.width).toFixed(1) + "px");
        rackEl.style.setProperty("--cd-y", (((1 - w.y) / 2) * r.height).toFixed(1) + "px");
        rackEl.style.setProperty("--cd-r", (cdRadius * (r.height / viewH)).toFixed(1) + "px");
        rackEl.style.setProperty("--cd-pulse", (lv ? lv.level || 0 : 0).toFixed(3));
        rackEl.style.setProperty("--cd-bass", (lv ? lv.bass || 0 : 0).toFixed(3));
        try {
          const mw = sel.group.matrixWorld;
          const e1 = new THREE.Vector3().setFromMatrixColumn(mw, 0).normalize().multiplyScalar(cdRadius);
          const e2 = new THREE.Vector3().setFromMatrixColumn(mw, 1).normalize().multiplyScalar(cdRadius);
          const p0 = world.clone().project(camera);
          const p1 = world.clone().add(e1).project(camera);
          const p2 = world.clone().add(e2).project(camera);
          const sx2 = r.width / 2, sy2 = r.height / 2;
          const v1x = (p1.x - p0.x) * sx2, v1y = -(p1.y - p0.y) * sy2;
          const v2x = (p2.x - p0.x) * sx2, v2y = -(p2.y - p0.y) * sy2;
          rackEl.style.setProperty("--cd-ax", v1x.toFixed(2) + "px");
          rackEl.style.setProperty("--cd-ay", v1y.toFixed(2) + "px");
          rackEl.style.setProperty("--cd-bx", v2x.toFixed(2) + "px");
          rackEl.style.setProperty("--cd-by", v2y.toFixed(2) + "px");
        } catch (e) {}
      }
    }
  }

  const api = {
    setSelection(i, silent) {
      selIndex = i;
      place(i, false, silent);
    },
    audio: audio,
    nebula: function () { return nebula ? nebula.pts : null; },
    setFxColor(hex) {
      try { nebTint.set(hex || "#22d3ee"); } catch (e) {}
    },
    setFxMode() { },
    setNebulaVisibility(v) { nebVis = Math.max(0, Math.min(1, +v || 0)); },
    fxModes() { return null; },
    setFxEnabled(v) {
      fxEnabled = !!v;
      if (window.__cd3dDebug) window.__cd3dDebug.fxOn = fxEnabled;
      if (nebula) nebula.pts.visible = fxEnabled;
    },
    fxOn() { return fxEnabled; },
    cdRadius() { return cdRadius; },
    setMusicPreview(v) { previewAllowed = !!v; },
    previewCurrent() {
      if (!previewAllowed) return;
      const it = cdItems[selIndex];
      if (audio && it) audio.music.preview(it.key);
    },
    setInserted(key) {
      setInserted(key);
    },
    ejectDrive(cb) {
      ejectDrive(cb);
    },
    retractDrive(cb) {
      retractDrive(cb);
    },
    insertCd(key, cb) {
      insertCd(key, cb);
    },
    isDriveOut() {
      return driveShift <= -driveDist * 0.5;
    },
    resetDrive() {
      resetDrive();
    },
    timings: {
      insert: spinBackMs + 60 + flyMs + settleMs,
      eject: 160 + flyMs + settleMs,
      rackMove: rackMoveMs,
      driveEjectDelay: ejectDelayMs,
      driveEject: ejectMs,
      driveInsert: spinBackMs + 60 + 280 + dropMs + 180,
      driveRetract: retractMs2 + retractPauseMs + retractSnapMs
    },
    setPaused(p) {
      if (p) {
        pauseWhenIdle = true;
      } else {
        pauseWhenIdle = false;
        paused = false;
      }
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };

  const sampleMat = (() => {
    let mat = null;
    cdItems[0].mesh.traverse((o) => {
      if (!mat && o.isMesh && o.material) {
        mat = Array.isArray(o.material) ? o.material[0] : o.material;
      }
    });
    return mat
      ? {
          type: mat.type,
          metalness: mat.metalness,
          roughness: mat.roughness,
          clearcoat: mat.clearcoat,
          iridescence: mat.iridescence,
          anisotropy: mat.anisotropy
        }
      : null;
  })();

  window.__cd3dDebug = {
    driveFound: !!driveNode,
    driveNodeName: m.driveNode || null,
    driveSize: [dSize.x, dSize.y, dSize.z].map((v) => +v.toFixed(3)),
    cdCount: cdItems.length,
    cdNames: cdItems.map((c) => c.key),
    cdOrderY: cdItems.map((c) => +c.group.position.y.toFixed(3)),
    cdFlipDeg: m.cdFlipDeg != null ? m.cdFlipDeg : 180,
    cdMaterialSample: sampleMat,
    internalDiscFound: !!internalDisc,
    insertedKey: insertedKey,
    slotPoint: [slotPoint.x, slotPoint.y, slotPoint.z].map((v) => +v.toFixed(3)),
    slotTarget: slotTargetVec ? [slotTargetVec.x, slotTargetVec.y, slotTargetVec.z].map((v) => +v.toFixed(3)) : null,
    spinNormalDegPerSec: spinNormal,
    cdDiameter: +cdDiameter.toFixed(3),
    spacing: +spacing.toFixed(3),
    insertDistance: +R.toFixed(3),
    curve: curve,
    viewHeight: +viewH.toFixed(3),
    camera: { x: +baseCam.x.toFixed(3), y: +baseCam.y.toFixed(3), z: +baseCam.z.toFixed(3), fov: fov }
  };

  if (opts.onReady) opts.onReady(api);
  return api;
}

async function probe(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch (e) {
    return false;
  }
}
