"use client";
import { useMemo, useState } from "react";
import { BUILDINGS } from "../../data/buildings";
import { BLOGS, DRAFTS, NEWS, STATS } from "../../data/demo";
import { useLab } from "../../store";
import CardPreview from "../CardPreview";

const CATS = ["전체", "AI", "개발", "업계"] as const;
const fmtTime = (t: number) =>
  new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(t);

async function copyText(text: string, done: string) {
  const say = useLab.getState().say;
  try {
    await navigator.clipboard.writeText(text);
    say(done);
  } catch {
    say("복사하지 못했어요. 글을 직접 선택해서 복사해 주세요.");
  }
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} aria-pressed={value === o} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

// ---------- 수신 모니터 ----------
export function InboxPanel() {
  const [cat, setCat] = useState<(typeof CATS)[number]>("전체");
  const basket = useLab((s) => s.basket);
  const toggle = useLab((s) => s.toggleBasket);
  const say = useLab((s) => s.say);
  const list = NEWS.filter((n) => cat === "전체" || n.category === cat);
  return (
    <div className="pn">
      <div className="pn__bar">
        <Seg value={cat} options={CATS} onChange={setCat} label="분야" />
        <span className="muted">{list.length}개 도착</span>
      </div>
      <ul className="news">
        {list.map((n) => {
          const on = basket.includes(n.link);
          return (
            <li key={n.link} className={on ? "news--on" : ""}>
              <button className="pick" aria-pressed={on} onClick={() => toggle(n.link)} aria-label={on ? "담기 취소" : "담기"}>
                {on ? "✓" : "+"}
              </button>
              <div className="news__main">
                <p className="news__meta">
                  <span className={`cat cat--${n.category}`}>{n.category}</span>
                  {n.source}
                  <span className="muted">{fmtTime(n.publishedAt)}</span>
                </p>
                <a href={n.link} target="_blank" rel="noreferrer" className="news__title">
                  {n.title}
                </a>
                {n.excerpt && <p className="news__ex">{n.excerpt}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <footer className="pn__foot">
        <span className="muted">{basket.length ? `${basket.length}개 담았어요` : "카드뉴스로 만들 소식을 담아 보세요"}</span>
        <button
          className="btn btn--primary"
          disabled={!basket.length}
          onClick={() => say(`소식 ${basket.length}개를 카드뉴스 공방과 블로그 서재로 보냈어요. 실제 초안 만들기는 3단계에서 연결돼요.`)}
        >
          초안 만들어 달라고 하기
        </button>
      </footer>
    </div>
  );
}

// ---------- 카드 편집 ----------
export function CardEditorPanel() {
  const decks = useLab((s) => s.decks);
  const brand = useLab((s) => s.brand);
  const editCard = useLab((s) => s.editCard);
  const editCaption = useLab((s) => s.editCaption);
  const [deckId, setDeckId] = useState(decks[0].id);
  const [sel, setSel] = useState(0);
  const deck = decks.find((d) => d.id === deckId)!;
  const card = deck.cards[Math.min(sel, deck.cards.length - 1)];
  const deep = deck.type === "심층";
  return (
    <div className="pn">
      <div className="pn__bar">
        <Seg
          value={deck.type}
          options={["묶음", "심층"] as const}
          onChange={(t) => {
            setDeckId(decks.find((d) => d.type === t)!.id);
            setSel(0);
          }}
          label="초안 종류"
        />
        <span className="muted">카드 {deck.cards.length}장</span>
      </div>
      <div className="strip" role="list">
        {deck.cards.map((c, i) => (
          <button key={i} role="listitem" className={`strip__item ${i === sel ? "strip__item--on" : ""}`} onClick={() => setSel(i)} aria-label={`${i + 1}번째 카드`}>
            <CardPreview card={c} page={i + 1} total={deck.cards.length} handle={brand.handle} series={brand.series} deep={deep} />
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="edit">
        <div className="edit__big">
          <CardPreview card={card} page={sel + 1} total={deck.cards.length} handle={brand.handle} series={brand.series} deep={deep} />
        </div>
        <div className="edit__fields">
          {card.kind === "body" && (
            <label className="field">
              <span>꼬리표</span>
              <input id={`tag-${deckId}-${sel}`} value={card.tag ?? ""} onChange={(e) => editCard(deckId, sel, { tag: e.target.value })} />
            </label>
          )}
          <label className="field">
            <span>제목</span>
            <input id={`title-${deckId}-${sel}`} value={card.title} onChange={(e) => editCard(deckId, sel, { title: e.target.value })} />
          </label>
          <label className="field">
            <span>내용</span>
            <textarea id={`body-${deckId}-${sel}`} rows={4} value={card.body} onChange={(e) => editCard(deckId, sel, { body: e.target.value })} />
          </label>
          <label className="field">
            <span>캡션</span>
            <textarea id={`cap-${deckId}`} rows={5} value={deck.caption} onChange={(e) => editCaption(deckId, e.target.value)} />
          </label>
          <p className="tags">{deck.hashtags.join(" ")}</p>
        </div>
      </div>
    </div>
  );
}

// ---------- 인쇄기 ----------
export function PrinterPanel() {
  const decks = useLab((s) => s.decks);
  const brand = useLab((s) => s.brand);
  const say = useLab((s) => s.say);
  return (
    <div className="pn">
      {decks.map((d) => (
        <section key={d.id} className="print">
          <h3>
            {d.type} 카드뉴스 <span className="muted">{d.cards.length}장</span>
          </h3>
          <div className="print__grid">
            {d.cards.map((c, i) => (
              <CardPreview key={i} card={c} page={i + 1} total={d.cards.length} handle={brand.handle} series={brand.series} deep={d.type === "심층"} />
            ))}
          </div>
        </section>
      ))}
      <footer className="pn__foot">
        <span className="muted">3단계부터 1080×1350 이미지로 인쇄돼서 휴대폰에 저장할 수 있어요.</span>
        <button className="btn btn--primary" onClick={() => say("1단계에서는 미리보기만 있어요. 이미지 저장은 3단계에서 연결돼요.")}>
          이미지로 인쇄하기
        </button>
      </footer>
    </div>
  );
}

// ---------- 블로그 원고 ----------
export function BlogPanel() {
  const [type, setType] = useState<"묶음" | "심층">("묶음");
  const b = BLOGS.find((x) => x.type === type)!;
  const body = [b.intro, ...b.sections.map((s) => `■ ${s.heading}\n\n${s.body}`), b.outro].join("\n\n");
  return (
    <div className="pn">
      <div className="pn__bar">
        <Seg value={type} options={["묶음", "심층"] as const} onChange={setType} label="초안 종류" />
        <span className="muted">네이버 블로그용</span>
      </div>
      <article className="paper">
        <h3>{b.title}</h3>
        <p>{b.intro}</p>
        {b.sections.map((s) => (
          <section key={s.heading}>
            <h4>{s.heading}</h4>
            {s.body.split(/\n\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        ))}
        <p>{b.outro}</p>
        <p className="tags">{b.tags.map((t) => `#${t}`).join(" ")}</p>
      </article>
      <footer className="pn__foot">
        <span className="muted">네이버 글쓰기 화면에 제목과 본문을 각각 붙여 넣으세요.</span>
        <div className="row">
          <button className="btn btn--light" onClick={() => copyText(b.title, "제목을 복사했어요")}>
            제목 복사
          </button>
          <button className="btn btn--light" onClick={() => copyText(b.tags.join(", "), "태그를 복사했어요")}>
            태그 복사
          </button>
          <button className="btn btn--primary" onClick={() => copyText(body, "본문을 복사했어요")}>
            본문 복사
          </button>
        </div>
      </footer>
    </div>
  );
}

// ---------- 우편선 (게시) ----------
export function MailboatPanel() {
  const decks = useLab((s) => s.decks);
  const brand = useLab((s) => s.brand);
  const say = useLab((s) => s.say);
  const [deckId, setDeckId] = useState(decks[0].id);
  const [ok, setOk] = useState(false);
  const d = decks.find((x) => x.id === deckId)!;
  return (
    <div className="pn">
      <div className="pn__bar">
        <Seg
          value={d.type}
          options={["묶음", "심층"] as const}
          onChange={(t) => {
            setDeckId(decks.find((x) => x.type === t)!.id);
            setOk(false);
          }}
          label="게시할 초안"
        />
        <span className="muted">{brand.handle}에 게시</span>
      </div>
      <div className="strip strip--small">
        {d.cards.map((c, i) => (
          <div key={i} className="strip__item">
            <CardPreview card={c} page={i + 1} total={d.cards.length} handle={brand.handle} series={brand.series} deep={d.type === "심층"} />
          </div>
        ))}
      </div>
      <pre className="caption">{`${d.caption}\n\n${d.hashtags.join(" ")}`}</pre>
      <label className="check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>
          카드 {d.cards.length}장과 캡션을 확인했고, {brand.handle}에 올릴게요.
        </span>
      </label>
      <footer className="pn__foot">
        <span className="muted">게시는 언제나 소장님이 직접 눌러야 출발해요.</span>
        <button className="btn btn--primary" disabled={!ok} onClick={() => say("1단계에서는 실제로 게시되지 않아요. 인스타그램 연결은 5단계에서 해요.")}>
          우편선 띄우기
        </button>
      </footer>
    </div>
  );
}

// ---------- 자료 도서관 ----------
export function LibraryPanel() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("전체");
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return NEWS.filter((x) => (cat === "전체" || x.category === cat) && (!n || `${x.title} ${x.excerpt} ${x.source}`.toLowerCase().includes(n)));
  }, [q, cat]);
  return (
    <div className="pn">
      <div className="pn__bar">
        <label className="search">
          <span className="sr-only">지난 소식 찾기</span>
          <input id="lib-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 에이전트, 반도체, 구글" />
        </label>
        <Seg value={cat} options={CATS} onChange={setCat} label="분야" />
      </div>
      <p className="muted">
        {list.length}건을 찾았어요. 2단계부터는 매일 모은 소식이 계속 쌓여서, 주제별 특집을 만들 때 꺼내 쓸 수 있어요.
      </p>
      <ul className="news news--compact">
        {list.map((n) => (
          <li key={n.link}>
            <div className="news__main">
              <p className="news__meta">
                <span className={`cat cat--${n.category}`}>{n.category}</span>
                {n.source}
                <span className="muted">{fmtTime(n.publishedAt)}</span>
              </p>
              <a href={n.link} target="_blank" rel="noreferrer" className="news__title">
                {n.title}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- 성과 게시판 ----------
export function StatsPanel() {
  const max = Math.max(...STATS.map((s) => s.saves));
  const avg = (t: string, k: "saves" | "likes" | "reach") => {
    const xs = STATS.filter((s) => s.type === t);
    return Math.round(xs.reduce((a, s) => a + s[k], 0) / xs.length);
  };
  return (
    <div className="pn">
      <p className="sample">예시 수치예요. 5단계에서 인스타그램 실제 수치로 바뀌어요.</p>
      <div className="kpis">
        {(["묶음", "심층"] as const).map((t) => (
          <div key={t} className={`kpi kpi--${t === "묶음" ? "a" : "b"}`}>
            <span>{t} 카드 평균</span>
            <strong>저장 {avg(t, "saves")}</strong>
            <em>
              좋아요 {avg(t, "likes")}, 도달 {avg(t, "reach").toLocaleString()}
            </em>
          </div>
        ))}
      </div>
      <h3 className="pn__h">게시물별 저장 수</h3>
      <div className="bars" role="img" aria-label="최근 게시물 6개의 저장 수 막대그래프">
        {STATS.map((s) => (
          <div key={s.date + s.title} className="bars__col">
            <span className="bars__v">{s.saves}</span>
            <div className={`bars__bar bars__bar--${s.type === "묶음" ? "a" : "b"}`} style={{ height: `${(s.saves / max) * 100}%` }} />
            <span className="bars__x">{s.date}</span>
          </div>
        ))}
      </div>
      <div className="legend">
        <span className="legend__a">묶음</span>
        <span className="legend__b">심층</span>
      </div>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>게시물</th>
              <th>좋아요</th>
              <th>저장</th>
              <th>도달</th>
            </tr>
          </thead>
          <tbody>
            {STATS.map((s) => (
              <tr key={s.date + s.title}>
                <td>{s.date}</td>
                <td>
                  {s.title} <span className="muted">{s.type}</span>
                </td>
                <td>{s.likes}</td>
                <td>{s.saves}</td>
                <td>{s.reach.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- 연구원 명부 ----------
const ROLE: Record<string, string> = {
  receiver: "매일 국내외 매체에서 AI·IT 소식을 모아요",
  cards: "묶음·심층 카드뉴스 문구를 써요",
  blog: "네이버 블로그 글을 써요",
  dock: "검토가 끝난 카드를 인스타그램에 게시해요",
  library: "지난 소식을 정리하고 찾아줘요",
  stats: "게시물 반응을 모아 알려줘요",
  dorm: "연구원 정보를 관리해요",
};

export function RosterPanel() {
  const staff = useLab((s) => s.staff);
  const edit = useLab((s) => s.editStaff);
  return (
    <div className="pn">
      <p className="muted">직함과 이름을 바꾸면 간판과 말풍선에 바로 반영돼요. 역할 지시문 편집은 3단계에서 열려요.</p>
      <ul className="roster">
        {BUILDINGS.filter((b) => b.staff).map((b) => (
          <li key={b.id}>
            <span className="roster__swatch" style={{ background: b.roof }} />
            <div className="roster__who">
              <input id={`st-title-${b.id}`} aria-label={`${b.name} 직원 직함`} value={staff[b.id].title} onChange={(e) => edit(b.id, { ...staff[b.id], title: e.target.value })} />
              <input id={`st-name-${b.id}`} aria-label={`${b.name} 직원 이름`} value={staff[b.id].name} onChange={(e) => edit(b.id, { ...staff[b.id], name: e.target.value })} />
            </div>
            <div className="roster__role">
              <strong>{b.name}</strong>
              <span>{ROLE[b.id]}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- 소장 책상 (브랜드 설정) ----------
export function BrandPanel() {
  const brand = useLab((s) => s.brand);
  const setBrand = useLab((s) => s.setBrand);
  const set = (k: keyof typeof brand, v: string) => setBrand({ ...brand, [k]: v });
  return (
    <div className="pn">
      <div className="form2">
        <label className="field">
          <span>인스타그램 계정</span>
          <input id="b-handle" value={brand.handle} onChange={(e) => set("handle", e.target.value)} />
        </label>
        <label className="field">
          <span>묶음 카드 시리즈 이름</span>
          <input id="b-series" value={brand.series} onChange={(e) => set("series", e.target.value)} />
        </label>
        <label className="field">
          <span>묶음 말투</span>
          <input id="b-tone" value={brand.tone} onChange={(e) => set("tone", e.target.value)} />
        </label>
        <label className="field">
          <span>심층 말투</span>
          <input id="b-deep" value={brand.deepTone} onChange={(e) => set("deepTone", e.target.value)} />
        </label>
      </div>
      <h3 className="pn__h">운영 설정</h3>
      <dl className="ops">
        <div>
          <dt>자동 초안</dt>
          <dd>매일 오전 10시, 묶음 1개와 심층 1개</dd>
          <dd className="muted">4단계에서 연결</dd>
        </div>
        <div>
          <dt>알림</dt>
          <dd>텔레그램</dd>
          <dd className="muted">4단계에서 연결</dd>
        </div>
        <div>
          <dt>글 쓰는 AI</dt>
          <dd>Groq 무료 등급</dd>
          <dd className="muted">3단계에서 연결</dd>
        </div>
        <div>
          <dt>로그인</dt>
          <dd>내 구글 계정만</dd>
          <dd className="muted">2단계에서 연결</dd>
        </div>
      </dl>
      <h3 className="pn__h">브랜드 색</h3>
      <div className="swatches">
        {[
          ["하늘", "#8CCBFF"],
          ["민트", "#7FE3C6"],
          ["코랄", "#FF9A8A"],
          ["남색", "#2A2E5E"],
          ["수달", "#A8754F"],
          ["크림", "#FCEBD5"],
        ].map(([n, c]) => (
          <div key={n} className="swatch">
            <span style={{ background: c }} />
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 보관함 서랍장 ----------
export function DraftsPanel() {
  const travel = useLab((s) => s.travel);
  return (
    <div className="pn">
      <ul className="drafts">
        {DRAFTS.map((d) => (
          <li key={d.id}>
            <div>
              <time>{d.date}</time>
              <strong>{d.label}</strong>
              <span className="muted">{d.kinds.join(", ")}</span>
            </div>
            <span className={`status ${d.status === "게시함" ? "status--done" : "status--wait"}`}>{d.status}</span>
          </li>
        ))}
      </ul>
      <footer className="pn__foot">
        <span className="muted">검토 대기 중인 초안은 카드뉴스 공방에서 고칠 수 있어요.</span>
        <button className="btn btn--primary" onClick={() => travel("cards")}>
          카드뉴스 공방으로 가기
        </button>
      </footer>
    </div>
  );
}
