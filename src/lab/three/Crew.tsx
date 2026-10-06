"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { openAgenda } from "../company";
import { BUILDINGS, ROOM, SITE, byId, toWorld, type Gear, type Side } from "../data/buildings";
import { NavGrid, type Blocker } from "../nav/grid";
import { live, useLab } from "../store";
import { wallPieces } from "./walls";
import { FOOTPRINT, SEATS, SEAT_R } from "./Furniture";
import { Anchor } from "./labels";
import Otter, { type OtterAnim } from "./Otter";

// 방마다 직원이 일하는 자리 (방 기준 좌표)
const DESK: Record<string, [number, number]> = {
  receiver: [1.3, -1.15],
  cards: [-2.55, -1.05],
  blog: [1.45, -1.15],
  dock: [-2.4, 0.3],
  library: [-1.95, -0.85],
  stats: [1.65, -0.95],
  dorm: [-0.95, -0.95],
  office: [-1, -2.05], // 소장 책상 뒤
};

export interface Member {
  id: string; // 방 id (소장은 "me")
  room: string;
  gear: Gear;
  seat: number;
}

/** 소장(나)과 직원 7명. 회의 탁자 자리 순서대로예요 */
export const CREW: Member[] = [
  { id: "me", room: "office", gear: "beretBag", seat: 0 },
  ...BUILDINGS.filter((b) => b.staff).map((b, i) => ({ id: b.id, room: b.id, gear: b.staff!.gear, seat: i + 1 })),
];

function buildNav() {
  const blockers: Blocker[] = [];
  for (const b of BUILDINGS) {
    if (!b.open) {
      for (const side of ["n", "s", "e", "w"] as Side[])
        for (const p of wallPieces(side, b.doors.includes(side))) blockers.push({ kind: "rect", x: b.pos[0] + p.x, z: b.pos[1] + p.z, w: p.w, d: p.d, rot: 0 });
    }
    for (const o of b.objects) {
      const [x, z] = toWorld(b, o.pos);
      if (o.furniture === "roundTable") blockers.push({ kind: "circle", x, z, r: 1.55 });
      else if (o.furniture !== "boat") blockers.push({ kind: "rect", x, z, w: FOOTPRINT[o.furniture].w, d: FOOTPRINT[o.furniture].d, rot: o.rot ?? 0 });
    }
  }
  // 둘레 담 (앞 가운데 현관 길만 열려 있어요)
  const T = 0.4;
  blockers.push(
    { kind: "rect", x: 0, z: SITE.minZ, w: SITE.maxX - SITE.minX, d: T, rot: 0 },
    { kind: "rect", x: SITE.minX, z: 0, w: T, d: SITE.maxZ - SITE.minZ, rot: 0 },
    { kind: "rect", x: SITE.maxX, z: 0, w: T, d: SITE.maxZ - SITE.minZ, rot: 0 },
    { kind: "rect", x: (SITE.minX - 0.9) / 2, z: SITE.maxZ, w: -0.9 - SITE.minX, d: T, rot: 0 },
    { kind: "rect", x: (SITE.maxX + 0.9) / 2, z: SITE.maxZ, w: SITE.maxX - 0.9, d: T, rot: 0 },
  );
  // 강 (선착장 잔교만 건널 수 있어요)
  const dock = byId("dock");
  const bank = SITE.riverZ - SITE.riverWidth / 2;
  const [dx0, dx1] = [dock.pos[0] - ROOM.w / 2, dock.pos[0] + ROOM.w / 2];
  blockers.push(
    { kind: "rect", x: (dx0 - 40) / 2, z: SITE.riverZ, w: dx0 + 40, d: SITE.riverWidth, rot: 0 },
    { kind: "rect", x: (dx1 + 40) / 2, z: SITE.riverZ, w: 40 - dx1, d: SITE.riverWidth, rot: 0 },
  );
  return new NavGrid(
    { minX: SITE.minX - 0.6, maxX: dx1 + 0.5, minZ: SITE.minZ - 0.6, maxZ: Math.max(bank, dock.pos[1] + ROOM.d / 2) + 0.2 },
    0.2,
    blockers,
    0.28,
  );
}

const meeting = byId("meeting");
const table = meeting.objects.find((o) => o.furniture === "roundTable")!;
const TABLE = toWorld(meeting, table.pos);

function seatOf(i: number): { x: number; z: number; heading: number } {
  const a = (i / SEATS) * Math.PI * 2;
  return { x: TABLE[0] + Math.sin(a) * SEAT_R, z: TABLE[1] + Math.cos(a) * SEAT_R, heading: a + Math.PI };
}

