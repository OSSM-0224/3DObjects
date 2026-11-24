import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Kit } from "../lib/kits";
import type { SpinState } from "../lib/spin";

type JerseyProps = {
  kit: Kit;
  start: boolean;
  autoRotate: boolean;
  spinRef: RefObject<SpinState>;
  onLoaded: () => void;
  reducedMotion: boolean;
  introRef: RefObject<number>;
  baseX: number;
  baseY: number;
};

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

const LIVE_COMMON = /* glsl */ `
uniform float uLiveTime;
uniform float uLiveEnergy;
uniform float uLiveSpin;
uniform mat4 uLiveToScene;
uniform mat4 uLiveFromScene;
uniform float uLiveSceneMinY;
uniform float uLiveSceneHeight;
uniform vec3 uLiveAxisPoint;
uniform float uLiveJerseyRadius;

float liveHeight(vec3 scenePos) {
  return clamp((scenePos.y - uLiveSceneMinY) / max(uLiveSceneHeight, 0.0001), 0.0, 1.0);
}

vec2 liveRotate(vec2 value, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * value.x + s * value.y, -s * value.x + c * value.y);
}

float liveLagWeight(float height, float lateral) {
  float hang = pow(1.0 - height, 1.6);
  float sleeve = smoothstep(0.55, 0.95, lateral) * smoothstep(0.45, 0.85, height);
  return max(hang, sleeve * 0.8);
}
`;

const LIVE_NORMAL = /* glsl */ `
vec3 liveScenePositionN = (uLiveToScene * vec4(position, 1.0)).xyz;
float liveHeightN = liveHeight(liveScenePositionN);
float liveLateralN = clamp(
  length(liveScenePositionN.xz - uLiveAxisPoint.xz) / max(uLiveJerseyRadius, 0.0001),
  0.0,
  1.0
);
float liveTwistN = -uLiveSpin * 0.045 * liveLagWeight(liveHeightN, liveLateralN);
vec3 liveSceneNormal = mat3(uLiveToScene) * objectNormal;
liveSceneNormal.xz = liveRotate(liveSceneNormal.xz, liveTwistN);
objectNormal = normalize(mat3(uLiveFromScene) * liveSceneNormal);
`;

const LIVE_VERTEX = /* glsl */ `
vec3 liveScenePosition = (uLiveToScene * vec4(transformed, 1.0)).xyz;
float liveHeightV = liveHeight(liveScenePosition);
vec3 liveRadial = liveScenePosition - vec3(uLiveAxisPoint.x, liveScenePosition.y, uLiveAxisPoint.z);
float liveLateralV = clamp(length(liveRadial.xz) / max(uLiveJerseyRadius, 0.0001), 0.0, 1.0);
float liveTwistV = -uLiveSpin * 0.045 * liveLagWeight(liveHeightV, liveLateralV);
liveScenePosition.xz = uLiveAxisPoint.xz + liveRotate(liveRadial.xz, liveTwistV);

vec3 liveSceneNormalV = normalize(mat3(uLiveToScene) * normal);
float liveBreathe = sin(uLiveTime * 1.25 + liveHeightV * 2.2) * 0.5 + 0.5;
liveScenePosition += liveSceneNormalV * (liveBreathe - 0.5) * 0.016 * uLiveSceneHeight * uLiveEnergy;

vec2 liveRadialDir = liveRadial.xz / max(length(liveRadial.xz), 0.0001);
float liveRipple = sin(uLiveTime * 2.2 + liveHeightV * 6.0 + liveLateralV * 3.0);
liveScenePosition.xz += liveRadialDir * liveRipple * 0.01 * uLiveSceneHeight * uLiveEnergy * pow(1.0 - liveHeightV, 2.0);

float liveSleeve = smoothstep(0.55, 0.95, liveLateralV) * smoothstep(0.45, 0.85, liveHeightV);
liveScenePosition.y += sin(uLiveTime * 3.1 + liveLateralV * 6.0) * 0.015 * uLiveSceneHeight * uLiveEnergy * liveSleeve;

transformed = (uLiveFromScene * vec4(liveScenePosition, 1.0)).xyz;
`;

/**
 * Interactive jersey mesh with a GPU fabric shader and a top-pivot swing.
 * Reusable by design: every mount clones the cached GLTF scene and its
 * materials, so multiple instances of the same kit keep their own uniforms.
 */
