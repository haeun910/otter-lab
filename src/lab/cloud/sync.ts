// 로그인한 뒤 연구소 데이터를 Supabase와 맞춰요.
// 처음엔 클라우드에서 불러오고(비어 있으면 이 브라우저 데이터를 올리고), 그다음엔 바뀐 것만 올려요.
// 화면으로 돌아오면 자동 회의가 만든 초안·회의록을 다시 불러와요.
import { useLab, type SavedData } from "../store";
import { diffRows, fromRows, pickCloud, toRows, type CloudData } from "./mapping";
import { deleteRows, selectRows, upsertRows, type Cloud } from "./rest";

let cloud: Cloud | null = null;
let snapshot: CloudData | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let flushing: Promise<void> | null = null;
let again = false;
let stop: (() => void) | null = null;

const state = () => pickCloud(useLab.getState() as unknown as CloudData);

async function flushNow() {
  if (!cloud || !snapshot) return;
  const next = state();
  const { upserts, deletes } = diffRows(snapshot, next);
  if (!upserts.length && !deletes.length) return;
  useLab.getState().setCloud("saving");
  try {
    if (upserts.length) await upsertRows(cloud, upserts);
    for (const d of deletes) await deleteRows(cloud, d.kind, d.ids);
    snapshot = next;
    useLab.getState().setCloud("saved");
  } catch {
    useLab.getState().setCloud("error");
    timer = setTimeout(flush, 15_000); // 잠시 뒤 다시
  }
}

/** 쌓인 변경을 올려요 (겹쳐 부르면 끝난 뒤 한 번 더) */
export async function flush(): Promise<void> {
  if (flushing) {
    again = true;
    return flushing;
  }
  flushing = flushNow().finally(() => {
    flushing = null;
    if (again) {
      again = false;
      void flush();
    }
  });
  return flushing;
}

/** 올릴 건 올리고, 클라우드 것을 다시 불러와요 (자동 회의 결과 받기) */
export async function pull() {
  if (!cloud) return;
  await flush();
  const rows = await selectRows(cloud);
  useLab.getState().importData(fromRows(rows) as Partial<SavedData>);
  snapshot = state();
  useLab.getState().setCloud("saved");
}

export async function startSync(c: Cloud) {
  stopSync();
  cloud = c;
  useLab.getState().setCloud("saving");
  const rows = await selectRows(c);
  if (rows.length) {
    useLab.getState().importData(fromRows(rows) as Partial<SavedData>);
  } else {
    // 첫 연결: 이 브라우저에서 하던 것을 그대로 올려요
    await upsertRows(c, toRows(state()));
  }
  snapshot = state();
  useLab.getState().setCloud("saved");

  const unsub = useLab.subscribe((s, prev) => {
    if (s.projects === prev.projects && s.library === prev.library && s.drafts === prev.drafts && s.posts === prev.posts && s.meetings === prev.meetings && s.brand === prev.brand && s.staff === prev.staff && s.schedule === prev.schedule && s.inbox === prev.inbox && s.lastFetch === prev.lastFetch) return;
    clearTimeout(timer);
    timer = setTimeout(flush, 1200);
  });
  const onVisible = () => {
    if (document.visibilityState === "visible") void pull().catch(() => useLab.getState().setCloud("error"));
    else void flush();
  };
  document.addEventListener("visibilitychange", onVisible);
  const every = setInterval(() => void pull().catch(() => useLab.getState().setCloud("error")), 5 * 60_000);
  stop = () => {
    unsub();
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(every);
  };
}

export function stopSync() {
  stop?.();
  stop = null;
  cloud = null;
  snapshot = null;
  clearTimeout(timer);
  useLab.getState().setCloud("off");
}