function homeOf(m: Member, nav: NavGrid): { x: number; z: number; heading: number } {
  const b = byId(m.room);
  const [x, z] = toWorld(b, DESK[m.room] ?? [0, 0]);
  // 하던 일을 하면서도 얼굴은 방 앞쪽(카메라 쪽)으로 비스듬히
  const target = toWorld(b, b.objects[0]?.pos ?? [0, 0]);
  const heading = m.id === "me" ? 0 : Math.atan2(target[0] - x, target[1] + 6 - z);
  return { x, z, heading };
}

const SPEED = 2.6;
const WALK = 3.2; // 내가 키보드로 움직일 때 속도
const KEYMAP: Record<string, [number, number]> = {
  w: [0, 1],
  arrowup: [0, 1],
  s: [0, -1],
  arrowdown: [0, -1],
  a: [-1, 0],
  arrowleft: [-1, 0],
  d: [1, 0],
  arrowright: [1, 0],
};
const fwd = new THREE.Vector3();

/** 이 자리가 들어 있는 방 (복도면 null) */
function roomAt(x: number, z: number) {
  return BUILDINGS.find((b) => Math.abs(x - b.pos[0]) < ROOM.w / 2 && Math.abs(z - b.pos[1]) < ROOM.d / 2)?.id ?? null;
}

function CrewOtter({ m, nav, index }: { m: Member; nav: NavGrid; index: number }) {
  const home = useMemo(() => homeOf(m, nav), [m, nav]);
  const seat = useMemo(() => seatOf(m.seat), [m.seat]);
  const grp = useRef<THREE.Group>(null);
  const anim = useRef<OtterAnim>("work");
  const st = useRef({
    x: home.x,
    z: home.z,
    heading: home.heading,
    path: [] as [number, number][],
    goal: "home" as "home" | "seat",
    wait: 0,
    waveUntil: 0,
    free: false, // 내가 키보드로 옮겨 놓은 자리에 그대로 있어요
  });
  const key = `staff-${m.id}`;

  useFrame(({ clock, camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = st.current;
    const phase = useLab.getState().phase;
    // 나(소장)는 WASD·방향키로 걸어 다녀요 (회의 중에는 자리에 앉아 있어요)
    let walked = false;
    if (m.id === "me" && phase === "work" && live.keys.size) {
      let ix = 0;
      let iz = 0;
      live.keys.forEach((k) => {
        const v = KEYMAP[k];
        if (v) {
          ix += v[0];
          iz += v[1];
        }
      });
      if (ix || iz) {
        // 화면 기준 방향: W는 화면 위쪽(안쪽)으로
        camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        const rx = -fwd.z;
        const rz = fwd.x;
        let mx = fwd.x * iz + rx * ix;
        let mz = fwd.z * iz + rz * ix;
        const len = Math.hypot(mx, mz) || 1;
        mx = (mx / len) * WALK * dt;
        mz = (mz / len) * WALK * dt;
        // 막히면 벽을 따라 미끄러지듯 (갇힌 자리에서는 어느 쪽으로든 빠져나와요)
        const stuck = !nav.isFree(s.x, s.z);
        if (stuck || nav.isFree(s.x + mx, s.z + mz)) {
          s.x += mx;
          s.z += mz;
        } else if (nav.isFree(s.x + mx, s.z)) s.x += mx;
        else if (nav.isFree(s.x, s.z + mz)) s.z += mz;
        let turn = Math.atan2(mx, mz) - s.heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        s.heading += turn * Math.min(1, dt * 12);
        s.path = [];
        s.wait = 0;
        s.free = true;
        walked = true;
        // 다른 방으로 들어가면 카메라도 그 방으로 따라가요
        const ui = useLab.getState();
        const room = roomAt(s.x, s.z);
        if (ui.scene !== "overview" && room && room !== ui.scene && !ui.focus) ui.travel(room);
      }
    }
    const goal = phase === "gathering" || phase === "meeting" ? "seat" : "home";
    if (goal !== s.goal) {
      s.goal = goal;
      s.free = false;
      const t = goal === "seat" ? seat : home;
      // 길찾기는 빈 칸까지만 가니까, 마지막엔 정확한 자리로 한 걸음 더
      s.path = [...nav.findPath([s.x, s.z], [t.x, t.z]), [t.x, t.z]];
      s.wait = index * 0.35; // 한 명씩 차례로 일어나요
    }
    const target = s.goal === "seat" ? seat : home;
    if (walked) {
      // 이번 프레임은 키보드로 움직였어요
    } else if (s.wait > 0) {
      s.wait -= dt;
    } else if (s.path.length) {
      const [tx, tz] = s.path[0];
      const dx = tx - s.x;
      const dz = tz - s.z;
      const d = Math.hypot(dx, dz);
      const step = SPEED * dt;
      if (d <= step) {
        s.x = tx;
        s.z = tz;
        s.path.shift();
      } else {
        s.x += (dx / d) * step;
        s.z += (dz / d) * step;
        const want = Math.atan2(dx, dz);
        let turn = want - s.heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        s.heading += turn * Math.min(1, dt * 10);
      }
    } else if (!s.free) {
      let turn = target.heading - s.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      s.heading += turn * Math.min(1, dt * 6);
    }
    const moving = walked || (s.wait <= 0 && s.path.length > 0);
    if (s.waveUntil < 0) s.waveUntil = clock.elapsedTime + 2;
    const writing = useLab.getState().writing.includes(m.id);
    anim.current =
      clock.elapsedTime < s.waveUntil ? "wave" : moving ? "walk" : s.goal === "seat" || s.free ? "idle" : m.id === "me" && !writing ? "idle" : "work";
    if (grp.current) {
      grp.current.position.set(s.x, 0, s.z);
      grp.current.rotation.y = s.heading;
    }
    if (grp.current) (grp.current as THREE.Group & { arrived?: boolean }).arrived = s.wait <= 0 && s.path.length === 0;
  });

  return (
    <group ref={grp} name={`crew-${m.id}`}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > 8) return;
          st.current.waveUntil = -1; // 다음 프레임부터 2초간 손을 흔들어요
          useLab.getState().setSpeech({ key, text: staffLine(m.id) });
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          useLab.getState().setHover(key);
        }}
        onPointerOut={() => useLab.getState().setHover(null)}
      >
        <Otter gear={m.gear} animRef={anim} scale={m.id === "me" ? 0.92 : 0.86} seed={index + 1} />
      </group>
      <Anchor id={key} position={[0, 1.7, 0]} />
    </group>
  );
}

