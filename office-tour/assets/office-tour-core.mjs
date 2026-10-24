import { OFFICE_CONFIG, wallRects } from "./office-config.mjs";

export function circleHitsRect(x, z, radius, rect) {
  const nearestX = Math.max(rect.x - rect.width / 2, Math.min(x, rect.x + rect.width / 2));
  const nearestZ = Math.max(rect.z - rect.depth / 2, Math.min(z, rect.z + rect.depth / 2));
  const dx = x - nearestX;
  const dz = z - nearestZ;
  return dx * dx + dz * dz < radius * radius;
}

export function isBlocked(x, z, config = OFFICE_CONFIG, radius = 0.28, extraRects = []) {
  const { bounds } = config;
  if (x < bounds.minX + radius || x > bounds.maxX - radius || z < bounds.minZ + radius || z > bounds.maxZ - radius) return true;
  return [...wallRects(config), ...extraRects].some((rect) => circleHitsRect(x, z, radius, rect));
}

export function movePlayer(position, delta, config = OFFICE_CONFIG, radius = 0.28, extraRects = []) {
  let x = position.x;
  let z = position.z;
  // Resolve each axis separately so a blocked diagonal move still slides along the wall.
  const nextX = x + delta.x;
  if (!isBlocked(nextX, z, config, radius, extraRects)) x = nextX;
  const nextZ = z + delta.z;
  if (!isBlocked(x, nextZ, config, radius, extraRects)) z = nextZ;
  return { x, z };
}

export function roomAt(x, z, config = OFFICE_CONFIG) {
  const ordered = [...config.rooms].sort((a, b) => {
    const areaA = (a.bounds.maxX - a.bounds.minX) * (a.bounds.maxZ - a.bounds.minZ);
    const areaB = (b.bounds.maxX - b.bounds.minX) * (b.bounds.maxZ - b.bounds.minZ);
    return areaA - areaB;
  });
  return ordered.find(({ bounds }) => x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) ?? null;
}

export function pointToRectDistance(x, z, rect) {
  const dx = Math.max(Math.abs(x - rect.x) - rect.width / 2, 0);
  const dz = Math.max(Math.abs(z - rect.z) - rect.depth / 2, 0);
  return Math.hypot(dx, dz);
}

export function nearestRoom(x, z, config = OFFICE_CONFIG) {
  return [...config.rooms].sort((a, b) => distanceToRoom(x, z, a.bounds) - distanceToRoom(x, z, b.bounds))[0] ?? null;
}

function distanceToRoom(x, z, bounds) {
  const dx = Math.max(bounds.minX - x, 0, x - bounds.maxX);
  const dz = Math.max(bounds.minZ - z, 0, z - bounds.maxZ);
  return Math.hypot(dx, dz);
}
