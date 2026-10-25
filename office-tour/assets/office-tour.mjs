import { OFFICE_CONFIG } from "./office-config.mjs";
import { movePlayer, roomAt } from "./office-tour-core.mjs";

const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);
const startButton = byId("start-tour");
const status = byId("load-status");
const stage = byId("tour-stage");
const canvasHost = byId("canvas-host");
const toolbar = byId("tour-toolbar");
const errorBox = byId("tour-error");
const infoPanel = byId("room-info");
const mapPanel = byId("tour-map");
const roomGuide = byId("fallback-rooms");
const mapRooms = OFFICE_CONFIG.rooms.filter((room) => room.id !== "market");
let tour = null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function renderFallbackGuide() {
  roomGuide.innerHTML = OFFICE_CONFIG.rooms.map((room) => `
    <article class="office-tour-room-guide__card">
      <strong>${escapeHtml(room.name)}</strong>
      ${room.residents?.length ? `<span class="office-tour-room-guide__residents">${escapeHtml(room.residents.join("・"))}</span>` : ""}
      <span>${escapeHtml(room.description)}</span>
      ${room.link ? `<a href="..${escapeHtml(room.link)}">${escapeHtml(room.linkLabel ?? "関連ページを見る")} →</a>` : ""}
    </article>`).join("");
}

function renderMapDestinations() {
  byId("map-destinations").innerHTML = mapRooms.map((room) => `
    <button type="button" data-map-destination="${escapeHtml(room.id)}">${escapeHtml(room.shortName)}</button>`).join("");
}

renderFallbackGuide();
renderMapDestinations();

