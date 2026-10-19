import {
  type ComponentType,
  type ReactElement,
  Suspense,
  createElement,
  lazy,
  useEffect,
  useMemo,
} from "react";
import { OptionalDependencyError } from "../errors.js";
import { type TrajectoryTubeOptions, type TubeMesh, trajectoryTube } from "../three/tube.js";
import type { IdSystem, League, SeasonInput, Which } from "../types.js";

type Three = typeof import("three");
type Fiber = typeof import("@react-three/fiber");
/** What a drawn mesh needs: its buffers (positions, then colours or normals), indices and material. */
interface Buffers {
  positions: Float32Array;
  indices: Uint32Array;
  colors?: Float32Array;
  normals?: Float32Array;
}
type MeshProps = { buffers: Buffers; material: Record<string, unknown>; renderOrder: number };

/**
 * `three` and `@react-three/fiber`, loaded on first render, never with `sdvplot/react`: a page that draws no 3D needs
 * neither. Missing, the component throws `OptionalDependencyError` when it renders.
 */
async function peers(who: string): Promise<[Three, Fiber]> {
  try {
    return await Promise.all([import("three"), import("@react-three/fiber")]);
  } catch (e) {
    throw new OptionalDependencyError(
      `${who} needs the optional peers three and @react-three/fiber, which could not be loaded: pnpm add three @react-three/fiber`,
      { cause: e },
    );
  }
}

/**
 * A mesh of `buffers` in react-three-fiber: the geometry is built once per buffers object and freed when it changes
 * or unmounts. `useThree` makes using it outside a `<Canvas>` an error that says so, and asks a canvas drawn on demand
 * (`frameloop="demand"`) for a frame.
 */
function meshOf(THREE: Three, fiber: Fiber): ComponentType<MeshProps> {
  return function Drawn({ buffers, material, renderOrder }): ReactElement {
    const invalidate = fiber.useThree((s) => s.invalidate);
    // biome-ignore lint/correctness/useExhaustiveDependencies: THREE is the module namespace, the same object always
    const geometry = useMemo(() => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(buffers.positions, 3));
      if (buffers.colors !== undefined) g.setAttribute("color", new THREE.BufferAttribute(buffers.colors, 4));
      if (buffers.normals !== undefined)
        g.setAttribute("normal", new THREE.BufferAttribute(buffers.normals, 3));
      g.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
      g.computeBoundingSphere();
      return g;
    }, [buffers]);
    useEffect(() => {
      invalidate();
      return () => geometry.dispose();
    }, [geometry, invalidate]);
    // react-three-fiber frees the material it made; the geometry, made here, is freed above
    return createElement("mesh", { geometry, renderOrder }, createElement("meshBasicMaterial", material));
  };
}

/** `<Surface3D>` props: sporty's sport and league, and sporty's `surface()` options. */
export interface Surface3DProps {
  /** sporty's sport, e.g. "baseball". */
  sport: string;
  /** sporty's league key for it, e.g. "mlb". */
  league: string;
  /** sporty's `surface()` options (`colorUpdates`, `units`, `rotation`, ...). */
  options?: Record<string, unknown>;
  /** The mesh's `renderOrder`. Default -1: drawn before the scene's other objects, as a ground should be. */
  renderOrder?: number;
}