/** 직원을 누르면 하는 말 (지금 연구소 상황에 맞춰서) */
export function staffLine(id: string): string {
  const st = useLab.getState();
  const waiting = st.drafts.filter((d) => d.status === "검토 대기").length;
  if (st.phase === "gathering") return "회의실로 가는 중이에요!";
  if (st.writing.includes(id)) return id === "cards" ? "카드 문구 쓰는 중이에요. 조금만 기다려 주세요!" : "블로그 글 쓰는 중이에요. 금방 끝나요!";
  switch (id) {
    case "me":
      return "오늘도 좋은 소식을 골라 볼까요?";
    case "receiver":
      return `오늘 소식 ${st.inbox.length}개가 들어와 있어요. 회의 때 추천 소식을 골라 갈게요!`;
    case "cards":
      return waiting ? `검토할 카드뉴스가 ${waiting}개 있어요. 작업 모니터에서 봐 주세요!` : "다음 회의에서 주제를 정해 주시면 카드를 만들게요.";
    case "blog":
      return waiting ? "블로그 원고도 같이 써 뒀어요. 원고 책상에 있어요." : "오늘은 어떤 글을 써 볼까요?";
    case "dock":
      return waiting ? `게시를 기다리는 초안이 ${waiting}개예요. 확인해 주시면 우편선 띄울게요!` : "지금은 띄울 우편선이 없어요. 쉬는 중!";
    case "stats": {
      const real = st.posts.filter((p) => !p.sample);
      return real.length
        ? `게시물 ${real.length}개의 반응을 모으고 있어요. 수치를 적어 주시면 분석할게요.`
        : "아직 진짜 게시물이 없어서 예시 수치로 연습 중이에요.";
    }
    case "library":
      return `지금까지 모은 소식이 ${st.library.length.toLocaleString()}건이에요.`;
    case "dorm":
      return "연구원들 이름과 역할은 명부에서 바꿀 수 있어요.";
    default:
      return byId(id).staff?.line ?? "";
  }
}

export default function Crew() {
  const nav = useMemo(buildNav, []);
  const root = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    // 모두 도착했는지 세어서, 회의를 열거나 업무로 돌아가요
    let arrived = 0;
    g.children.forEach((c) => {
      if ((c as THREE.Object3D & { arrived?: boolean }).arrived) arrived++;
    });
    const phase = useLab.getState().phase;
    if (phase === "gathering") {
      live.seated = arrived;
      if (arrived === CREW.length) openAgenda();
    } else if (phase === "returning") {
      live.atDesk = arrived;
      if (arrived === CREW.length) useLab.getState().setPhase("work");
    }
  });
  return (
    <group ref={root}>
      {CREW.map((m, i) => (
        <CrewOtter key={m.id} m={m} nav={nav} index={i} />
      ))}
    </group>
  );
}
