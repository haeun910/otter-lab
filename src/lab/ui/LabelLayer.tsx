"use client";
import { BUILDINGS, byId } from "../data/buildings";
import { useLab } from "../store";
import { WALKERS } from "../three/Outside";
import { useLabelRef } from "../three/labels";

function Bubble({ who, text }: { who: string; text: string }) {
  return (
    <div className="bubble">
      <b>{who}</b>
      {text}
    </div>
  );
}

/** 3D 장면 위에 떠 있는 간판·이름표·말풍선 */
export default function LabelLayer() {
  const scene = useLab((s) => s.scene);
  const hover = useLab((s) => s.hover);
  const speech = useLab((s) => s.speech);
  const staff = useLab((s) => s.staff);
  const hidden = useLab((s) => Boolean(s.focus) || s.mapOpen || s.fading);
  const outside = scene === "outside";

  const signRef = useLabelRef;
  const actions = useLab((s) => s.actions);
  const setHover = useLab((s) => s.setHover);
  return (
    <div className={`labels ${hidden ? "labels--hidden" : ""}`} aria-hidden="true">
      {outside ? (
        <>
          {BUILDINGS.map((b) => (
            <div key={b.id} ref={signRef(`sign-${b.id}`)} className="label">
              <button
                className={`sign ${hover === `b-${b.id}` ? "sign--hover" : ""}`}
                onClick={() => actions.enter?.(b.id)}
                onPointerEnter={() => setHover(`b-${b.id}`)}
                onPointerLeave={() => setHover(null)}
                tabIndex={-1}
              >
                <strong>{b.name}</strong>
                <span>{staff[b.id] ? `${staff[b.id].title} ${staff[b.id].name}` : "나의 방"}</span>
              </button>
            </div>
          ))}
          {WALKERS.map((id) => {
            const key = `walker-${id}`;
            return (
              <div key={key} ref={signRef(key)} className="label">
                {speech?.key === key ? (
                  <Bubble who={`${staff[id].title} ${staff[id].name}`} text={speech.text} />
                ) : hover === key ? (
                  <div className="nametag3d">
                    {staff[id].title} {staff[id].name}
                  </div>
                ) : null}
              </div>
            );
          })}
        </>
      ) : (
        <RoomLabels id={scene} hover={hover} />
      )}
    </div>
  );
}

function RoomLabels({ id, hover }: { id: string; hover: string | null }) {
  const b = byId(id);
  const speech = useLab((s) => s.speech);
  const name = useLab((s) => s.staff[id]);
  const ref = useLabelRef;
  const key = `staff-${id}`;
  const actions = useLab((s) => s.actions);
  const setHover = useLab((s) => s.setHover);
  return (
    <>
      {b.objects.map((o) => (
        <div key={o.id} ref={ref(`obj-${o.id}`)} className="label">
          <button
            className={`tag3d ${hover === `o-${o.id}` ? "tag3d--hover" : ""}`}
            onClick={() => actions.use?.(o)}
            onPointerEnter={() => setHover(`o-${o.id}`)}
            onPointerLeave={() => setHover(null)}
            tabIndex={-1}
          >
            {o.label}
          </button>
        </div>
      ))}
      {b.staff && (
        <div ref={ref(key)} className="label">
          {speech?.key === key ? (
            <Bubble who={`${name.title} ${name.name}`} text={speech.text} />
          ) : (
            <div className="nametag3d">
              {name.title} {name.name}
            </div>
          )}
        </div>
      )}
      <div ref={ref("exit")} className="label">
        <button
          className={`tag3d tag3d--exit ${hover === "exit" ? "tag3d--hover" : ""}`}
          onClick={() => actions.exit?.()}
          onPointerEnter={() => setHover("exit")}
          onPointerLeave={() => setHover(null)}
          tabIndex={-1}
        >
          나가기
        </button>
      </div>
    </>
  );
}