startButton.addEventListener("click", async () => {
  if (tour) {
    stage.hidden = false;
    toolbar.hidden = false;
    tour.resume();
    stage.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  startButton.disabled = true;
  status.textContent = "3Dオフィスを準備しています…";
  errorBox.hidden = true;
  try {
    const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js");
    tour = createTour(THREE);
    startButton.textContent = "ツアーを再表示";
    startButton.disabled = false;
    status.textContent = "操作中は画面をクリックしてマウス視点を有効にできます。";
    stage.hidden = false;
    toolbar.hidden = false;
    stage.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch (error) {
    console.error("MMC OFFICE TOUR could not start", error);
    status.textContent = "3D表示を開始できませんでした。お使いのブラウザーと接続を確認してください。";
    errorBox.innerHTML = "3D表示の読み込みに失敗しました。下のエリア案内は引き続きご利用いただけます。時間をおいて再試行するか、WebGLに対応したブラウザーでお試しください。";
    errorBox.hidden = false;
    startButton.disabled = false;
  }
});

function createTour(THREE) {
  const { scene, camera, renderer, colliders, hotspots } = createWorld(THREE);
  canvasHost.replaceChildren(renderer.domElement);
  const position = { ...OFFICE_CONFIG.start };
  let yaw = 0;
  let pitch = 0;
  let speedScale = 1;
  let lastTime = 0;
  let locationId = "";
  const keys = new Set();
  const joystick = { active: false, pointerId: null, x: 0, y: 0, originX: 0, originY: 0 };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const isTouch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  camera.position.set(position.x, 1.65, position.z);
  camera.rotation.order = "YXZ";

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  renderer.setClearColor(0xdbcbb2, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const resizeObserver = new ResizeObserver(() => {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(stage);

  function rotate(dx, dy) {
    yaw -= dx * 0.0028;
    pitch = Math.max(-0.72, Math.min(0.72, pitch - dy * 0.0025));
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  }

  function hitHotspot(clientX, clientY, center = false) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(center ? 0 : ((clientX - rect.left) / rect.width) * 2 - 1,
      center ? 0 : -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const target = raycaster.intersectObjects(hotspots, false)[0]?.object;
    if (!target) return false;
    const room = OFFICE_CONFIG.rooms.find((item) => item.id === target.userData.roomId);
    if (room) showRoomInfo(room, target.userData.pointText);
    return true;
  }

  function updateMap() {
    const x = Math.max(28, Math.min(392, 210 + (position.x / 14.5) * 182));
    const y = Math.max(28, Math.min(542, 520 - ((20 - position.z) / 43.5) * 436));
    byId("map-player").setAttribute("cx", x.toFixed(1));
    byId("map-player").setAttribute("cy", y.toFixed(1));
    const room = roomAt(position.x, position.z);
    const name = room?.name ?? "中央廊下";
    byId("current-location").textContent = name;
    byId("map-current-location").textContent = name;
    document.querySelectorAll("[data-map-area]").forEach((node) => {
      node.classList.toggle("is-current", node.dataset.mapArea === room?.id);
    });
    if (room?.id !== locationId) {
      locationId = room?.id ?? "";
      if (room) byId("scene-tip").textContent = `現在地：${room.name}。案内ポイントをタップすると、このエリアについて読めます。`;
    }
  }

  function teleport(room) {
    const spawn = room.spawn;
    if (!spawn) return;
    position.x = spawn.x;
    position.z = spawn.z;
    camera.position.set(position.x, 1.65, position.z);
    closeRoomInfo();
    updateMap();
    mapPanel.hidden = true;
    byId("map-toggle").setAttribute("aria-expanded", "false");
    byId("scene-tip").textContent = `${room.name}へ移動しました。案内ポイントを探してみてください。`;
  }

  document.addEventListener("keydown", (event) => {
    if (stage.hidden) return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
      keys.add(key);
    }
  });
  document.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  renderer.domElement.addEventListener("click", (event) => {
    hitHotspot(event.clientX, event.clientY, document.pointerLockElement === renderer.domElement);
    if (!isTouch && document.pointerLockElement !== renderer.domElement && renderer.domElement.requestPointerLock) {
      renderer.domElement.requestPointerLock();
    }
  });
  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement === renderer.domElement) rotate(event.movementX, event.movementY);
  });

  const lookZone = byId("touch-look-zone");
  let lookPointer = null;
  let lookStart = null;
  lookZone.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    lookPointer = event.pointerId;
    lookStart = { x: event.clientX, y: event.clientY, moved: false };
    lookZone.setPointerCapture(event.pointerId);
  });
  lookZone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== lookPointer || !lookStart) return;
    const dx = event.clientX - lookStart.x;
    const dy = event.clientY - lookStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) lookStart.moved = true;
    rotate(dx, dy);
    lookStart.x = event.clientX;
    lookStart.y = event.clientY;
  });
  lookZone.addEventListener("pointerup", (event) => {
    if (event.pointerId !== lookPointer) return;
    if (lookStart && !lookStart.moved) hitHotspot(event.clientX, event.clientY);
    lookPointer = null;
    lookStart = null;
  });
  lookZone.addEventListener("pointercancel", () => { lookPointer = null; lookStart = null; });

  const joystickElement = byId("joystick");
  const knob = byId("joystick-knob");
  function updateJoystick(event) {
    const rect = joystickElement.getBoundingClientRect();
    const radius = rect.width * 0.31;
    const dx = event.clientX - joystick.originX;
    const dy = event.clientY - joystick.originY;
    const length = Math.hypot(dx, dy);
    const scale = length > radius ? radius / length : 1;
    joystick.x = (dx * scale) / radius;
    joystick.y = (dy * scale) / radius;
    knob.style.transform = `translate(calc(-50% + ${dx * scale}px), calc(-50% + ${dy * scale}px))`;
  }
  joystickElement.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    joystick.active = true;
    joystick.pointerId = event.pointerId;
    const rect = joystickElement.getBoundingClientRect();
    joystick.originX = rect.left + rect.width / 2;
    joystick.originY = rect.top + rect.height / 2;
    joystickElement.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });
  joystickElement.addEventListener("pointermove", (event) => {
    if (joystick.active && event.pointerId === joystick.pointerId) updateJoystick(event);
  });
  function resetJoystick(event) {
    if (event && event.pointerId !== joystick.pointerId) return;
    joystick.active = false;
    joystick.pointerId = null;
    joystick.x = 0;
    joystick.y = 0;
    knob.style.transform = "translate(-50%, -50%)";
  }
  joystickElement.addEventListener("pointerup", resetJoystick);
  joystickElement.addEventListener("pointercancel", resetJoystick);

  byId("map-toggle").addEventListener("click", () => {
    mapPanel.hidden = !mapPanel.hidden;
    byId("map-toggle").setAttribute("aria-expanded", String(!mapPanel.hidden));
  });
  byId("map-close").addEventListener("click", () => {
    mapPanel.hidden = true;
    byId("map-toggle").setAttribute("aria-expanded", "false");
  });
  byId("map-destinations").addEventListener("click", (event) => {
    const button = event.target.closest("[data-map-destination]");
    if (!button) return;
    const room = OFFICE_CONFIG.rooms.find((item) => item.id === button.dataset.mapDestination);
    if (room) showRoomInfo(room);
  });
  document.querySelectorAll("[data-map-area]").forEach((node) => {
    const activate = () => {
      const room = OFFICE_CONFIG.rooms.find((item) => item.id === node.dataset.mapArea);
      if (room) showRoomInfo(room);
    };
    node.addEventListener("click", activate);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); }
    });
  });
  byId("room-info-move").addEventListener("click", () => {
    const room = OFFICE_CONFIG.rooms.find((item) => item.id === infoPanel.dataset.roomId);
    if (room) teleport(room);
  });
  byId("info-close").addEventListener("click", closeRoomInfo);
  byId("return-entry").addEventListener("click", () => teleport(OFFICE_CONFIG.rooms.find((room) => room.id === "entrance")));
  byId("exit-tour").addEventListener("click", () => {
    document.exitPointerLock?.();
    mapPanel.hidden = true;
    closeRoomInfo();
    byId("map-toggle").setAttribute("aria-expanded", "false");
    stage.hidden = true;
    toolbar.hidden = true;
    status.textContent = "3D空間は停止中です。開始ボタンから再開できます。";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  byId("speed-toggle").addEventListener("click", () => {
    speedScale = speedScale === 1 ? 0.72 : 1;
    byId("speed-toggle").textContent = speedScale === 1 ? "歩行速度：通常" : "歩行速度：ゆっくり";
  });

  function closeRoomInfo() {
    infoPanel.hidden = true;
  }
  function showRoomInfo(room, pointText) {
    infoPanel.dataset.roomId = room.id;
    byId("room-info-title").textContent = room.name;
    byId("room-info-residents").textContent = room.residents?.length ? `所属社員：${room.residents.join("・")}` : "";
    byId("room-info-description").textContent = pointText ? `${room.description} ${pointText}` : room.description;
    const link = byId("room-info-link");
    if (room.link) {
      link.href = `..${room.link}`;
      link.textContent = room.linkLabel ?? "関連ページを見る";
      link.hidden = false;
    } else link.hidden = true;
    byId("room-info-move").hidden = !room.spawn;
    infoPanel.hidden = false;
  }

  byId("scene-tip").textContent = isTouch
    ? "左のスティックで移動、右側をスワイプして見回します。光る案内ポイントをタップしてください。"
    : "WASDで移動。画面クリックでマウス視点を有効にし、光る案内ポイントを中央に合わせてクリックします。";
  updateMap();

  function animate(time) {
    const deltaSeconds = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    if (stage.hidden) { animating = false; return; }
    let strafe = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0) + joystick.x;
    let forward = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - joystick.y;
    const length = Math.hypot(strafe, forward);
    if (length > 1) { strafe /= length; forward /= length; }
    const boost = keys.has("shift") ? 1.36 : 1;
    const speed = 3.15 * speedScale * boost * deltaSeconds;
    const rightX = Math.cos(yaw);
    const rightZ = Math.sin(yaw);
    const frontX = Math.sin(yaw);
    const frontZ = -Math.cos(yaw);
    const movement = {
      x: (rightX * strafe + frontX * forward) * speed,
      z: (rightZ * strafe + frontZ * forward) * speed,
    };
    if (length) {
      const next = movePlayer(position, movement, OFFICE_CONFIG, 0.3, colliders);
      position.x = next.x;
      position.z = next.z;
      camera.position.x = position.x;
      camera.position.z = position.z;
      updateMap();
    }
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  let animating = true;
  requestAnimationFrame(animate);
  return { renderer, camera, scene, resume: () => {
    if (animating) return;
    animating = true;
    lastTime = 0;
    requestAnimationFrame(animate);
  } };
}

function createWorld(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd8c6a9);
  scene.fog = new THREE.Fog(0xd8c6a9, 35, 67);
  const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 90);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const colliders = [];
  const hotspots = [];
  const mats = {
    floor: new THREE.MeshStandardMaterial({ color: 0xa97b52, roughness: 0.84 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xe6d9c6, roughness: 0.94 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x654730, roughness: 0.76 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x815738, roughness: 0.78 }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0xb18a61, roughness: 0.82 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x3e4742, metalness: 0.25, roughness: 0.5 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x65776b, roughness: 0.95 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xc5dfdd, roughness: 0.26, metalness: 0.04, transparent: true, opacity: 0.56 }),
    whiteboard: new THREE.MeshStandardMaterial({ color: 0xf5eee2, roughness: 0.65 }),
    monitor: new THREE.MeshStandardMaterial({ color: 0x26332f, roughness: 0.38, metalness: 0.12 }),
  };

  const ambient = new THREE.HemisphereLight(0xfff3dd, 0x6f5d46, 2.0);
  scene.add(ambient);
  const keyLight = new THREE.DirectionalLight(0xffe8c8, 2.6);
  keyLight.position.set(-10, 16, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -20;
  keyLight.shadow.camera.right = 20;
  keyLight.shadow.camera.top = 24;
  keyLight.shadow.camera.bottom = -30;
  scene.add(keyLight);
  for (const [x, z] of [[-8, 8], [8, 8], [-8, -6], [8, -6], [-4, -17], [4, -17]]) {
    const light = new THREE.PointLight(0xffd7a0, 31, 13, 2);
    light.position.set(x, 2.75, z);
    scene.add(light);
  }

  function addBox(x, y, z, width, height, depth, material, { collidable = false, castShadow = true, receiveShadow = true } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    scene.add(mesh);
    if (collidable) colliders.push({ x, z, width, depth });
    return mesh;
  }
  function addCylinder(x, y, z, radiusTop, radiusBottom, height, material, segments = 10) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  }
  function addWallRect(rect) {
    addBox(rect.x, OFFICE_CONFIG.wallHeight / 2, rect.z, rect.width, OFFICE_CONFIG.wallHeight, rect.depth, mats.wall, { collidable: false });
    addBox(rect.x, OFFICE_CONFIG.wallHeight - 0.08, rect.z, rect.width + 0.04, 0.16, rect.depth + 0.04, mats.trim);
  }

  // Base slab and rooms, with uncluttered central navigation.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(29, 43.5), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -1.75);
  floor.receiveShadow = true;
  scene.add(floor);
  const meetingRugA = addBox(-8, 0.02, -6, 8.7, 0.04, 7.2, new THREE.MeshStandardMaterial({ color: 0xbda783, roughness: 1 }), { castShadow: false });
  const meetingRugB = addBox(8, 0.02, -6, 8.7, 0.04, 7.2, new THREE.MeshStandardMaterial({ color: 0xbda783, roughness: 1 }), { castShadow: false });
  void meetingRugA; void meetingRugB;

  for (const rect of exteriorWalls()) addWallRect(rect);
  for (const rect of segmentWalls()) addWallRect(rect);
  addDoorFrames();
  addRoomSigns();
  addReceptionDesk();
  addRestrooms();
  addDeskCluster("development");
  addDeskCluster("planning");
  addMeetingRoom("meeting-a");
  addMeetingRoom("meeting-b");
  addLounge();
  addPlants();
  for (const room of OFFICE_CONFIG.rooms) {
    for (const point of room.points ?? []) {
      const sprite = createHotspotSprite(THREE, point.label);
      sprite.position.set(point.x, 2.35, point.z);
      sprite.userData = { roomId: room.id, pointText: point.text };
      scene.add(sprite);
      hotspots.push(sprite);
    }
  }
  return { scene, camera, renderer, colliders, hotspots };

  function exteriorWalls() {
    const t = 0.28;
    const rects = [
      { x: -14.5, z: -1.75, width: t, depth: 43.5 },
      { x: 14.5, z: -1.75, width: t, depth: 43.5 },
      { x: 0, z: -23.5, width: 29, depth: t },
      { x: -8.5, z: 20, width: 12, depth: t },
      { x: 8.5, z: 20, width: 12, depth: t },
    ];
    // glazed feature wall on the lounge's back side; collision still prevents leaving the room.
    addWindowBand(-13, -23.34, 26, true);
    return rects;
  }
  function addWindowBand(centerX, z, width, backWall) {
    const glassMat = mats.glass;
    const x = centerX;
    addBox(x, 2.08, z, width, 1.45, 0.08, glassMat, { castShadow: false, receiveShadow: false });
    for (let i = 0; i <= 4; i += 1) addBox(x - width / 2 + (width / 4) * i, 2.08, z + (backWall ? 0.07 : 0), 0.08, 1.63, 0.12, mats.trim);
    addBox(x, 2.08, z, 0.08, 1.63, 0.12, mats.trim);
    addBox(x, 1.3, z, width, 0.1, 0.12, mats.trim);
    addBox(x, 2.87, z, width, 0.1, 0.12, mats.trim);
  }
  function segmentWalls() {
    const t = 0.22;
    const rects = [];
    for (const wall of OFFICE_CONFIG.wallSegments) {
      const intervals = [];
      let cursor = wall.from;
      for (const [start, end] of [...wall.openings].sort((a, b) => a[0] - b[0])) {
        if (start > cursor) intervals.push([cursor, start]);
        cursor = Math.max(cursor, end);
      }
      if (cursor < wall.to) intervals.push([cursor, wall.to]);
      for (const [from, to] of intervals) {
        rects.push(wall.axis === "x"
          ? { x: wall.pos, z: (from + to) / 2, width: t, depth: to - from }
          : { x: (from + to) / 2, z: wall.pos, width: to - from, depth: t });
      }
    }
    return rects;
  }
  function addDoorFrames() {
    for (const wall of OFFICE_CONFIG.wallSegments) {
      for (const [start, end] of wall.openings) {
        const openingWidth = end - start;
        if (wall.axis === "x") {
          for (const z of [start + 0.06, end - 0.06]) addBox(wall.pos, 1.19, z, 0.34, 2.38, 0.16, mats.woodLight);
          addBox(wall.pos, 2.42, (start + end) / 2, 0.34, 0.17, openingWidth, mats.woodLight);
          // A short ceiling lintel also marks this passage without closing it.
        } else {
          for (const x of [start + 0.06, end - 0.06]) addBox(x, 1.19, wall.pos, 0.16, 2.38, 0.34, mats.woodLight);
          addBox((start + end) / 2, 2.42, wall.pos, openingWidth, 0.17, 0.34, mats.woodLight);
        }
      }
    }
  }
  function addRoomSigns() {
    for (const room of OFFICE_CONFIG.rooms) {
      if (["entrance", "hallway", "market"].includes(room.id)) continue;
      if (room.type === "restroom") {
        const z = (room.bounds.minZ + room.bounds.maxZ) / 2;
        addBox(7.7, 2.04, z, 0.08, 0.54, 1.55, mats.woodLight);
        addTextSign(7.63, 2.06, z, room.shortName, -Math.PI / 2);
        continue;
      }
      const x = room.id === "development" || room.id === "meeting-a" ? -2.1 : 2.1;
      const z = room.id.startsWith("meeting") ? -6.5 : 10.5;
      addBox(x + (x < 0 ? 0.2 : -0.2), 2.04, z, 0.07, 0.52, 1.5, mats.woodLight);
      addTextSign(x + (x < 0 ? 0.16 : -0.16), 2.06, z, room.shortName, x < 0 ? Math.PI / 2 : -Math.PI / 2);
    }
  }
  function addTextSign(x, y, z, text, rotationY = 0) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 160;
    const context = canvas.getContext("2d");
    context.fillStyle = "#f4ebdc"; context.fillRect(0, 0, 512, 160);
    context.fillStyle = "#334b3e"; context.font = "bold 52px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(text, 256, 80, 470);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.45), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    plane.position.set(x, y, z); plane.rotation.y = rotationY; scene.add(plane);
  }
  function addReceptionDesk() {
    const { x, z } = OFFICE_CONFIG.fixtures.entrance.desk;
    addBox(x, 0.53, z, 3.2, 1.06, 1.0, mats.wood, { collidable: true });
    addBox(x, 1.1, z - 0.02, 3.24, 0.12, 1.06, mats.woodLight);
    addBox(x, 1.78, z - 0.58, 3.4, 0.72, 0.12, mats.whiteboard);
    addTextSign(x, 1.8, z - 0.505, "毎日見るCoWorks", 0);
    const waiting = OFFICE_CONFIG.fixtures.entrance.sofa;
    addSofa(waiting.x, 0, waiting.z, 3.7, 0.95);
    addPlant(-12.1, 18.2, 1.3);
    addPlant(6.8, 18.2, 1.15);
  }
  function addRestrooms() {
    const ceramic = new THREE.MeshStandardMaterial({ color: 0xe8e2d7, roughness: 0.42 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0x9ca7a2, metalness: 0.64, roughness: 0.32 });
    for (const roomId of ["toilet-male", "toilet-female"]) {
      const fixtures = OFFICE_CONFIG.fixtures[roomId];
      const { x, z } = fixtures.wc;
      addCylinder(x, 0.28, z, 0.32, 0.39, 0.52, ceramic, 16);
      addCylinder(x, 0.56, z, 0.31, 0.31, 0.09, mats.whiteboard, 18);
      addBox(x, 0.82, z - 0.42, 0.72, 0.78, 0.36, ceramic, { collidable: true });
      addBox(x, 1.23, z - 0.42, 0.64, 0.08, 0.32, mats.whiteboard);
      const sink = fixtures.sink;
      addBox(sink.x, 0.79, sink.z, 0.72, 0.15, 0.52, ceramic, { collidable: true });
      addCylinder(sink.x, 0.94, sink.z - 0.05, 0.08, 0.08, 0.16, chrome, 10);
      addBox(sink.x, 0.42, sink.z, 0.13, 0.68, 0.13, mats.whiteboard);
      addBox(sink.x, 1.48, sink.z - 0.34, 0.95, 0.82, 0.1, mats.glass);
    }
  }
  function addDeskCluster(roomId) {
    const fixtures = OFFICE_CONFIG.fixtures[roomId];
    for (const desk of fixtures.desks) {
      addDesk(desk.x, desk.z, roomId === "development" ? 0x5b866f : 0xc28f5d);
      const chairX = desk.x + (desk.x < 0 ? -1.35 : 1.35);
      addChair(chairX, desk.z + 0.15);
    }
    const board = fixtures.board;
    addBox(board.x, 1.85, board.z, 0.14, 1.25, 4.1, mats.whiteboard, { collidable: true });
    addBox(board.x + (board.x < 0 ? 0.1 : -0.1), 2.53, board.z, 0.18, 0.1, 4.2, mats.trim);
    addBox(board.x + (board.x < 0 ? 0.1 : -0.1), 1.15, board.z, 0.18, 0.1, 4.2, mats.trim);
    for (let i = 0; i < 3; i += 1) addBox(board.x + (board.x < 0 ? 0.18 : -0.18), 1.8 + i * 0.16, board.z - 0.9 + i * 0.55, 0.04, 0.035, 0.65, [mats.woodLight, mats.fabric, mats.trim][i]);
    addBookshelf(roomId === "development" ? -13 : 13, 0.95, 0.5, roomId === "development" ? 0.4 : -0.4);
  }
  function addDesk(x, z, screenColor) {
    addBox(x, 0.76, z, 1.88, 0.1, 0.82, mats.woodLight, { collidable: true });
    for (const dx of [-0.78, 0.78]) for (const dz of [-0.3, 0.3]) addBox(x + dx, 0.37, z + dz, 0.07, 0.74, 0.07, mats.metal);
    addBox(x, 1.18, z - 0.23, 0.75, 0.56, 0.09, mats.monitor);
    addBox(x, 1.17, z - 0.175, 0.58, 0.39, 0.025, new THREE.MeshStandardMaterial({ color: screenColor, emissive: screenColor, emissiveIntensity: 0.16, roughness: 0.4 }));
    addBox(x, 0.9, z - 0.22, 0.09, 0.22, 0.08, mats.metal);
    addBox(x, 0.84, z + 0.2, 0.43, 0.045, 0.18, mats.metal);
    addBox(x + 0.59, 0.84, z + 0.19, 0.22, 0.035, 0.14, mats.wood);
  }
  function addChair(x, z) {
    addCylinder(x, 0.45, z, 0.31, 0.34, 0.13, mats.fabric, 12);
    addBox(x, 0.81, z + 0.24, 0.58, 0.62, 0.12, mats.fabric, { collidable: true });
    addCylinder(x, 0.22, z, 0.06, 0.07, 0.42, mats.metal, 8);
    for (let i = 0; i < 4; i += 1) {
      const angle = i * Math.PI / 2;
      addBox(x + Math.cos(angle) * 0.25, 0.05, z + Math.sin(angle) * 0.25, 0.5, 0.06, 0.07, mats.metal);
    }
  }
  function addMeetingRoom(roomId) {
    const { x, z } = OFFICE_CONFIG.fixtures[roomId].table;
    const longer = roomId === "meeting-b" ? 3.5 : 2.7;
    addBox(x, 0.76, z, longer, 0.12, 1.25, mats.woodLight, { collidable: true });
    for (const dx of [-longer * 0.42, longer * 0.42]) for (const dz of [-0.42, 0.42]) addBox(x + dx, 0.38, z + dz, 0.08, 0.75, 0.08, mats.wood);
    for (let i = -1; i <= 1; i += 1) {
      addChair(x + i * 0.95, z - 1.35);
      addChair(x + i * 0.95, z + 1.35);
    }
    addBox(roomId === "meeting-a" ? -13.15 : 13.15, 1.83, z - 3.2, 0.12, 1.25, 3.3, mats.whiteboard, { collidable: true });
  }
  function addLounge() {
    const fixtures = OFFICE_CONFIG.fixtures.lounge;
    const table = fixtures.table;
    addBox(table.x, 0.76, table.z, 4.3, 0.13, 1.8, mats.woodLight, { collidable: true });
    for (const x of [-1.7, 1.7]) for (const z of [-0.62, 0.62]) addBox(x + table.x, 0.38, z + table.z, 0.09, 0.74, 0.09, mats.wood);
    for (const x of [-2.5, -1.1, 1.1, 2.5]) { addChair(x, table.z - 1.7); addChair(x, table.z + 1.7); }
    addSofa(fixtures.sofa.x, 0, fixtures.sofa.z, 3.8, 0.95);
    addBookshelf(-12.8, 1.15, -16.5, Math.PI / 2);
    addCoffeeCounter(fixtures.counter.x, fixtures.counter.z);
    addPlant(-4.5, -21.2, 1.35);
    addPechiBed(fixtures.pechi.x, fixtures.pechi.z);
    addMarketShelf(OFFICE_CONFIG.fixtures.market.shelf.x, OFFICE_CONFIG.fixtures.market.shelf.z);
    addLoungePhoto(fixtures.photo.x, fixtures.photo.z);
    addWindowBand(0, -23.32, 12, true);
  }
  function addSofa(x, y, z, width, depth) {
    addBox(x, 0.43, z, width, 0.48, depth, mats.fabric, { collidable: true });
    addBox(x, 0.83, z + depth * 0.35, width, 0.65, 0.28, mats.fabric, { collidable: true });
    addBox(x - width * 0.46, 0.6, z, 0.28, 0.55, depth, mats.fabric);
    addBox(x + width * 0.46, 0.6, z, 0.28, 0.55, depth, mats.fabric);
    addBox(x - 0.56, 0.72, z - 0.06, 0.85, 0.16, 0.64, mats.woodLight);
  }
  function addBookshelf(x, y, z, rotationY = 0) {
    const shelf = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.05, 0.42), mats.wood);
    frame.position.y = 1.03; frame.castShadow = true; shelf.add(frame);
    for (const level of [0.45, 0.95, 1.45]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.08, 0.5), mats.woodLight);
      board.position.y = level; board.castShadow = true; shelf.add(board);
      for (let i = 0; i < 7; i += 1) {
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.16 + (i % 3) * 0.025, 0.28 + (i % 2) * 0.1, 0.3), new THREE.MeshStandardMaterial({ color: [0x58725d, 0xa06d4c, 0xd4b884, 0x7a8f91][i % 4], roughness: 0.94 }));
        book.position.set(-1 + i * 0.31, level + 0.19, 0); book.castShadow = true; shelf.add(book);
      }
    }
    shelf.position.set(x, y, z); shelf.rotation.y = rotationY; scene.add(shelf);
    colliders.push({ x, z, width: rotationY ? 0.7 : 2.65, depth: rotationY ? 2.65 : 0.65 });
  }
  function addCoffeeCounter(x, z) {
    addBox(x, 0.53, z, 5.2, 1.06, 0.9, mats.wood, { collidable: true });
    addBox(x, 1.1, z, 5.3, 0.12, 1.0, mats.woodLight);
    addBox(x - 1.4, 1.58, z - 0.18, 0.75, 0.85, 0.62, mats.metal, { collidable: true });
    addCylinder(x - 1.4, 2.04, z - 0.18, 0.17, 0.18, 0.1, mats.metal, 12);
    addBox(x + 0.45, 1.48, z - 0.1, 0.42, 0.65, 0.36, mats.woodLight);
    addCylinder(x + 0.5, 1.89, z - 0.1, 0.18, 0.18, 0.08, mats.woodLight, 14);
    for (let i = 0; i < 3; i += 1) addCylinder(x + 1.45 + i * 0.42, 1.3, z - 0.12, 0.14, 0.16, 0.32, mats.whiteboard, 12);
  }
  function addMarketShelf(x, z) {
    for (const level of [0.52, 1.05, 1.58, 2.05]) {
      addBox(x, level, z, 3.8, 0.12, 0.6, mats.woodLight, { collidable: level === 1.05 || level === 1.58 });
    }
    for (const dx of [-1.82, 1.82]) addBox(x + dx, 1.22, z, 0.13, 2.45, 0.62, mats.wood);
    const colors = [0xc7865e, 0x84a07f, 0xd5b46f, 0x758b9c, 0xd29a7c, 0xe1d3b8];
    for (let row = 0; row < 3; row += 1) for (let col = 0; col < 6; col += 1) {
      addBox(x - 1.46 + col * 0.58, 0.72 + row * 0.53, z - 0.03, 0.38, 0.32, 0.38, new THREE.MeshStandardMaterial({ color: colors[(row * 2 + col) % colors.length], roughness: 0.93 }));
    }
    addTextSign(x, 2.34, z - 0.36, "MARKET", 0);
  }
  function addPechiBed(x, z) {
    const tan = new THREE.MeshStandardMaterial({ color: 0xb18c67, roughness: 1 });
    addCylinder(x, 0.22, z, 0.95, 0.92, 0.32, tan, 28);
    addCylinder(x, 0.42, z, 0.74, 0.77, 0.16, new THREE.MeshStandardMaterial({ color: 0xe6d8c2, roughness: 1 }), 28);
    const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0x80634b, roughness: 1 }));
    pillow.scale.set(1.2, 0.45, 0.75); pillow.position.set(x + 0.3, 0.55, z); scene.add(pillow);
    colliders.push({ x, z, width: 1.65, depth: 1.65 });
  }
  function addPlant(x, z, height = 1.2) {
    addCylinder(x, 0.34, z, 0.43, 0.34, 0.68, new THREE.MeshStandardMaterial({ color: 0x9a6d4f, roughness: 0.95 }), 12);
    addCylinder(x, height * 0.62, z, 0.08, 0.11, height * 0.75, new THREE.MeshStandardMaterial({ color: 0x6d513a, roughness: 1 }), 8);
    for (let i = 0; i < 6; i += 1) {
      const angle = i * Math.PI * 2 / 6;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.25, 9, 7), new THREE.MeshStandardMaterial({ color: [0x718865, 0x83976a, 0x5d7c5c][i % 3], roughness: 1 }));
      leaf.scale.set(0.62, 1.55, 0.65);
      leaf.position.set(x + Math.cos(angle) * 0.33, height + (i % 2) * 0.12, z + Math.sin(angle) * 0.33);
      leaf.rotation.z = Math.cos(angle) * 0.4;
      scene.add(leaf);
    }
    colliders.push({ x, z, width: 0.85, depth: 0.85 });
  }
  function addPlants() {
    for (const [x, z] of [[-12.4, 12.2], [12.4, 12.2], [-12.4, -3.6], [12.4, -3.6], [-12.4, -19], [5.6, -22]]) addPlant(x, z, 1.25);
  }
  function addLoungePhoto(x, z) {
    addBox(x, 1.55, z, 3.8, 2.45, 0.16, mats.trim);
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load("../image/lounge/lounge-evening001.jpg", (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const image = new THREE.Mesh(new THREE.PlaneGeometry(3.55, 2.15), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
      image.position.set(x, 1.58, z + 0.09);
      scene.add(image);
    });
  }
  function createHotspotSprite(_THREE, label) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgba(38,67,51,.92)";
    context.beginPath(); context.arc(128, 128, 101, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "#f6d7a5"; context.lineWidth = 9; context.stroke();
    context.fillStyle = "#fff9ee"; context.font = "bold 100px Georgia, serif"; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("i", 128, 122);
    context.fillStyle = "#fff9ee"; context.font = "bold 25px sans-serif"; context.fillText(label.slice(0, 10), 128, 205);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(0.56, 0.56, 1);
    sprite.renderOrder = 10;
    return sprite;
  }
}

function openMarkerForRoom(roomId) {
  const room = OFFICE_CONFIG.rooms.find((item) => item.id === roomId);
  if (room && tour) tour.camera.position.set(room.spawn.x, 1.65, room.spawn.z);
}
