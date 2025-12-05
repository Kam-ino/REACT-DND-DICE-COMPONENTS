import React, { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";

const ROLL_DURATION_MS = 1800;
const GRAVITY = -9.8;
const BOUNCE_DAMPING = 0.5;

/* =====================================================
   Number Sprite
===================================================== */
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
  ctx.font = `${Math.floor(size * 0.7)}px sans-serif`;

  ctx.lineWidth = size * 0.045;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeText(n, size/2, size/2);
  ctx.fillText(n, size/2, size/2);

  if (n === 6 || n === 9) {
    const y = size/2 + size*0.28;
    const len = size*0.33;
    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = size*0.07;
    ctx.moveTo(size/2 - len/2, y);
    ctx.lineTo(size/2 + len/2, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/* =====================================================
   Base Geometry
===================================================== */
function createD12Geometry() {
  const g = new THREE.DodecahedronGeometry(1);
  return g.toNonIndexed(); // matches all your other dice components
}

/* =====================================================
   Label placement (perfectly flat & aligned)
===================================================== */
function makeFaceLabel(center, normal, number, offsetX = 0.175, offsetY = 0.2, scale = 0.55) {
  const group = new THREE.Group();

  const n = normal.clone().normalize();        // face normal
  const worldUp = new THREE.Vector3(0, 1, 0);  // stable upright

  // Compute right = worldUp × normal
  let right = new THREE.Vector3().crossVectors(worldUp, n);

  // If nearly vertical, use worldForward instead
  if (right.lengthSq() < 0.0001) {
    right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), n);
  }
  right.normalize();

  // Compute up = normal × right
  const up = new THREE.Vector3().crossVectors(n, right).normalize();

  // Build rotation quaternion
  const mat = new THREE.Matrix4().makeBasis(right, up, n);
  const q = new THREE.Quaternion().setFromRotationMatrix(mat);

  // Create number texture
  const tex = makeNumberSprite(number);

  // Create plane mesh for the number
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(scale, scale),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide
    })
  );

  // Position slightly above the face
  const base = center.clone().add(n.clone().multiplyScalar(0.001));

  // Apply per-number manual offsets IN face-plane coordinates
  const offset = right.clone().multiplyScalar(offsetX)
    .add(up.clone().multiplyScalar(offsetY));

  label.position.copy(base.add(offset));
  label.quaternion.copy(q);

  group.add(label);
  return group;
}



/* =====================================================
   D12 Mesh (rolling physics)
===================================================== */
function D12Mesh({
  rolling,
  targetQuaternion,
  rollDirection,
  resetSignal,
  initialQuaternion,
  numberMeshes
}) {
  const meshRef = useRef();
  const pos = useRef(new THREE.Vector3());
  const vel = useRef(new THREE.Vector3());
  const bounced = useRef(false);

  const geometry = useMemo(() => createD12Geometry(), []);

  useEffect(() => {
    pos.current.set(0, 0, 0);
    vel.current.set(
      rollDirection[0]*3,
      rollDirection[1]*4,
      rollDirection[2]*3
    );
    bounced.current = false;

    if (meshRef.current) {
      meshRef.current.position.set(0,0,0);
      meshRef.current.quaternion.copy(initialQuaternion);
    }
  }, [resetSignal, rollDirection, initialQuaternion]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (rolling) {

      vel.current.y += GRAVITY * delta * 0.6;
      pos.current.addScaledVector(vel.current, delta);
      mesh.position.copy(pos.current);

      if (pos.current.y < -1.4 && !bounced.current) {
        pos.current.y = -1.4;
        vel.current.y *= -BOUNCE_DAMPING;
        bounced.current = true;
      }

      mesh.rotation.x += delta * (7 + Math.random()*3);
      mesh.rotation.y += delta * (9 + Math.random()*3);
      mesh.rotation.z += delta * (6 + Math.random()*2);
      mesh.quaternion.setFromEuler(mesh.rotation);

    } else if (targetQuaternion) {
      mesh.quaternion.slerp(targetQuaternion, delta * 6);
      mesh.position.lerp(new THREE.Vector3(0,0,0), delta * 3);
    }

    numberMeshes.forEach(m => {
      m.position.copy(mesh.position);
      m.quaternion.copy(mesh.quaternion);
    });
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial color="#AF0202" roughness={0.9} metalness={0.0}/>
    </mesh>
  );
}

