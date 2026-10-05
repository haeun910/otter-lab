"use client";
import { useEffect, useRef } from "react";
import type { PanelKind } from "../data/buildings";
import { useLab } from "../store";
import {
  BlogPanel,
  BrandPanel,
  CardEditorPanel,
  DraftsPanel,
  InboxPanel,
  LibraryPanel,
  MailboatPanel,
  PrinterPanel,
  RosterPanel,
  StatsPanel,
} from "./panels/Panels";
import { MeetingPanel, MinutesPanel } from "./panels/Meeting";

// 사물마다 작업 창의 겉모습이 달라요 (모니터, 원고지, 코르크판…)
const FRAME: Record<PanelKind, { frame: string; sub: string }> = {
  inbox: { frame: "monitor", sub: "오늘 강을 타고 도착한 소식이에요" },
  cardEditor: { frame: "monitor", sub: "카드뉴스 초안을 고쳐요" },
  printer: { frame: "print", sub: "완성된 카드를 이미지로 뽑아요" },
  blogDesk: { frame: "paper", sub: "네이버 블로그에 올릴 글이에요" },
  mailboat: { frame: "postcard", sub: "확인한 카드뉴스를 인스타그램으로 보내요" },
  library: { frame: "book", sub: "지난 소식을 찾아봐요" },
  stats: { frame: "cork", sub: "게시물 반응을 모아 봤어요" },
  roster: { frame: "note", sub: "오터랩 연구원들이에요" },
  brand: { frame: "desk", sub: "오터랩의 이름, 말투, 운영 방식을 정해요" },
  drafts: { frame: "drawer", sub: "지금까지 만든 초안이에요" },
  meeting: { frame: "desk", sub: "오늘의 안건을 듣고 무엇을 만들지 정해요" },
  minutes: { frame: "cork", sub: "지난 회의 기록과 회의 시간이에요" },
};

function Body({ kind }: { kind: PanelKind }) {
  switch (kind) {
    case "inbox":
      return <InboxPanel />;
    case "cardEditor":
      return <CardEditorPanel />;
    case "printer":
      return <PrinterPanel />;
    case "blogDesk":
      return <BlogPanel />;
    case "mailboat":
      return <MailboatPanel />;
    case "library":
      return <LibraryPanel />;
    case "stats":
      return <StatsPanel />;
    case "roster":
      return <RosterPanel />;
    case "brand":
      return <BrandPanel />;
    case "drafts":
      return <DraftsPanel />;
    case "meeting":
      return <MeetingPanel />;
    case "minutes":
      return <MinutesPanel />;
  }
}

export default function PanelHost() {
  const focus = useLab((s) => s.focus);
  const open = useLab((s) => s.panelOpen);
  const close = useLab((s) => s.closeFocus);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!focus || !open) return null;
  const f = FRAME[focus.panel];
  return (
    <div className="panel-wrap" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="panel-title" className={`panel panel--${f.frame}`}>
        <header className="panel__head">
          <div>
            <h2 id="panel-title">{focus.label}</h2>
            <p>{f.sub}</p>
          </div>
          <button className="btn btn--light" onClick={close}>
            닫기
          </button>
        </header>
        <div className="panel__body">
          <Body kind={focus.panel} />
        </div>
      </div>
    </div>
  );
}
