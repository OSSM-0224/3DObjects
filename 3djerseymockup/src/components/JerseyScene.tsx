import { Suspense, useLayoutEffect, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import Jersey from "./Jersey";
import type { Kit } from "../lib/kits";
import type { SpinState } from "../lib/spin";

const FOV = 30;
const DESKTOP_BASE_X = 1.12;
const MOBILE_BASE_Y = -1.3;

type ExperienceProps = {
  kit: Kit;
  start: boolean;
  autoRotate: boolean;
  spin: RefObject<SpinState>;
  onLoaded: () => void;
  reducedMotion: boolean;
};

type SceneProps = ExperienceProps & {
  intro: RefObject<number>;
};

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function CameraRig({
  intro,
  spin,
  mobile,
  reducedMotion,
}: {
  intro: RefObject<number>;
  spin: RefObject<SpinState>;
  mobile: boolean;
  reducedMotion: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useLayoutEffect(() => {
    const aspect = Math.max(size.width / size.height, 0.4);
    const halfFov = THREE.MathUtils.degToRad(FOV / 2);
    const fitHeight = mobile ? 4.1 : 4.35;
    const fitWidth = mobile ? 4 : 4.9;
    const distanceForHeight = fitHeight / 2 / Math.tan(halfFov);
    const distanceForWidth = fitWidth / 2 / (Math.tan(halfFov) * aspect);

    camera.position.set(
      mobile ? 0 : 0.18,
      mobile ? -0.35 : 0.04,
      Math.max(distanceForHeight, distanceForWidth) + (reducedMotion ? 0 : 1.6),
    );
    camera.lookAt(0, mobile ? -0.35 : 0.02, 0);
  }, [camera, mobile, reducedMotion, size.width, size.height]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const aspect = Math.max(size.width / size.height, 0.4);
    const halfFov = THREE.MathUtils.degToRad(FOV / 2);
    const fitHeight = mobile ? 4.1 : 4.35;
    const fitWidth = mobile ? 4 : 4.9;
    const distanceForHeight = fitHeight / 2 / Math.tan(halfFov);
    const distanceForWidth = fitWidth / 2 / (Math.tan(halfFov) * aspect);
    const baseDistance = Math.max(distanceForHeight, distanceForWidth) + 0.55;
    const introEase = easeOutCubic(intro.current);

    const targetX = (mobile ? 0 : 0.18) + spin.current.pointerX * 0.1;
    const targetY = (mobile ? -0.35 : 0.04) + spin.current.pointerY * 0.06;
    const targetZ = baseDistance + (1 - introEase) * 1.6;

    camera.position.set(
      THREE.MathUtils.damp(camera.position.x, targetX, 3, dt),
      THREE.MathUtils.damp(camera.position.y, targetY, 3, dt),
      THREE.MathUtils.damp(camera.position.z, targetZ, 3, dt),
    );
    camera.lookAt(0, mobile ? -0.35 : 0.02, 0);
  });

  return null;
}

function SceneContent({
  kit,
  start,
  autoRotate,
  spin,
  onLoaded,
  reducedMotion,
  intro,
}: SceneProps) {
  const size = useThree((state) => state.size);
  const mobile = size.width < 960;
  const baseX = mobile ? 0 : DESKTOP_BASE_X;
  const baseY = mobile ? MOBILE_BASE_Y : 0;

  return (
    <>
      <CameraRig intro={intro} spin={spin} mobile={mobile} reducedMotion={reducedMotion} />

      <hemisphereLight intensity={0.55} color="#d8d2c6" groundColor="#050505" />
      <directionalLight position={[3.5, 4.5, 5]} intensity={3.1} color="#fff2e2" />
      <directionalLight position={[-4.5, 1.5, -3]} intensity={3.4} color="#ff5a24" />
      <directionalLight position={[4, 2, -4]} intensity={1.9} color="#c7d6ff" />
      <pointLight position={[0, 0.4, 3.2]} intensity={9} distance={9} color="#ffe9d2" />

      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.8}
          position={[0, 5, -6]}
          scale={[12, 8, 1]}
          color="#fff6e8"
        />
        <Lightformer
          form="rect"
          intensity={3.4}
          position={[-5, 1, 3]}
          scale={[3, 7, 1]}
          color="#ff6a2e"
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          position={[5, 1, 2]}
          scale={[3, 6, 1]}
          color="#c7d8ff"
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          position={[0, -4, 2]}
          scale={[9, 2, 1]}
          color="#f0ede6"
        />
      </Environment>

      <Jersey
        key={kit.id}
        kit={kit}
        start={start}
        autoRotate={autoRotate}
        spinRef={spin}
        onLoaded={onLoaded}
        reducedMotion={reducedMotion}
        introRef={intro}
        baseX={baseX}
        baseY={baseY}
      />
    </>
  );
}

export default function JerseyScene({
  kit,
  start,
  autoRotate,
  spin,
  onLoaded,
  reducedMotion,
}: ExperienceProps) {
  const intro = useRef(0);

  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ fov: FOV, position: [0, 0.1, 9], near: 0.1, far: 100 }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
    >
      <Suspense fallback={null}>
        <SceneContent
          kit={kit}
          start={start}
          autoRotate={autoRotate}
          spin={spin}
          onLoaded={onLoaded}
          reducedMotion={reducedMotion}
          intro={intro}
        />
      </Suspense>
    </Canvas>
  );
}