// the peers and sporty (through ../three/surface.js) load on first render, never with sdvplot/react
const SurfaceBody = lazy(async (): Promise<{ default: ComponentType<Surface3DProps> }> => {
  const [[THREE, fiber], { surfaceMesh }] = await Promise.all([
    peers("Surface3D"),
    import("../three/surface.js").catch((e: unknown) => {
      throw new OptionalDependencyError(
        "Surface3D needs the optional peer @sportsdataverse/sporty, which could not be loaded: pnpm add @sportsdataverse/sporty",
        { cause: e },
      );
    }),
  ]);
  const Drawn = meshOf(THREE, fiber);
  const material = {
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  };
  function Body({ sport, league, options, renderOrder = -1 }: Surface3DProps): ReactElement {
    const key = JSON.stringify([sport, league, options]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the props by value
    const buffers = useMemo(() => surfaceMesh(sport as never, league as never, options as never), [key]);
    return createElement<MeshProps>(Drawn, { buffers, material, renderOrder });
  }
  return { default: Body };
});

/**
 * sporty's playing surface in a react-three-fiber scene: `surfaceMesh` as one mesh in the z = 0 plane, in the
 * surface's own units (feet for a baseball field or a rink, metres for a pitch), z up, so set the camera's
 * `up={[0, 0, 1]}`. Drawn unlit in sporty's colours, before the scene's other objects and without depth writes, so its
 * features paint over each other in order with no z-fighting. Put it inside your `<Canvas>`. `three` and
 * `@react-three/fiber` (0.186.1 and 9.8.1 or later) and `@sportsdataverse/sporty` load when it first renders, never
 * with `sdvplot/react`; a missing peer throws `OptionalDependencyError` then. A server render draws nothing.
 *
 * See it drawn in the Three.js guide (`sdvplot/three/statcast-pitches` in the gallery).
 */
export function Surface3D(props: Surface3DProps): ReactElement {
  return (
    <Suspense fallback={null}>
      <SurfaceBody {...props} />
    </Suspense>
  );
}

/** `<Trajectory>` props: the path, the tube's radius in world units, and its colour or team. */
export interface TrajectoryProps {
  /** The path, `[x, y, z]` points in world units (`statcastPitchPath` gives a pitch's). */
  points: readonly (readonly [x: number, y: number, z: number])[];
  /** The tube's radius in the points' world units, not px (a baseball's is 0.121 ft). */
  radius: number;
  /** Vertices round each ring, 3 or more. Default 12. */
  radialSegments?: number;
  /** The tube's colour, `#rrggbb`. Give this or `team` and `league`. */
  color?: string;
  /** The team whose colour the tube takes (abbreviation, name or id), with `league`. */
  team?: unknown;
  league?: League;
  season?: SeasonInput;
  idSystem?: IdSystem;
  /** "primary" (default) or "secondary". */
  which?: Which;
  /** What the tube is seen against: the colour keeps 3:1 contrast against it (`teamColorPalette`). */
  background?: string;
  /** The colour of a team that does not resolve. Default "#808080". */
  fallback?: string;
  /** The mesh's `renderOrder`. Default 0. */
  renderOrder?: number;
}

const TubeBody = lazy(
  async (): Promise<{ default: ComponentType<{ tube: TubeMesh; renderOrder: number }> }> => {
    const [THREE, fiber] = await peers("Trajectory");
    const Drawn = meshOf(THREE, fiber);
    function Body({ tube, renderOrder }: { tube: TubeMesh; renderOrder: number }): ReactElement {
      const material = useMemo(() => ({ color: tube.color, toneMapped: false }), [tube.color]);
      return createElement<MeshProps>(Drawn, { buffers: tube, material, renderOrder });
    }
    return { default: Body };
  },
);

/**
 * A team-coloured tube along a 3D path (a pitch, a ball flight) in a react-three-fiber scene: `trajectoryTube` as one
 * mesh, `radius` round in the points' world units, drawn unlit and not tone-mapped so the team's colour shows as it
 * is. Put it inside your `<Canvas>`, over a `<Surface3D>` in the same units. `three` and `@react-three/fiber` load
 * when it first renders, never with `sdvplot/react`; a missing peer throws `OptionalDependencyError` then, and a bad
 * radius or colour throws `InputError`. A server render draws nothing.
 *
 * See it drawn in the Three.js guide (`sdvplot/three/statcast-pitches` in the gallery).
 */
export function Trajectory({ points, renderOrder = 0, ...o }: TrajectoryProps): ReactElement {
  const key = JSON.stringify([points, o]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the props by value
  const tube = useMemo(() => trajectoryTube(points, o as TrajectoryTubeOptions), [key]);
  return (
    <Suspense fallback={null}>
      <TubeBody tube={tube} renderOrder={renderOrder} />
    </Suspense>
  );
}