/* =====================================================
   MAIN D12
===================================================== */
export default function D12({ onRollComplete }) {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(12);
  const [targetQuat, setTargetQuat] = useState(null);
  const [rollDirection, setRollDirection] = useState([0,0,0]);
  const [rollStartTime, setRollStartTime] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const diceRef = useRef();

  const geometry = useMemo(() => createD12Geometry(), []);

  /* Build face data (12 faces) */
  const faceData = useMemo(() => {
    const pos = geometry.attributes.position;
    const faces = [];

    for (let f = 0; f < 12; f++) {
      const tri0 = f * 3 * 3;

      const v0 = new THREE.Vector3(pos.getX(tri0), pos.getY(tri0), pos.getZ(tri0));
      const v1 = new THREE.Vector3(pos.getX(tri0+1), pos.getY(tri0+1), pos.getZ(tri0+1));
      const v2 = new THREE.Vector3(pos.getX(tri0+2), pos.getY(tri0+2), pos.getZ(tri0+2));

      const center = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);

      const normal = new THREE.Vector3()
        .subVectors(v1, v0)
        .cross(new THREE.Vector3().subVectors(v2, v0))
        .normalize();

      faces.push({ center, normal });
    }

    return faces;
  }, [geometry]);

  /* Create flat number labels */
  const numberMeshes = useMemo(() => {
    return faceData.map((f, i) => makeFaceLabel(f.center, f.normal, i+1));
  }, [faceData]);

  /* Initial orientation = face 12 upward */
  const initialQuaternion = useMemo(() => {
    const faceIndex = 11; // face #12
    const forward = new THREE.Vector3(0,0,1);
    const q = new THREE.Quaternion().setFromUnitVectors(
      faceData[faceIndex].normal,
      forward
    );
    return q;
  }, [faceData]);

  /* Rolling logic */
  const rollDice = () => {
    if (rolling) return;
    setRolling(true);
    setRollStartTime(performance.now() / 1000);

    const faceIndex = Math.floor(Math.random() * 12);  // Random face between 1 and 12
    const faceNumber = faceIndex + 1;
    setResult(faceNumber);  // Update the dice result

    // Generate random direction for rolling
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.5 + 1.2,
      (Math.random() - 0.5) * 2
    ).normalize();
    setRollDirection([dir.x, dir.y, dir.z]);  // Update roll direction
    setResetSignal((s) => s + 1);  // Trigger reset

    // Compute the correct final quaternion for the chosen face
    const tempGeo = new THREE.IcosahedronGeometry(1).toNonIndexed();
    tempGeo.computeVertexNormals();
    const normals = tempGeo.attributes.normal;
    const i0 = faceIndex * 3;
    const n0 = new THREE.Vector3().fromBufferAttribute(normals, i0);
    const n1 = new THREE.Vector3().fromBufferAttribute(normals, i0 + 1);
    const n2 = new THREE.Vector3().fromBufferAttribute(normals, i0 + 2);
    const faceNormal = new THREE.Vector3().add(n0).add(n1).add(n2).divideScalar(3).normalize();

    const up = new THREE.Vector3(0, 0, 1); // Camera forward
    const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(faceNormal, up);

    // After the roll, smoothly rotate to the rolled face
    setTimeout(() => {
      setRolling(false);     // End animation
      setTargetQuat(targetQuaternion);  // Set the quaternion to face the correct side
      if (onRollComplete) {
        onRollComplete(faceNumber);  // Notify parent with the result
      }
    }, ROLL_DURATION_MS);  // Small buffer for realism
  };


  return (
    <div style={{ width: "100%", height:400}}>
      <div style={{ width: "100%", height: "100%", margin: "0 auto" }} onClick={rollDice}>
        <Canvas camera={{ position:[0,0,4], fov:50 }}>
          <ambientLight intensity={0.8}/>
          <directionalLight intensity={0.9} position={[5,5,5]}/>

          <D12Mesh
            rolling={rolling}
            targetQuaternion={targetQuat}
            rollDirection={rollDirection}
            resetSignal={resetSignal}
            initialQuaternion={initialQuaternion}
            numberMeshes={numberMeshes}
          />

          {numberMeshes.map((m,i)=>(
            <primitive key={i} object={m}/>
          ))}

          <OrbitControls enableZoom={false} enablePan={false} enableRotate={false}/>
        </Canvas>
      </div>
    </div>
  );
}
