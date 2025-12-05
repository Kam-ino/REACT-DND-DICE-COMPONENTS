import React, { useState, useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

// Constants
const ROLL_DURATION_MS = 1800;
const GRAVITY = -9.8;
const BOUNCE_DAMPING = 0.5;

function createD10Geometry() {
  const sides = 10;
  const radius = 1;

  const verts = [0, 0, 1, 0, 0, -1];

  for (let i = 0; i < sides; i++) {
    const a = (i * Math.PI * 2) / sides;
    verts.push(-Math.cos(a), -Math.sin(a), 0.105 * (i % 2 ? 1 : -1));
  }

  const faces = [
    [0, 2, 3],
    [0, 3, 4],
    [0, 4, 5],
    [0, 5, 6],
    [0, 6, 7],
    [0, 7, 8],
    [0, 8, 9],
    [0, 9, 10],
    [0, 10, 11],
    [0, 11, 2],
    [1, 3, 2],
    [1, 4, 3],
    [1, 5, 4],
    [1, 6, 5],
    [1, 7, 6],
    [1, 8, 7],
    [1, 9, 8],
    [1, 10, 9],
    [1, 11, 10],
    [1, 2, 11],
  ].flat();

  const g = new THREE.PolyhedronGeometry(verts, faces, radius, 0).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

function makeFaceLabel(center, normal, number, apexDir) {

  const group = new THREE.Group();

  // --- TRUE "up" for this face = toward the face's apex
  const faceUp = apexDir.clone().normalize();
  const faceNormal = normal.clone().normalize();

  // Build local coordinate system for the face
  const zAxis = faceNormal;
  const xAxis = new THREE.Vector3().crossVectors(faceUp, zAxis).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

  const mat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  const q = new THREE.Quaternion().setFromRotationMatrix(mat);

  /* Invisible anchor plane */
  const planeGeo = new THREE.PlaneGeometry(0.9, 0.9);
  const planeMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);

  plane.position.copy(center.clone().add(faceNormal.clone().multiplyScalar(0.02)));
  plane.quaternion.copy(q);
  group.add(plane);

  /* Visible number plane (flat, not billboarded) */
  const texture = makeNumberSprite(number);
  const numGeo = new THREE.PlaneGeometry(0.7, 0.7);
  const numMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });

  const numPlane = new THREE.Mesh(numGeo, numMat);
  numPlane.position.copy(center.clone().add(faceNormal.clone().multiplyScalar(0.025)));
  numPlane.quaternion.copy(q);

    // Shift to the right inside the face
    const leftShift = xAxis.clone().multiplyScalar(-0.2);

    /* Invisible anchor plane */
    plane.position
    .copy(center)
    .add(faceNormal.clone().multiplyScalar(0.02))
    .add(leftShift);
    plane.quaternion.copy(q);
    group.add(plane);

    /* Number plane */
    numPlane.position
    .copy(center)
    .add(faceNormal.clone().multiplyScalar(0.025))
    .add(leftShift);
    numPlane.quaternion.copy(q);
    group.add(numPlane);

  group.add(numPlane);
  return group;
}

