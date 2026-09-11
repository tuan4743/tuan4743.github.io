/* ============================================================
   CD 架 Three.js 模块(lazy 加载;资产缺失时返回 null → DOM 降级)
   接口:initCd3d({ container, selIndex, onReady, onCdClick, onScroll })
   所有可调参数来自 /assets/cd/manifest.json(改配置即可,无需改代码)
   ============================================================ */

const BASE = "/assets/cd/";
const CD_ORDER = ["self", "growth", "lost", "tech", "future"];
const rad = (d) => (d * Math.PI) / 180;

export async function initCd3d(opts) {
  const container = opts.container;
  if (!container) return null;
  const report = (p, label) => {
    if (opts.onProgress) opts.onProgress(Math.max(0, Math.min(100, Math.round(p))), label || "");
  };
  report(3, "读取配置");

  /* 1. 接口契约(失败时给出明确原因,不再静默降级) */
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

  /* 2. 懒加载 three */
  let THREE, GLTFLoader, RoomEnvironment;
  report(10, "加载渲染引擎");
  try {
    THREE = await import("three");
    ({ GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"));
    ({ RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js"));
  } catch (e) {
    console.error("[cd3d] three.js 模块加载失败(检查 /vendor/three/ 下文件是否完整):", e && e.message);
    return null;
  }

  /* 3. 渲染器 / 场景 / 相机 */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
  renderer.domElement.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:auto;";
  container.appendChild(renderer.domElement);
  /* 电影级色调映射:高光/金属更有物理感 */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = m.exposure != null ? m.exposure : 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 400);

  /* 环境反射(PMREM)
     - studio(默认):自建"摄影棚"环境 —— 右侧大柔光(屏幕光)+ 左侧微弱补光 + 暗背景
       反射连贯,不会出现房间里的矩形灯板
     - room:Three.js RoomEnvironment(天花/墙上有矩形发光板,会在盘面反射出方块) */
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
      /* 右侧主柔光(与场景里的"屏幕光"方向一致) */
      addPanel(S.keyColor || 0xd8ecff, S.keyIntensity != null ? S.keyIntensity : 3.2, [4, 2, 3], [6, 6]);
      /* 左侧微弱补光 */
      addPanel(S.fillColor || 0x5a6a86, S.fillIntensity != null ? S.fillIntensity : 0.5, [-5, 0.5, 1.5], [5, 5]);
      /* 顶部极弱环境光,避免暗部死黑 */
      addPanel(S.topColor || 0x2a3244, S.topIntensity != null ? S.topIntensity : 0.35, [0, 5, 0], [8, 8]);
    }
    const envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = envRT.texture;
    if ("environmentIntensity" in scene) {
      scene.environmentIntensity = m.envIntensity != null ? m.envIntensity : 0.7;
    }
    pmrem.dispose();
  } catch (e) {}

  const L = m.light || {};
  const sun = new THREE.DirectionalLight(L.color || 0xbfe6ff, L.intensity || 1.7);
  sun.position.fromArray(L.position || [3.2, 2.4, 2.6]);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b1f27, 0.45));
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  /* 4. 加载整机(带进度上报) */
  let gltf;
  try {
    report(18, "下载 3D 模型");
    gltf = await new Promise((res, rej) =>
      new GLTFLoader().load(
        m.model,
        res,
        (xhr) => {
          if (xhr && xhr.total) {
            report(18 + (xhr.loaded / xhr.total) * 70, "下载 3D 模型");
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
  report(90, "组装场景");
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  scene.add(root);

  /* 5. 每张 CD:位置/倾斜组 → 立正组 → 盘面(盘面自身可再平面内旋转 180° 校正贴图) */
  const cdHolder = new THREE.Group();
  root.add(cdHolder);
  const cdItems = [];
  const standRotX = rad(m.cdStandRotX != null ? m.cdStandRotX : 90);
  const flipRotY = rad(m.cdFlipDeg != null ? m.cdFlipDeg : 180);

  CD_ORDER.forEach((key) => {
    const name = (m.cdNodes && m.cdNodes[key]) || (m.cds && m.cds[key] && m.cds[key].mesh) || key;
    const node = root.getObjectByName(name);
    if (!node) return;
    const g = new THREE.Group();       /* 位置 + 鼠标倾斜 */
    g.rotation.order = "YXZ";          /* 先偏航(绕竖轴)再俯仰(绕横轴),斜向移动也不会歪轴 */
    const stand = new THREE.Group();   /* 立正 */
    cdHolder.add(g);
    g.add(stand);
    stand.attach(node);                /* 保持世界变换 */
    stand.rotation.set(standRotX, 0, 0);
    node.rotation.set(0, flipRotY, 0); /* 盘面在自身法线轴上转 180°,校正贴图方向 */
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
  const cdR = Math.max(cdSize.x, cdSize.y) / 2 || 1;   /* 盘半径(模型单位) */
  const cdDiameter = cdR * 2;

  /* 5b. CD 物理材质升级:GLB 里 CD 是 metallic=0 / roughness=0 的纯光滑电介质,
         只有镜面反射;补上 金属度 + 粗糙度 + 清漆 + 薄膜虹彩(CD 彩虹光)+ 各向异性 */
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
        /* 有贴图时系数默认 1(不削弱烘焙贴图);显式配置则作为乘数 */
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
      /* 各向异性需要切线数据 */
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

  /* 6. 光驱:先挂载 → 施加 driveRot → 包围盒中心对位到 hub + driveOffset */
  const driveHolder = new THREE.Group();
  root.add(driveHolder);
  const driveNode = root.getObjectByName(m.driveNode || "");
  if (driveNode) driveHolder.attach(driveNode);
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

  /* 6b. 自动识别光驱内部的 CD 网格:作为「插入落点」,并隐藏它(改由真实 CD 飞入) */
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
      internalDisc.visible = false;          /* 隐藏模型自带的盘,槽位留给真实盘 */
    }
  })();

  /* 7. 布局与取景
        - 可视高度 = 光驱高度 ÷ driveHeightFraction(默认光驱占 50% 屏高)
        - CD 间距按「实际间距」排布(默认 = 盘径 × 1.34),沿轻微弧线向 hub 收拢
        - 选中盘距 hub 的距离 = 插入行程(默认 = 盘径 × 1.6)
        - 光驱右缘 + driveRightMargin 与画布右缘对齐(负值 = 更靠右) */
  const cdZ = m.cdZ != null ? m.cdZ : 0;
  const fov = (m.camera && m.camera.fov) || 30;
  const driveHFrac = m.driveHeightFraction != null ? m.driveHeightFraction : 0.5;
  const viewH = dSize.y > 0 ? dSize.y / driveHFrac : 10;
  /* 间距与插入行程默认按「可视高度」比例推导:改变整体大小(driveHeightFraction)时,
     间距/露出比例自动跟随,不会因为放大而把相邻盘挤出屏幕 */
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

  /* 8. 排列与补间
        - 架位:已插入的 CD 不占位,其余盘自动补齐(不留空档)
        - 移动:多段路径补间(基于时间,与帧率无关) */
  let selIndex = opts.selIndex || 0;
  let insertedKey = null;          /* 刷新后光驱内为空(不自动插入上次的主题盘) */
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

  /* ---------- 光驱弹出 / 收回 ----------
     静止(已插入)= 向右缩进机器里一个身位(被接缝挡住)
     弹出       = 向左移动一个身位,停在与动画前完全相同的位置(右缘贴接缝) */
  const driveDist = m.driveEjectDist != null ? m.driveEjectDist : dSize.x;
  const driveTuck = driveDist;              /* 静止时缩进的距离 */
  const driveBaseX = driveHolder.position.x;   /* 动画前的位置 = 弹出位 */
  const ejectMs = m.driveEjectMs != null ? m.driveEjectMs : 620;
  const dropHeight = m.cdDropHeight != null ? m.cdDropHeight : 3.4;
  const dropMs = m.cdDropMs != null ? m.cdDropMs : 720;
  const retractMs2 = m.retractMs != null ? m.retractMs : 620;
  const retractPauseMs = m.retractPauseMs != null ? m.retractPauseMs : 260;
  const retractSnapMs = m.retractSnapMs != null ? m.retractSnapMs : 170;
  const ejectDelayMs = m.driveEjectDelayMs != null ? m.driveEjectDelayMs : 1000;

  let driveShift = 0;          /* 0 = 归位;负值 = 已弹出 */
  let driveTween = null;
  let rideDrive = false;       /* 已插入的盘随光驱一起进退 */
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

  /* 架上现有盘(排除已插入的),按顺序补齐 */
  function rackList() {
    return cdItems.filter((it) => it.key !== insertedKey);
  }
  function rackTargetFor(item) {
    const list = rackList();
    /* 以 centerKey 为架位中心(它在架上时);它被插入光驱时,顺延到仍在架上的下一张,
       避免抽盘/放盘时整排跳回第一张 */
    let centerItem = cdItems.find((it) => it.key === centerKey && it.key !== insertedKey);
    if (!centerItem) {
      /* 中心盘被插入光驱时,向外找最近的仍在架上的盘(不取模,避免跳回第一张) */
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

  function place(idx, instant) {
    selIndex = idx;
    if (cdItems[idx]) centerKey = cdItems[idx].key;
    cdItems.forEach((item) => {
      if (item.key === insertedKey) return;      /* 已插入的盘不入架 */
      moveToRack(item, instant);
      if (item !== cdItems[idx]) item.group.rotation.set(0, 0, 0);   /* 非选中盘不倾斜 */
    });
    if (window.__cd3dDebug) window.__cd3dDebug.selIndex = idx;
  }
  place(selIndex, true);
  /* 初始态:插入的盘直接落在槽位 */
  if (insertedKey) {
    const ins = cdItems.find((it) => it.key === insertedKey);
    if (ins) {
      ins.group.position.copy(slotPoint);
      ins.userData.spinFrozen = true;
    }
  }

  /* 插入 / 拔出:
     - 插入:目标盘先自转归正 → 上移 → 飞入 → 下移到位;其余盘**等飞行结束再补位**(避免穿模)
     - 拔出:其余盘先让位,旧盘再飞回自己的架位 */
  function setInserted(key) {
    const prevInserted = insertedKey;
    insertedKey = key;
    rideDrive = false;
    const insertTotal = spinBackMs + 60 + flyMs + settleMs;   /* 插入飞行总时长 */
    const ejectTotal = 160 + flyMs + settleMs;                /* 拔出飞行总时长 */

    cdItems.forEach((item) => {
      if (item.key === key) {
        /* 1) 快速转回原方向(最短路径),之后冻结自转 */
        const cur = item.userData.spinAngle || 0;
        const delta = ((-cur % 360) + 540) % 360 - 180;
        item.userData.spinTween = {
          from: cur,
          to: cur + delta,
          t0: performance.now(),
          dur: spinBackMs,
          freezeAfter: true
        };
        /* 2) 三段路径:上移 → 飞入 → 下移到位 */
        const from = item.group.position.clone();
        const p1 = new THREE.Vector3(from.x, slotPoint.y + riseY, from.z);
        const p2 = new THREE.Vector3(slotPoint.x, slotPoint.y + riseY, slotPoint.z);
        const p3 = slotPoint.clone();
        setPath(item, [p1, p2, p3], [spinBackMs + 60, flyMs, settleMs], 0);
        item.userData.path.points[0].z = from.z;
        return;
      }
      if (item.key === prevInserted) {
        /* 旧盘拔出:先让架上其他盘让位,再沿原路返回 */
        item.userData.spinFrozen = false;
        const tgt = rackTargetFor(item);
        const p1 = new THREE.Vector3(item.group.position.x, slotPoint.y + riseY, item.group.position.z);
        const p2 = new THREE.Vector3(tgt.x, tgt.y + riseY, tgt.z);
        setPath(item, [p1, p2, tgt], [160, flyMs, settleMs], 260);
        return;
      }
      /* 其余盘:插入完成后补位;拔出时立即让位 */
      setPath(
        item,
        [rackTargetFor(item)],
        [rackMoveMs],
        key ? insertTotal + 40 : 0
      );
    });
    if (window.__cd3dDebug) window.__cd3dDebug.insertedKey = key;
  }

  /* ---------- 新流程:光驱弹出 → CD 从上方落入 → CD+光驱一起插回 ---------- */
  function ejectDrive(cb) {
    if (driveShift <= -driveTuck + 0.001) {          /* 已经弹出 */
      if (cb) cb();
      return;
    }
    animateDrive(-driveTuck, ejectMs, easeOutBack, 0, cb);
  }

  function retractDrive(cb) {
    const from = driveShift;
    if (from >= -0.001) {                            /* 已在机内 */
      if (cb) cb();
      return;
    }
    const toPause = from * 0.12;                 /* 收到最后一点点 */
    animateDrive(toPause, retractMs2, easeInOut, 0, function () {
      /* 停顿一下 → 干脆地插回(模拟真实光驱) */
      animateDrive(0, retractSnapMs, easeInOut, retractPauseMs, cb);
    });
  }

  /* CD 从上方落入弹出后的槽口;完成后随光驱一起进退 */
  function insertCd(key, cb) {
    const item = cdItems.find((it) => it.key === key);
    if (!item) {
      if (cb) cb();
      return;
    }
    /* 若机内已有旧盘:先让它飞回自己的架位 */
    const prev = insertedKey;
    if (prev && prev !== key) {
      const old = cdItems.find((it) => it.key === prev);
      if (old) {
        old.userData.spinFrozen = false;
        setPath(old, [rackTargetFor(old)], [700], 0);
      }
    }
    rideDrive = false;
    /* 1) 自转快速归正 */
    const cur = item.userData.spinAngle || 0;
    const delta = ((-cur % 360) + 540) % 360 - 180;
    item.userData.spinTween = {
      from: cur,
      to: cur + delta,
      t0: performance.now(),
      dur: spinBackMs,
      freezeAfter: true
    };
    /* 2) 路径:从架位抬出画外 → 移到槽口正上方 → 落入槽口 */
    const slotNow = new THREE.Vector3(slotPoint.x + driveTuck + driveShift, slotPoint.y, slotPoint.z);
    const from = item.group.position.clone();
    const p1 = new THREE.Vector3(from.x, slotPoint.y + dropHeight, from.z);
    const p2 = new THREE.Vector3(slotNow.x, slotNow.y + 0.3, slotNow.z);
    const p3 = slotNow.clone();
    setPath(item, [p1, p2, p3], [280, dropMs, 180], spinBackMs + 60);
    item.userData.onPathDone = function () {
      rideDrive = true;                          /* 之后随光驱一起进退 */
      insertedKey = key;
      if (window.__cd3dDebug) window.__cd3dDebug.insertedKey = key;
      /* 其余盘补位(飞完之后才动,避免穿模) */
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

  /* 9. 交互:屏幕空间拾取(盘面为环状几何,中心镂空)+ 滚轮 + 选中盘随鼠标倾斜 */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tilt = { x: 0, y: 0 };
  const tiltTarget = { x: 0, y: 0 };
  const TILT_MAX = m.tiltMaxDeg != null ? m.tiltMaxDeg : 14;
  /* 方向系数:鼠标向右 → 盘面向右转;鼠标向上 → 盘面上仰(可反号) */
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
  /* 倾斜目标模式:selected = 只有当前选中的那张随鼠标倾斜(鼠标在架子内任意位置都生效);
                   hover    = 鼠标靠近/压在哪张,哪张倾斜 */
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
    /* yaw:鼠标在盘心右侧 → 盘面向右转;pitch:鼠标在盘心上方 → 盘面上仰 */
    tiltTarget.y = cx * TILT_MAX * tiltYawSign;
    tiltTarget.x = cy * TILT_MAX * tiltPitchSign;
  }

  function onPointerMove(e) {
    hoverIndex = pickIndexAt(e.clientX, e.clientY);   /* 供点击/调试使用 */
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
  /* 滚轮:一次手势只走一张,滚动动画期间忽略 */
  const wheelCooldownMs = m.wheelCooldownMs != null ? m.wheelCooldownMs : rackMoveMs + 80;
  let lastWheelAt = 0;
  function onWheel(e) {
    const now = performance.now();
    if (now - lastWheelAt < wheelCooldownMs) return;
    if (cdItems.some((it) => it.userData.path || it.userData.spinTween)) return;  /* 动画中无效 */
    lastWheelAt = now;
    if (opts.onScroll) opts.onScroll(e.deltaY > 0 ? 1 : -1);
  }

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: true });

  /* 10. 渲染循环 */
  let raf = 0;
  let paused = false;
  let pauseWhenIdle = false;
  const tmp = new THREE.Vector3();
  let lastT = performance.now();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = now || performance.now();
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    if (document.hidden) return;
    if (pauseWhenIdle) {
      /* 等所有补间(含光驱)结束再真正暂停,避免动画停在半路 */
      const animating =
        !!driveTween || cdItems.some((it) => it.userData.path || it.userData.spinTween);
      if (!animating) {
        paused = true;
        pauseWhenIdle = false;
      }
    }
    if (!paused) {
      cdItems.forEach((item, i) => {
        /* 位置:多段路径补间(累计时间表,无分段漂移,与帧率无关) */
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

        /* 自转:所有架上的盘同速;插入的盘冻结;确认时先快速转回 0 */
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

      /* 光驱弹出/收回位移 */
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
        driveHolder.position.x = driveBaseX + driveTuck + driveShift;   /* 静止 = 缩进机内 */
      }
      /* 已插入的盘随光驱一起进退 */
      if (rideDrive && insertedKey) {
        const ins = cdItems.find((it) => it.key === insertedKey);
        if (ins && !ins.userData.path) {
          ins.group.position.set(slotPoint.x + driveTuck + driveShift, slotPoint.y, slotPoint.z);
        }
      }

      /* 倾斜:按模式决定倾斜哪一张(默认只有当前选中的那张) */
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
        /* 架上各盘的实时位置(验证滚轮平滑 / 空位补齐) */
        window.__cd3dDebug.rackLive = cdItems
          .filter((it) => it.key !== insertedKey)
          .map((it) => [it.key, +it.group.position.x.toFixed(2), +it.group.position.y.toFixed(2)]);
        /* 各盘的屏幕坐标(便于精确验证悬停/点击) */
        const rr = container.getBoundingClientRect();
        window.__cd3dDebug.cdScreens = cdItems.map((it) => {
          const v = it.group.position.clone().project(camera);
          return [it.key, Math.round(((v.x + 1) / 2) * rr.width), Math.round(((1 - v.y) / 2) * rr.height)];
        });
        window.__cd3dDebug.driveShift = +driveShift.toFixed(3);
        window.__cd3dDebug.driveTuck = +driveTuck.toFixed(3);
        window.__cd3dDebug.rideDrive = rideDrive;
      }
    }
    renderer.render(scene, camera);
  }
  frame();

  function onResize() {
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    fit();
  }
  window.addEventListener("resize", onResize);

  const api = {
    setSelection(i) {
      selIndex = i;
      place(i, false);
    },
    /* 让真实选中的 CD 飞入/飞出光驱(P2-lite:无需烘焙动画) */
    setInserted(key) {
      setInserted(key);
    },
    /* 光驱弹出 / 收回;CD 从上方落入 */
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
      return driveShift < -0.001;
    },
    resetDrive() {
      resetDrive();
    },
    /* 动画实际时长,供状态机对齐面板切换时机 */
    timings: {
      insert: spinBackMs + 60 + flyMs + settleMs,
      eject: 160 + flyMs + settleMs,
      rackMove: rackMoveMs,
      driveEjectDelay: ejectDelayMs,
      driveEject: ejectMs,
      driveInsert: spinBackMs + 60 + 280 + dropMs + 180,
      driveRetract: retractMs2 + retractPauseMs + retractSnapMs
    },
    /* 收起架子时:等当前动画跑完再真正暂停,避免停在半空 */
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

  /* 调试信息(控制台 / 自动化验证) */
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
