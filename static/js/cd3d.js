/* ============================================================
   CD 架 Three.js 模块(lazy 加载;资产缺失时返回 null → DOM 降级)
   接口:initCd3d({ container, onReady, onSelect, onConfirm, onScroll })
   ============================================================ */

const BASE = "/assets/cd/";
const ORBIT_STEP_DEG = 22;   /* 相邻 CD 角度,与 DOM 版一致 */

export async function initCd3d(opts) {
  const container = opts.container;
  if (!container) return null;

  /* 1. 读取接口契约;缺失则降级 */
  let manifest;
  try {
    const r = await fetch(BASE + "manifest.json", { cache: "no-cache" });
    if (!r.ok) return null;
    manifest = await r.json();
  } catch (e) {
    return null;
  }

  const modelOk = await probe(manifest.model);
  if (!modelOk) return null;

  /* 2. 懒加载 three 与加载器 */
  let THREE, GLTFLoader;
  try {
    THREE = await import("three");
    ({ GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"));
  } catch (e) {
    return null;
  }

  /* 3. 场景搭建 */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.domElement.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:auto;";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    26,
    container.clientWidth / container.clientHeight,
    0.01,
    100
  );
  camera.position.set(0, 0, 2.2);

  /* 灯光:默认"屏幕光从右照向 CD 架",可用 manifest.light 覆盖 */
  const L = manifest.light || {};
  const sun = new THREE.DirectionalLight(
    L.color || 0xbfe6ff,
    L.intensity || 1.6
  );
  sun.position.set(L.position ? L.position[0] : 2.2, L.position ? L.position[1] : 1.6, L.position ? L.position[2] : -1.8);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x20242c, 0.5));

  /* 4. 加载整机模型 */
  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load(manifest.model, resolve, undefined, reject);
  });
  const root = gltf.scene;
  scene.add(root);

  /* 收集 CD 网格 */
  const cdMeshes = [];
  const cdOrder = ["self", "growth", "lost", "tech", "future"];
  for (const key of cdOrder) {
    const entry = manifest.cds && manifest.cds[key];
    if (!entry) continue;
    const mesh = root.getObjectByName(entry.mesh);
    if (!mesh) continue;
    mesh.userData.cdKey = key;
    /* 盘面标签贴图(可选) */
    if (entry.tex) {
      try {
        const r = await fetch(entry.tex, { cache: "no-cache" });
        if (r.ok) {
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          new THREE.TextureLoader().load(url, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            mesh.traverse((obj) => {
              if (obj.isMesh) {
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach((m) => {
                  if (m.map) {
                    m.map = tex;
                    m.needsUpdate = true;
                  }
                });
              }
            });
          });
        }
      } catch (e) {}
    }
    cdMeshes.push(mesh);
  }
  if (!cdMeshes.length) {
    renderer.dispose();
    container.removeChild(renderer.domElement);
    return null;
  }

  /* 5. 轮盘:CD 绕 hub(插入点)排列,选中位位于 hub 正左 */
  const hub = new THREE.Vector3().fromArray(manifest.hub || [0, 0, 0]);
  const R = manifest.cdOrbitRadius || 0;
  const cdGroup = new THREE.Group();
  root.add(cdGroup);
  cdMeshes.forEach((mesh) => {
    cdGroup.add(mesh);
    mesh.position.set(0, 0, 0);
  });

  const rad = function (deg) { return (deg * Math.PI) / 180; };

  function place(selIndex, instant, ease) {
    cdMeshes.forEach((mesh, i) => {
      const deg = 180 - (i - selIndex) * ORBIT_STEP_DEG;
      const x = hub.x + R * Math.cos(rad(deg));
      const y = hub.y + R * Math.sin(rad(deg));
      mesh.position.x = x;
      mesh.position.y = y;
      mesh.rotation.z = rad(180 - deg) * 0;  /* 盘面立正(如模型初始即立正则无需) */
      /* 选中高亮 */
      const sel = i === selIndex;
      mesh.traverse((obj) => {
        if (obj.isMesh) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            m.emissive = m.emissive || new THREE.Color(0x000000);
            m.emissiveIntensity = sel ? 0.18 : 0.0;
          });
        }
      });
    });
  }
  place(opts.selIndex || 0, true);

  /* 6. 交互:射线点击 + 滚轮 + 鼠标视差 */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let parallax = { x: 0, y: 0 };
  let target = { x: 0, y: 0 };

  function onPointerMove(e) {
    const r = container.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
    target.y = ((e.clientY - r.top) / r.height - 0.5) * 0.35;
  }

  function onPointerLeave() {
    target.x = 0;
    target.y = 0;
  }

  function onPointerDown(e) {
    const r = container.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(cdGroup.children, true);
    if (hits.length && opts.onCdClick) {
      let obj = hits[0].object;
      while (obj && !obj.userData.cdKey) obj = obj.parent;
      if (obj) opts.onCdClick(obj.userData.cdKey);
    }
  }

  function onWheel(e) {
    if (opts.onScroll) opts.onScroll(e.deltaY > 0 ? 1 : -1);
  }

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: true });

  /* 7. 渲染循环 */
  let raf = 0;
  let paused = false;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (paused || document.hidden) return;
    parallax.x += (target.x - parallax.x) * 0.08;
    parallax.y += (target.y - parallax.y) * 0.08;
    camera.position.x = parallax.x * 0.35;
    camera.position.y = parallax.y * 0.25 + hub.y * 0;
    camera.lookAt(hub.x * 0.35, hub.y * 0.5, 0);
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", onResize);
  function onResize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const api = {
    setSelection(i) { place(i); },
    setPaused(p) { paused = p; },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    }
  };

  frame();
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
