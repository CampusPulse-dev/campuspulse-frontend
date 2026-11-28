/**
 * The Babylon.js half of <PulseScene>. It lives in its own module so the
 * component can pull the whole engine in with one dynamic import, which
 * bundles into a single lazy chunk instead of one chunk per Babylon file.
 */
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateTube } from '@babylonjs/core/Meshes/Builders/tubeBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
// Side effect: lets meshes create instances (the sparks).
import '@babylonjs/core/Meshes/instancedMesh.js';

/** Reads a brand colour token, so the scene follows tokens.css like the rest of the UI. */
function tokenColor(el: Element, name: string, fallback: Color3): Color3 {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? Color3.FromHexString(value) : fallback;
}

/** Starts the scene on `canvas`. Returns a cleanup function, or null when WebGL is unavailable. */
export function mountPulseScene(canvas: HTMLCanvasElement): (() => void) | null {
  let engine: Engine;
  try {
    engine = new Engine(canvas, true, { alpha: true, powerPreference: 'low-power' }, true);
  } catch {
    return null;
  }
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);

  const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2, 10.5, Vector3.Zero(), scene);
  camera.fov = 0.6;
  new HemisphericLight('sky', new Vector3(0, 1, 0), scene).intensity = 0.4;

  const lavender = tokenColor(canvas, '--cp-lavender', new Color3(0.88, 0.67, 1));
  const purple = tokenColor(canvas, '--cp-purple-500', new Color3(0.62, 0.31, 0.87));
  const glowMat = (name: string, color: Color3) => {
    const m = new StandardMaterial(name, scene);
    m.emissiveColor = color;
    m.diffuseColor = color.scale(0.2);
    m.disableLighting = true;
    return m;
  };

  // The "C": a 300-degree arc, open on the right like the logo.
  const arc: Vector3[] = [];
  for (let i = 0; i <= 96; i++) {
    const t = Math.PI / 6 + (i / 96) * ((5 * Math.PI) / 3);
    arc.push(new Vector3(Math.cos(t) * 2.4, Math.sin(t) * 2.4, 0));
  }
  const ring = CreateTube('c-ring', { path: arc, radius: 0.16, tessellation: 24, cap: 2 }, scene);
  ring.material = glowMat('ring', purple);

  // The pulse: a heartbeat line running through the opening.
  const beat = (
    [
      [-1.6, 0],
      [-0.4, 0],
      [0, 1.1],
      [0.45, -0.9],
      [0.85, 0.35],
      [1.15, 0],
      [2.75, 0],
    ] as const
  ).map(([x, y]) => new Vector3(x, y, 0));
  const pulse = CreateTube('pulse', { path: beat, radius: 0.07, tessellation: 12, cap: 2 }, scene);
  pulse.material = glowMat('pulse', lavender);

  // Little sparks circling the mark, like people heading to the same place.
  const spark = CreateSphere('spark', { diameter: 0.12, segments: 8 }, scene);
  spark.material = glowMat('spark', lavender);
  const sparks = Array.from({ length: 18 }, (_, i) => ({
    mesh: i === 0 ? spark : spark.createInstance('spark' + i),
    r: 3 + (i % 5) * 0.35,
    speed: 0.15 + (i % 7) * 0.04,
    phase: i * 1.7,
    tilt: (i % 3) - 1,
  }));

  const glow = new GlowLayer('glow', scene, { blurKernelSize: 48 });
  glow.intensity = 0.9;

  let time = 0;
  scene.onBeforeRenderObservable.add(() => {
    time += engine.getDeltaTime() / 1000;
    ring.rotation.y = Math.sin(time * 0.35) * 0.45;
    pulse.rotation.y = ring.rotation.y;
    glow.intensity = 0.75 + Math.max(0, Math.sin(time * 2.4)) * 0.5;
    for (const s of sparks) {
      const a = s.phase + time * s.speed;
      s.mesh.position.set(
        Math.cos(a) * s.r,
        Math.sin(a) * s.r * 0.55 + s.tilt * 0.4,
        Math.sin(a) * 1.2,
      );
    }
  });

  // Only render while the canvas is on screen and the tab is visible.
  let onScreen = true;
  const run = () => {
    engine.stopRenderLoop();
    if (onScreen && !document.hidden) engine.runRenderLoop(() => scene.render());
  };
  const observer = new IntersectionObserver(([entry]) => {
    onScreen = !!entry?.isIntersecting;
    run();
  });
  observer.observe(canvas);
  const onResize = () => engine.resize();
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', run);
  run();

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', run);
    scene.dispose();
    engine.dispose();
  };
}