function makeNumberSprite(n, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.floor(size * 0.75)}px sans-serif`;

  // Number stroke + fill
  ctx.lineWidth = size * 0.04;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeText(n, size / 2, size / 2);
  ctx.fillText(n, size / 2, size / 2);

  // Underline 6 and 9
  if (n === 6 || n === 9) {
    const y = size / 2 + size * 0.28;
    const len = size * 0.33;
    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = size * 0.06;
    ctx.moveTo(size / 2 - len / 2, y);
    ctx.lineTo(size / 2 + len / 2, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function D10Mesh({ rolling, targetQuaternion, rollDirection, resetSignal, initialQuaternion, numberMeshes, onRollComplete }) {
  const meshRef = useRef();
  const velocity = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3());
  const hasBounced = useRef(false);

  const geometry = useMemo(() => createD10Geometry(), []);

  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: "#CC9809" }), []);


  useEffect(() => {
    pos.current.set(0, 0, 0);
    velocity.current.set(
      rollDirection[0] * 3,
      rollDirection[1] * 4,
      rollDirection[2] * 3
    );
    hasBounced.current = false;

    if (meshRef.current) {
      meshRef.current.position.set(0, 0, 0);
      meshRef.current.quaternion.copy(initialQuaternion);
    }
  }, [resetSignal, rollDirection, initialQuaternion]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (rolling) {
      velocity.current.y += GRAVITY * delta * 0.6;
      pos.current.addScaledVector(velocity.current, delta);
      mesh.position.copy(pos.current);

      if (pos.current.y < -1.4 && !hasBounced.current) {
        pos.current.y = -1.4;
        velocity.current.y *= -BOUNCE_DAMPING;
        hasBounced.current = true;
      }

      mesh.rotation.x += delta * (7 + Math.random() * 3);
      mesh.rotation.y += delta * (8 + Math.random() * 3);
      mesh.rotation.z += delta * (6 + Math.random() * 2);
      mesh.quaternion.setFromEuler(mesh.rotation);
    } else if (targetQuaternion) {
      mesh.quaternion.slerp(targetQuaternion, Math.min(1, delta * 6));
      mesh.position.lerp(new THREE.Vector3(0, 0, 0), delta * 3);
    }

    numberMeshes.forEach((n) => {
      n.quaternion.copy(mesh.quaternion);
      n.position.copy(mesh.position);
    });
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
}

export default function D10({ onRollComplete }) {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(10);
  const [targetQuat, setTargetQuat] = useState(null);
  const [rollDirection, setRollDirection] = useState([0, 0, 0]);
  const [resetSignal, setResetSignal] = useState(0);
  const [initialQuat, setInitialQuat] = useState(new THREE.Quaternion());
  const diceRef = useRef();

  const geometry = useMemo(() => createD10Geometry(), []);

  const faceData = useMemo(() => {
    const pos = geometry.attributes.position;
    const faces = [];

    const topApex = new THREE.Vector3(0, 0, 1);
    const bottomApex = new THREE.Vector3(0, 0, -1);

    for (let face = 0; face < 10; face++) {
      const tri = face * 2;
      const i0 = tri * 3;

      const v0 = new THREE.Vector3(pos.getX(i0), pos.getY(i0), pos.getZ(i0));
      const v1 = new THREE.Vector3(pos.getX(i0 + 1), pos.getY(i0 + 1), pos.getZ(i0 + 1));
      const v2 = new THREE.Vector3(pos.getX(i0 + 2), pos.getY(i0 + 2), pos.getZ(i0 + 2));

      const center = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);

      const normal = new THREE.Vector3()
        .subVectors(v1, v0)
        .cross(new THREE.Vector3().subVectors(v2, v0))
        .normalize();

      const apexTarget = center.z >= 0 ? topApex : bottomApex;

      const candidates = [v0, v1, v2];
      let best = candidates[0];
      let bestDist = apexTarget.distanceTo(best);

      for (let c of candidates) {
        const d = apexTarget.distanceTo(c);
        if (d < bestDist) {
          best = c;
          bestDist = d;
        }
      }

      const topDir = best.clone().sub(center);

      faces.push({ center, normal, topDir });
    }

    return faces;
  }, [geometry]);

  const numberMeshes = useMemo(() => {
    return faceData.map((f, i) =>
      makeFaceLabel(f.center, f.normal, i + 1, f.topDir)
    );
  }, [faceData]);

  useEffect(() => {
    const { normal } = faceData[9];
    const forward = new THREE.Vector3(0, 0, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(normal, forward);
    setInitialQuat(q);
  }, [faceData]);

  const rollDice = () => {
    if (rolling) return;
    setRolling(true);

    const faceIndex = Math.floor(Math.random() * 10);
    setResult(faceIndex + 1);

    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.5 + 1.2,
      (Math.random() - 0.5) * 2
    ).normalize();

    setRollDirection([dir.x, dir.y, dir.z]);
    setResetSignal((v) => v + 1);

    const forward = new THREE.Vector3(0, 0, 1);
    const { normal } = faceData[faceIndex];
    const target = new THREE.Quaternion().setFromUnitVectors(normal, forward);

    setTimeout(() => {
      setTargetQuat(target);
      setRolling(false);
    }, ROLL_DURATION_MS);
  };

  return (
    <div style={{ width: "100%", height: 400 }}>
      <div style={{ width: "100%", height: "100%", margin: "0 auto" }} onClick={rollDice}>
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={0.9} />

          <D10Mesh
            rolling={rolling}
            targetQuaternion={targetQuat}
            rollDirection={rollDirection}
            resetSignal={resetSignal}
            initialQuaternion={initialQuat}
            numberMeshes={numberMeshes}
            onRollComplete={onRollComplete}
            ref={diceRef}
          />

          {numberMeshes.map((m, i) => (
            <primitive key={i} object={m} />
          ))}

          <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
        </Canvas>
      </div>

      <div style={{ textAlign: "center", marginTop: 10 }}>
        <button onClick={rollDice} disabled={rolling}>
          Roll D10
        </button>
        <div style={{ marginTop: 8 }}>
          Result: <strong>{result}</strong>
        </div>
      </div>
    </div>
  );
}
