"use client";
import { BUILDINGS, byId } from "../data/buildings";
import { useLab } from "../store";
import { OTTER_SVG_INNER } from "./otterSvg";

/** 오터랩 마스코트 얼굴 (2D) */
export function OtterFace({ size = 32 }: { size?: number }) {
  return <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" dangerouslySetInnerHTML={{ __html: OTTER_SVG_INNER }} />;
}

export default function Hud() {
  const scene = useLab((s) => s.scene);
  const hint = useLab((s) => s.hint);
  const toast = useLab((s) => s.toast);
  const nearDoor = useLab((s) => s.nearDoor);
  const focus = useLab((s) => s.focus);
  const mapOpen = useLab((s) => s.mapOpen);
  const staff = useLab((s) => s.staff);
  const setMapOpen = useLab((s) => s.setMapOpen);
  const travel = useLab((s) => s.travel);
  const go = useLab((s) => s.go);
  const outside = scene === "outside";
  const where = outside ? "강가" : byId(scene).name;
  const waiting = useLab((s) => s.drafts.filter((d) => d.status === "검토 대기").length);

  return (
    <>
      <header className="hud-top">
        <div className="plate">
          <OtterFace size={34} />
          <div>
            <strong>Otter Lab</strong>
            <span>{where}</span>
          </div>
        </div>
        <div className="hud-actions">
          {!focus && waiting > 0 && (
            <button className="chip chip--alert" onClick={() => travel("cards")}>
              <span className="dot" aria-hidden="true" />
              검토할 초안 {waiting}개
            </button>
          )}
          <button className="btn btn--light" onClick={() => setMapOpen(true)} aria-haspopup="dialog">
            빠른 이동
          </button>
        </div>
      </header>

      {!focus && (
        <div className="hud-bottom">
          {!outside && (
            <button className="btn btn--light" onClick={() => go("outside", scene)}>
              강가로 나가기
            </button>
          )}
          {outside && nearDoor ? (
            <button className="btn btn--primary" onClick={() => go(nearDoor)}>
              {byId(nearDoor).name} 들어가기
              <kbd>E</kbd>
            </button>
          ) : outside && hint ? (
            <p className="hint">가고 싶은 곳을 누르면 걸어가요. 건물을 누르면 안으로 들어가요.</p>
          ) : !outside && hint ? (
            <p className="hint">바닥의 동그라미가 있는 사물을 누르면 작업 창이 열려요.</p>
          ) : null}
        </div>
      )}

      <p className={`toast ${toast ? "toast--on" : ""}`} role="status" aria-live="polite">
        {toast}
      </p>

      {mapOpen && (
        <div className="sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && setMapOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="map-title">
            <header className="sheet__head">
              <h2 id="map-title">어디로 갈까요?</h2>
              <button className="icon-btn" onClick={() => setMapOpen(false)} aria-label="닫기">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            <ul className="places">
              <li>
                <button className={`place ${outside ? "place--here" : ""}`} onClick={() => travel("outside")}>
                  <span className="place__swatch" style={{ background: "#BFE8B0" }} />
                  <span className="place__name">강가</span>
                  <span className="place__who">연구소 바깥 지도</span>
                </button>
              </li>
              {BUILDINGS.map((b) => (
                <li key={b.id}>
                  <button className={`place ${scene === b.id ? "place--here" : ""}`} onClick={() => travel(b.id)}>
                    <span className="place__swatch" style={{ background: b.roof }} />
                    <span className="place__name">{b.name}</span>
                    <span className="place__who">{staff[b.id] ? `${staff[b.id].title} ${staff[b.id].name}` : "나의 방"}</span>
                    <span className="place__what">{b.objects.map((o) => o.label).join(", ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
