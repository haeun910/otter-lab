"use client";
import { BUILDINGS, byId } from "../data/buildings";
import { DRAFTS } from "../data/demo";
import { useLab } from "../store";

/** 오터랩 마스코트 얼굴 (2D) */
export function OtterFace({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <ellipse cx="9.5" cy="29" rx="4.6" ry="4" fill="#7A5136" />
      <ellipse cx="54.5" cy="29" rx="4.6" ry="4" fill="#7A5136" />
      <ellipse cx="32" cy="36" rx="26" ry="19" fill="#A8754F" />
      <ellipse cx="32" cy="45" rx="17" ry="9" fill="#FCEBD5" />
      <ellipse cx="26.5" cy="42" rx="6.6" ry="5.4" fill="#FCEBD5" />
      <ellipse cx="37.5" cy="42" rx="6.6" ry="5.4" fill="#FCEBD5" />
      <ellipse cx="32" cy="38.6" rx="4.8" ry="3.1" fill="#4A3326" />
      <circle cx="31" cy="37.8" r="0.9" fill="#fff" />
      <path d="M29.5 46.2 Q32 48.4 34.5 46.2" stroke="#4A3326" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <circle cx="23" cy="42.5" r="0.9" fill="#7A5136" />
      <circle cx="21" cy="45" r="0.9" fill="#7A5136" />
      <circle cx="41" cy="42.5" r="0.9" fill="#7A5136" />
      <circle cx="43" cy="45" r="0.9" fill="#7A5136" />
      <circle cx="20.5" cy="33" r="3.2" fill="#2A2230" />
      <circle cx="43.5" cy="33" r="3.2" fill="#2A2230" />
      <circle cx="21.7" cy="31.8" r="1.1" fill="#fff" />
      <circle cx="44.7" cy="31.8" r="1.1" fill="#fff" />
      <ellipse cx="15" cy="40.5" rx="3.6" ry="2.2" fill="#FF9FAE" opacity="0.6" />
      <ellipse cx="49" cy="40.5" rx="3.6" ry="2.2" fill="#FF9FAE" opacity="0.6" />
      <ellipse cx="35" cy="17.5" rx="15.5" ry="5.6" fill="#FF9A8A" transform="rotate(-12 35 17.5)" />
      <circle cx="36" cy="12.6" r="2.4" fill="#EE6B57" />
    </svg>
  );
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
  const waiting = DRAFTS.filter((d) => d.status === "검토 대기").length;

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
