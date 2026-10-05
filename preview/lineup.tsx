import { Canvas } from "@react-three/fiber";
import { createRoot } from "react-dom/client";
import Otter from "@/src/lab/three/Otter";
import type { Gear } from "@/src/lab/data/buildings";

const GEARS: Gear[] = ["beretBag", "headset", "apron", "glasses", "captainHat", "cardigan", "scarf", "nametag"];
const anim = (new URLSearchParams(location.search).get("anim") ?? "idle") as "idle";

createRoot(document.getElementById("root")!).render(
  <Canvas flat shadows={{ type: 1 }} camera={{ position: [0, 3.2, 9.5], fov: 34 }} onCreated={({ camera }) => camera.lookAt(0, 0.9, 0)}>
    <color attach="background" args={["#F2FAFF"]} />
    <hemisphereLight args={["#ffffff", "#d6efd9", 1.5]} />
    <directionalLight position={[4, 8, 6]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
    {GEARS.map((g, i) => (
      <group key={g} position={[(i % 4) * 1.6 - 2.4, 0, i < 4 ? -1.2 : 1.2]} rotation={[0, i === 0 ? 0.25 : 0, 0]}>
        <Otter gear={g} anim={anim} seed={i} />
      </group>
    ))}
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial color="#BFE8B0" />
    </mesh>
  </Canvas>,
);
