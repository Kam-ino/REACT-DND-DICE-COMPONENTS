import React, { useState, useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

// Constants
const ROLL_DURATION_MS = 1800;
const GRAVITY = -9.8;
const BOUNCE_DAMPING = 0.5;

// ===== helper: create numbered textures for faces =====
function makeNumberTexture(number, size = 256, bgcolor = "#b71c1c", fg = "#fff") {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = bgcolor;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = fg;
  ctx.font = `${Math.floor(size * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineWidth = Math.floor(size * 0.03);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.strokeText(String(number), size / 2, size / 2);
  ctx.fillText(String(number), size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ===== D4 Mesh (with rolling and settling logic) =====
function D4Mesh({ rolling, targetQuaternion, materials, rollDirection, rollStartTime, resetSignal, initialQuaternion }) {
  const meshRef = useRef();
  const velocity = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const hasBounced = useRef(false);

  // --- Geometry setup (non-indexed, grouped per triangle, with UVs)
  const geometry = useMemo(() => {
    const g = new THREE.TetrahedronGeometry(1);
    const nonIndexed = g.toNonIndexed();

    const posAttr = nonIndexed.attributes.position;
    const triCount = posAttr.count / 3;
    const uvs = [];

    for (let i = 0; i < triCount; i++) {
      uvs.push(0.5, 1.0); // top
      uvs.push(0.0, 0.0); // bottom-left
      uvs.push(1.0, 0.0); // bottom-right
    }

    nonIndexed.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    nonIndexed.clearGroups();

    for (let i = 0; i < triCount; i++) {
      nonIndexed.addGroup(i * 3, 3, i);
    }

    nonIndexed.computeVertexNormals();
    return nonIndexed;
  }, []);

  // reset to start each roll
  useEffect(() => {
    pos.current.set(0, 0, 0);
    velocity.current.set(rollDirection[0] * 3, rollDirection[1] * 4, rollDirection[2] * 3);
    hasBounced.current = false;
    if (meshRef.current) {
      meshRef.current.position.set(0, 0, 0);
      meshRef.current.quaternion.copy(initialQuaternion); // Start with face 4 facing the camera
    }
  }, [resetSignal, rollDirection, initialQuaternion]);

  // Apply rolling physics and apply quaternion
  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (rolling) {
      velocity.current.y += GRAVITY * delta * 0.6;  // Simulate gravity
      pos.current.addScaledVector(velocity.current, delta);
      mesh.position.copy(pos.current);

      // Bouncing logic when hitting the floor
      if (pos.current.y < -1.4 && !hasBounced.current) {
        pos.current.y = -1.4;
        velocity.current.y *= -BOUNCE_DAMPING;
        hasBounced.current = true;
      }

      // Apply random rotation during the roll
      mesh.rotation.x += delta * (8 + Math.random() * 3);
      mesh.rotation.y += delta * (10 + Math.random() * 3);
      mesh.rotation.z += delta * (7 + Math.random() * 2);
      mesh.quaternion.setFromEuler(mesh.rotation);
    } else if (targetQuaternion) {
      // Smoothly rotate to the final face after the roll
      mesh.quaternion.slerp(targetQuaternion, Math.min(1, delta * 6));
      mesh.position.lerp(new THREE.Vector3(0, 0, 0), delta * 3);
    }
  });

  return <mesh ref={meshRef} geometry={geometry} material={materials} />;
}

// ===== Main D4 Component =====
export default function D4({ onRollComplete }) {
  const [rolling, setRolling] = useState(false);
  const [result4, setResult] = useState(4);
  const [targetQuat, setTargetQuat] = useState(null);
  const [rollDirection, setRollDirection] = useState([0, 0, 0]);
  const [rollStartTime, setRollStartTime] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [initialQuat, setInitialQuat] = useState(new THREE.Quaternion());
  const diceRef = useRef();

  // 4 materials for the faces of the dice
  const materials = useMemo(() => {
    return [1, 2, 3, 4].map((n) => {
      return new THREE.MeshStandardMaterial({
        map: makeNumberTexture(n, 256, "#b71c1c", "#ffffff"),
        roughness: 0.5,
        metalness: 0.0,
        side: THREE.FrontSide,
      });
    });
  }, []);

  // Compute quaternion so face 4 (index 3) faces the camera
  useEffect(() => {
    const geo = new THREE.TetrahedronGeometry(1).toNonIndexed();
    geo.computeVertexNormals();
    const normals = geo.attributes.normal;
    const faceIndex = 3; // face 4
    const i0 = faceIndex * 3;
    const n0 = new THREE.Vector3().fromBufferAttribute(normals, i0);
    const n1 = new THREE.Vector3().fromBufferAttribute(normals, i0 + 1);
    const n2 = new THREE.Vector3().fromBufferAttribute(normals, i0 + 2);
    const faceNormal = new THREE.Vector3().add(n0).add(n1).add(n2).divideScalar(3).normalize();

    const forward = new THREE.Vector3(0, 0, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(faceNormal, forward);
    setInitialQuat(q);
  }, []);

  const rollDice = () => {
    if (rolling) return;
    setRolling(true);
    setRollStartTime(performance.now() / 1000);

    const faceIndex = Math.floor(Math.random() * 4);
    const faceNumber = faceIndex + 1; // Result is between 1 and 4
    setResult(faceNumber);

    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.5 + 1.2,
      (Math.random() - 0.5) * 2
    ).normalize();
    setRollDirection([dir.x, dir.y, dir.z]);
    setResetSignal((s) => s + 1);

    // Compute quaternion for the rolled face
    const tempGeo = new THREE.TetrahedronGeometry(1).toNonIndexed();
    tempGeo.computeVertexNormals();
    const normals = tempGeo.attributes.normal;
    const i0 = faceIndex * 3;
    const n0 = new THREE.Vector3().fromBufferAttribute(normals, i0);
    const n1 = new THREE.Vector3().fromBufferAttribute(normals, i0 + 1);
    const n2 = new THREE.Vector3().fromBufferAttribute(normals, i0 + 2);
    const faceNormal = new THREE.Vector3().add(n0).add(n1).add(n2).divideScalar(3).normalize();

    const up = new THREE.Vector3(0, 0, 1); // Camera's forward direction
    const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(faceNormal, up);

    // After the roll, ensure the dice settles with the rolled face facing the camera
    setTimeout(() => {
      setRolling(false); // End the animation
      setTargetQuat(targetQuaternion); // Set the quaternion to face the correct side
      if (onRollComplete) {
        onRollComplete(faceNumber); // Notify parent with the result
      }
    }, ROLL_DURATION_MS); // Small buffer for realism
  };

  return (
    <div style={{ width: "100%", height: 400 }}>
      <div style={{ width: "100%", height: "100%", margin: "0 auto" }} onClick={rollDice}>
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />

          {/* Invisible floor */}
          <mesh position={[0, -1.4, 0]} visible={false}>
            <boxGeometry args={[5, 0.1, 5]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>

          <D4Mesh
            rolling={rolling}
            targetQuaternion={targetQuat}
            materials={materials}
            rollDirection={rollDirection}
            rollStartTime={rollStartTime}
            resetSignal={resetSignal}
            initialQuaternion={initialQuat}
            ref={diceRef}
          />

          {/* Disable all camera interaction */}
          <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
        </Canvas>
      </div>
    </div>
  );
}
