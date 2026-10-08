// THROWAWAY (J7). Renders hockeyRink("nhl") as flat polygons on a plane, extrudes features with `height`, draws a
// puck trail from sample rows through toSurfaceFrame. Z-up: Scene (x, y) → world (x, y); elevation/height → z.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { hockeyRink, toSurfaceFrame, type PolygonFeature, type Scene } from "../../packages/sporty/dist/index.js";

const scene3 = new THREE.Scene();
scene3.background = new THREE.Color(0x111111);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const rink: Scene = hockeyRink("nhl");                       // units ft, origin center, bbox = [-106.25, -54.25, 106.25, 54.25] (benches + boards included)
const [x0, y0, x1, y1] = rink.bbox;
const w = x1 - x0, h = y1 - y0;

// Orthographic from above, Z-UP: no scale(1,-1) flip — Scene y is already "up".
const aspect = innerWidth / innerHeight;
const half = Math.max(w / 2, h / 2 / aspect) * 1.05;
const camera = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.1, 1000);
camera.up.set(0, 0, 1);
camera.position.set((x0 + x1) / 2, (y0 + y1) / 2 - 60, 120);
camera.lookAt((x0 + x1) / 2, (y0 + y1) / 2, 0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set((x0 + x1) / 2, (y0 + y1) / 2, 0);

// Ground plane under the surface (so decals have something to sit on).
const ground = new THREE.Mesh(new THREE.PlaneGeometry(w + 10, h + 10), new THREE.MeshBasicMaterial({ color: 0x222222 }));
ground.position.set((x0 + x1) / 2, (y0 + y1) / 2, -0.05);
scene3.add(ground);

function shapeOf(points: readonly (readonly [number, number])[]): THREE.Shape {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}
function colorOf(hex: string): { color: THREE.Color; opacity: number } {
  const c = hex.length === 9 ? hex.slice(0, 7) : hex;
  const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  return { color: new THREE.Color(c), opacity: a };
}
// R-style "polygon with a hole" = one ring that revisits an earlier vertex (outer → seam → inner reversed → seam).
function hasSeam(points: readonly (readonly [number, number])[]): boolean {
  const seen = new Set<string>();
  for (const [x, y] of points) { const k = `${x.toFixed(6)},${y.toFixed(6)}`; if (seen.has(k)) return true; seen.add(k); }
  return false;
}

const polygons = rink.features.filter((f): f is PolygonFeature => f.kind === "polygon");
let extruded = 0, decals = 0, hidden = 0, degenerate = 0;
const extrudedNames: string[] = [], seamNames: string[] = [];
for (const f of [...polygons].sort((a, b) => a.zIndex - b.zIndex)) {
  if (f.fill === "#00000000") { hidden++; continue; }
  const { color, opacity } = colorOf(f.fill);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -f.zIndex, polygonOffsetUnits: -1 });
  const shape = shapeOf(f.points);
  const height = f.height ?? 0, elevation = f.elevation ?? 0;
  const geom = height > 0 ? new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }) : new THREE.ShapeGeometry(shape);
  if (!geom.getAttribute("position") || geom.getAttribute("position").count === 0) degenerate++;
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.f = f;
  mesh.position.z = elevation + (height > 0 ? 0 : f.zIndex * 0.001);     // decals: tiny z step per zIndex to fight z-fighting
  scene3.add(mesh);
  if (height > 0) { extruded++; extrudedNames.push(`${f.name}:${height}`); } else decals++;
  if (hasSeam(f.points)) seamNames.push(f.name);
}

// Puck trail: 20 sample rows on the hockeytech-b canvas (600×300, y down) → Scene ft via the frame registry.
const SAMPLE = Array.from({ length: 20 }, (_, i) => ({ x_coord: 60 + i * 24, y_coord: 150 + Math.sin(i / 3) * 90 }));
const trail = toSurfaceFrame(SAMPLE, { from: "hockeytech-b", x: "x_coord", y: "y_coord" });
const pts = trail.filter((r) => r.surface_x !== null && r.surface_y !== null).map((r) => new THREE.Vector3(r.surface_x!, r.surface_y!, 0.3));
scene3.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffcc00 })));
for (const p of pts) { const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.083, 16), new THREE.MeshBasicMaterial({ color: 0x000000 })); puck.rotation.x = Math.PI / 2; puck.position.copy(p); scene3.add(puck); }
const inside = pts.filter((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1).length;

document.getElementById("hud")!.textContent += ` · ${extruded} extruded, ${decals} decals, ${hidden} hidden · bbox ${rink.bbox.map((v) => v.toFixed(1)).join(",")} ${rink.units}`;
// Findings hook for the §7 write-up (read from the console / an automated browser).
(window as unknown as { __spike: unknown }).__spike = {
  bbox: rink.bbox, units: rink.units, polygons: polygons.length, extruded, decals, hidden, degenerate, extrudedNames, seamNames,
  trail: { n: pts.length, inside, xs: pts.map((p) => +p.x.toFixed(2)), ys: pts.map((p) => +p.y.toFixed(2)) },
  cameraUp: camera.up.toArray(),
  // knobs for poking at it from the console: move the camera, or set the per-zIndex decal step to 0 to see z-fighting
  camera, controls,
  setDecalStep: (step: number) => { for (const m of scene3.children) { const f = (m as THREE.Mesh).userData.f as PolygonFeature | undefined; if (f && !(f.height ?? 0)) m.position.z = (f.elevation ?? 0) + f.zIndex * step; } },
};
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene3, camera); });
addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); });