export default function Jersey({
  kit,
  start,
  autoRotate,
  spinRef,
  onLoaded,
  reducedMotion,
  introRef,
  baseX,
  baseY,
}: JerseyProps) {
  const group = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const swing = useRef({ x: 0, z: 0, vx: 0, vz: 0 });
  const lastYaw = useRef<number | null>(null);
  const gl = useThree((state) => state.gl);
  const { scene: sourceScene } = useGLTF(kit.modelUrl);

  // Har instance apna clone use karta hai, taaki same kit ko ek se zyada baar
  // mount karne par cached GLTF scene / materials share na ho.
  const scene = useMemo(() => sourceScene.clone(true), [sourceScene]);

  const liveUniforms = useRef({
    uLiveTime: { value: 0 },
    uLiveEnergy: { value: 0 },
    uLiveSpin: { value: 0 },
  });

  const model = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = kit.modelHeight / Math.max(size.y, 0.0001);
    return { center, scale };
  }, [scene, kit.modelHeight]);

  useLayoutEffect(() => {
    introRef.current = 0;
  }, [introRef]);

  useLayoutEffect(() => {
    lastYaw.current = null;
    swing.current = { x: 0, z: 0, vx: 0, vz: 0 };

    const maxAnisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());

    scene.updateMatrixWorld(true);
    const worldToScene = new THREE.Matrix4().copy(scene.matrixWorld).invert();
    const sceneBox = new THREE.Box3();
    const meshEntries: Array<{ mesh: THREE.Mesh; toScene: THREE.Matrix4 }> = [];

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const geometryBox = object.geometry.boundingBox;
      if (!geometryBox) return;

      const toScene = new THREE.Matrix4().copy(worldToScene).multiply(object.matrixWorld);
      sceneBox.union(geometryBox.clone().applyMatrix4(toScene));
      meshEntries.push({ mesh: object, toScene });
    });

    const sceneMinY = sceneBox.min.y;
    const sceneHeight = Math.max(sceneBox.max.y - sceneMinY, 0.0001);
    const axisPoint = new THREE.Vector3(
      (sceneBox.min.x + sceneBox.max.x) / 2,
      0,
      (sceneBox.min.z + sceneBox.max.z) / 2,
    );

    let jerseyRadius = 0.0001;
    for (const x of [sceneBox.min.x, sceneBox.max.x]) {
      for (const z of [sceneBox.min.z, sceneBox.max.z]) {
        jerseyRadius = Math.max(jerseyRadius, Math.hypot(x - axisPoint.x, z - axisPoint.z));
      }
    }

    const ownedMaterials: THREE.Material[] = [];
    const baseMaterials: Array<{
      mesh: THREE.Mesh;
      material: THREE.Material | THREE.Material[];
    }> = [];
    const live = liveUniforms.current;

    for (const { mesh, toScene } of meshEntries) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const fromScene = toScene.clone().invert();
      const sourceMaterial = mesh.material;
      const sourceList = Array.isArray(sourceMaterial) ? sourceMaterial : [sourceMaterial];
      const clonedList = sourceList.map((material) => material.clone());

      // Har mesh ke liye material clone: shared GLTF cache untouched rehta hai,
      // aur har instance ke apne shader uniforms hote hain.
      mesh.material = Array.isArray(sourceMaterial) ? clonedList : clonedList[0];
      baseMaterials.push({ mesh, material: sourceMaterial });

      for (const material of clonedList) {
        ownedMaterials.push(material);
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;

        if (material.name === "Main Design" || material.name === "Front") {
          material.metalness = 0.06;
          material.roughness = 0.78;
          material.envMapIntensity = 0.85;
        } else if (material.name === "Button Colour") {
          material.metalness = 0.65;
          material.roughness = 0.32;
          material.envMapIntensity = 1.1;
        } else {
          material.metalness = 0.02;
          material.roughness = 0.72;
          material.envMapIntensity = 0.9;
        }

        if (material.map) {
          material.map.anisotropy = maxAnisotropy;
          material.map.needsUpdate = true;
        }

        const uniforms = {
          uLiveTime: live.uLiveTime,
          uLiveEnergy: live.uLiveEnergy,
          uLiveSpin: live.uLiveSpin,
          uLiveToScene: { value: toScene },
          uLiveFromScene: { value: fromScene },
          uLiveSceneMinY: { value: sceneMinY },
          uLiveSceneHeight: { value: sceneHeight },
          uLiveAxisPoint: { value: axisPoint },
          uLiveJerseyRadius: { value: jerseyRadius },
        };

        material.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>\n${LIVE_COMMON}`)
            .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>\n${LIVE_NORMAL}`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>\n${LIVE_VERTEX}`);
        };
        material.customProgramCacheKey = () => `jersey-live-${material.uuid}`;
        material.needsUpdate = true;
      }
    }

    onLoaded();

    return () => {
      for (const { mesh, material } of baseMaterials) {
        mesh.material = material;
      }
      for (const material of ownedMaterials) material.dispose();
    };
  }, [scene, gl, onLoaded, liveUniforms]);

  useFrame((state, delta) => {
    const modelGroup = group.current;
    if (!modelGroup) return;

    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;
    const motion = reducedMotion ? 0 : 1;
    const current = spinRef.current;
    const live = liveUniforms.current;

    introRef.current = reducedMotion
      ? 1
      : THREE.MathUtils.damp(introRef.current, start ? 1 : 0, 1.8, dt);

    const eased = easeOutCubic(introRef.current);

    if (!current.dragging) {
      if (autoRotate) current.yaw += dt * 0.2 * motion;
      current.yaw += current.velocity * dt;
      current.velocity = THREE.MathUtils.damp(current.velocity, 0, 2.2, dt);
    }

    const bob = Math.sin(time * 0.9) * 0.035 * motion * eased;
    const targetYaw = current.yaw + (1 - eased) * -0.9;
    const targetPitch =
      current.pitch + (1 - eased) * 0.5 + (reducedMotion ? 0 : current.pointerY * 0.045);
    const targetRoll = reducedMotion
      ? 0
      : current.pointerX * 0.022 + Math.sin(time * 0.55) * 0.012 * motion;
    const targetScale = 0.92 + eased * 0.08;

    modelGroup.position.set(baseX, baseY + (1 - eased) * -1.35 + bob, 0);
    modelGroup.rotation.y = THREE.MathUtils.damp(modelGroup.rotation.y, targetYaw, 7, dt);
    modelGroup.rotation.x = THREE.MathUtils.damp(modelGroup.rotation.x, targetPitch, 5, dt);
    modelGroup.rotation.z = THREE.MathUtils.damp(modelGroup.rotation.z, targetRoll, 5, dt);
    modelGroup.scale.setScalar(THREE.MathUtils.damp(modelGroup.scale.x, targetScale, 6, dt));

    const previousYaw = lastYaw.current;
    lastYaw.current = modelGroup.rotation.y;
    const yawRate = previousYaw === null ? 0 : (modelGroup.rotation.y - previousYaw) / dt;

    live.uLiveTime.value = time;
    const targetSpin = reducedMotion ? 0 : THREE.MathUtils.clamp(yawRate, -6, 6) * eased;
    live.uLiveSpin.value = THREE.MathUtils.damp(live.uLiveSpin.value, targetSpin, 10, dt);

    const targetEnergy = reducedMotion
      ? 0
      : THREE.MathUtils.clamp(
          0.22 + Math.abs(yawRate) * 0.08 + (current.dragging ? 0.35 : 0),
          0,
          1,
        ) * eased;
    live.uLiveEnergy.value = THREE.MathUtils.damp(
      live.uLiveEnergy.value,
      targetEnergy,
      3.5,
      dt,
    );

    const pivotGroup = pivot.current;
    if (pivotGroup) {
      const spring = swing.current;
      const targetX = THREE.MathUtils.clamp(current.pointerY * 0.02, -0.06, 0.06);
      const targetZ = THREE.MathUtils.clamp(
        -current.velocity * 0.008 - current.pointerX * 0.015,
        -0.09,
        0.09,
      );
      const stiffness = 36;
      const damping = 6.8;

      spring.vx += (targetX - spring.x) * stiffness * dt;
      spring.vz += (targetZ - spring.z) * stiffness * dt;
      spring.vx *= Math.exp(-damping * dt);
      spring.vz *= Math.exp(-damping * dt);
      spring.x += spring.vx * dt;
      spring.z += spring.vz * dt;

      pivotGroup.rotation.x = spring.x * motion * eased;
      pivotGroup.rotation.z = spring.z * motion * eased;
    }
  });

  return (
    <group ref={group} position={[baseX, baseY, 0]}>
      <group ref={pivot} position={[0, kit.modelHeight / 2, 0]}>
        <group position={[0, -kit.modelHeight / 2, 0]}>
          <group
            scale={model.scale}
            position={[
              -model.center.x * model.scale,
              -model.center.y * model.scale,
              -model.center.z * model.scale,
            ]}
          >
            <primitive object={scene} dispose={null} />
          </group>
        </group>
      </group>
    </group>
  );
}
