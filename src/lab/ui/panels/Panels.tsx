"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BUILDINGS } from "../../data/buildings";
import type { Draft, DraftType, NewsItem } from "../../data/demo";
import { writeJob } from "../../company";
import { fetchNews, fetchStatus } from "../../gen/client";
import { DEFAULT_PROMPTS } from "../../gen/prompt";
import { draftImages, saveFiles } from "../../render/cardImage";
import { draftLabel, pickCurrent, useLab, type SavedData } from "../../store";
import CardPreview from "../CardPreview";

const CATS = ["전체", "AI", "개발", "업계"] as const;
const fmtTime = (t: number) =>
  new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(t);
const fmtDay = (t: number) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(t);
const fmtShort = (t: number) => new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" }).format(t).replace(/\.\s?/g, "/").replace(/\/$/, "");

const ENGINE: Record<Draft["engine"], string> = { groq: "Groq", template: "뼈대", sample: "예시" };
const BUNDLE_MAX = 6;

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

/** 띄어쓰기·쉼표로 나눈 목록. 다 쓰고 나서(포커스가 빠질 때) 저장해요 */
function ListField({ id, label, value, sep, onCommit }: { id: string; label: string; value: string[]; sep: " " | ", "; onCommit: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(sep));
  useEffect(() => setText(value.join(sep)), [value, sep]);
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        id={id}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(text.split(sep === " " ? /\s+/ : /\s*,\s*/).map((t) => t.trim()).filter(Boolean))}
      />
    </label>
  );
}

/** 한 번 누르면 묻고, 한 번 더 누르면 실행해요 (브라우저 확인 창 대신) */
function ConfirmButton({ label, ask, onConfirm }: { label: string; ask: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className={`btn ${armed ? "btn--danger" : "btn--light"}`} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? ask : label}
    </button>
  );
}

// ---------- 초안 고르기 (공방·서재·선착장이 같은 초안을 봐요) ----------
function useDraft(onlyWaiting = false) {
  const drafts = useLab((s) => s.drafts);
  const current = useLab((s) => s.current);
  const pool = onlyWaiting ? drafts.filter((d) => d.status === "검토 대기") : drafts;
  return { draft: pickCurrent(pool, current), pool };
}

function DraftPicker({ pool, draft }: { pool: Draft[]; draft?: Draft }) {
  const setCurrent = useLab((s) => s.setCurrent);
  if (!draft) return null;
  return (
    <label className="draft-pick">
      <span className="sr-only">초안 고르기</span>
      <select id="draft-pick" value={draft.id} onChange={(e) => setCurrent(e.target.value)}>
        {pool.map((d) => (
          <option key={d.id} value={d.id}>
            {fmtShort(d.createdAt)} {d.type} · {draftLabel(d)}
            {d.status === "게시함" ? " (게시함)" : ""}
          </option>
        ))}
      </select>
      <span className={`engine engine--${draft.engine}`}>{ENGINE[draft.engine]}</span>
    </label>
  );
}

function NoDraft({ text = "아직 초안이 없어요. 수신소에서 소식을 담아 초안을 만들어 보세요." }: { text?: string }) {
  const travel = useLab((s) => s.travel);
  return (
    <div className="pn">
      <p className="empty">{text}</p>
      <footer className="pn__foot">
        <span />
        <button className="btn btn--primary" onClick={() => travel("receiver")}>
          수신소로 가기
        </button>
      </footer>
    </div>
  );
}

// ---------- 담은 소식으로 초안 만들기 ----------
async function makeDraft(type: DraftType) {
  const st = useLab.getState();
  if (st.busy) return;
  const byLink = new Map(st.library.map((n) => [n.link, n]));
  const items = st.basket.map((l) => byLink.get(l)).filter((n): n is NewsItem => Boolean(n));
  if (!items.length) return;
  st.clearBasket();
  await writeJob(type, type === "심층" ? items.slice(0, 1) : items.slice(0, BUNDLE_MAX));
}

function BasketFoot() {
  const basket = useLab((s) => s.basket);
  const busy = useLab((s) => s.busy);
  const clear = useLab((s) => s.clearBasket);
  const n = basket.length;
  const writing = busy === "draft";
  return (
    <footer className="pn__foot">
      <span className="muted">
        {writing ? "초안을 쓰는 중이에요…" : n ? `${n}개 담았어요` : "소식 하나는 심층, 여러 개(2~6개)는 묶음 카드뉴스가 돼요"}
        {n > 0 && !writing && (
          <button className="link-btn" onClick={clear}>
            비우기
          </button>
        )}
      </span>
      <div className="row">
        <button className="btn btn--light" disabled={n !== 1 || !!busy} onClick={() => makeDraft("심층")}>
          심층 초안
        </button>
        <button className="btn btn--primary" disabled={n < 2 || n > BUNDLE_MAX || !!busy} onClick={() => makeDraft("묶음")}>
          {n > BUNDLE_MAX ? `묶음은 ${BUNDLE_MAX}개까지` : "묶음 초안"}
        </button>
      </div>
    </footer>
  );
}

function NewsRow({ n, compact }: { n: NewsItem; compact?: boolean }) {
  const on = useLab((s) => s.basket.includes(n.link));
  const toggle = useLab((s) => s.toggleBasket);
  return (
    <li className={on ? "news--on" : ""}>
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
        {!compact && n.excerpt && <p className="news__ex">{n.excerpt}</p>}
      </div>
    </li>
  );
}

// ---------- 수신 모니터 ----------
export function InboxPanel() {
  const [cat, setCat] = useState<(typeof CATS)[number]>("전체");
  const library = useLab((s) => s.library);
  const inbox = useLab((s) => s.inbox);
  const lastFetch = useLab((s) => s.lastFetch);
  const busy = useLab((s) => s.busy);
  const items = useMemo(() => {
    const byLink = new Map(library.map((n) => [n.link, n]));
    return inbox.map((l) => byLink.get(l)).filter((n): n is NewsItem => Boolean(n));
  }, [library, inbox]);
  const list = items.filter((n) => cat === "전체" || n.category === cat);

  const refresh = async () => {
    const st = useLab.getState();
    if (st.busy) return;
    st.setBusy("news");
    const res = await fetchNews();
    useLab.getState().setBusy(null);
    if (!res) return st.say("소식 서버에 연결하지 못했어요. Next.js 앱(npm run dev)에서 열면 새 소식을 받을 수 있어요.");
    if (!res.items.length) return st.say(`새 소식을 받지 못했어요. 피드 ${res.failed.length}곳에 연결하지 못했어요. 잠시 뒤 다시 해 보세요.`);
    const fresh = res.items.filter((n) => !st.library.some((x) => x.link === n.link)).length;
    st.receiveNews(res.items, res.fetchedAt);
    st.say(
      `소식 ${res.items.length}개를 받았어요${fresh ? ` (새 소식 ${fresh}개)` : ""}.` + (res.failed.length ? ` ${res.failed.join(", ")}은(는) 이번에 받지 못했어요.` : ""),
    );
  };

  return (
    <div className="pn">
      <div className="pn__bar">
        <Seg value={cat} options={CATS} onChange={setCat} label="분야" />
        <span className="muted">{lastFetch ? `${fmtTime(lastFetch)}에 받음` : "10월 5일 예시 소식"}</span>
        <button className="btn btn--light" disabled={!!busy} onClick={refresh}>
          {busy === "news" ? "받는 중…" : "새 소식 받기"}
        </button>
      </div>
      <ul className="news">
        {list.map((n) => (
          <NewsRow key={n.link} n={n} />
        ))}
        {!list.length && <li className="empty">이 분야 소식은 아직 없어요.</li>}
      </ul>
      <BasketFoot />
    </div>
  );
}

// ---------- 카드 편집 ----------
export function CardEditorPanel() {
  const { draft, pool } = useDraft();
  const brand = useLab((s) => s.brand);
  const editCard = useLab((s) => s.editCard);
  const editDeck = useLab((s) => s.editDeck);
  const addCard = useLab((s) => s.addCard);
  const removeCard = useLab((s) => s.removeCard);
  const moveCard = useLab((s) => s.moveCard);
  const [sel, setSel] = useState(0);
  useEffect(() => setSel(0), [draft?.id]);
  if (!draft) return <NoDraft />;
  const { cards } = draft.deck;
  const i = Math.min(sel, cards.length - 1);
  const card = cards[i];
  const deep = draft.type === "심층";
  const id = draft.id;
  const look = { total: cards.length, handle: brand.handle, series: brand.series, deep };
  return (
    <div className="pn">
      <div className="pn__bar">
        <DraftPicker pool={pool} draft={draft} />
        <span className="muted">카드 {cards.length}장</span>
      </div>
      <div className="strip" role="list">
        {cards.map((c, k) => (
          <button key={k} role="listitem" className={`strip__item ${k === i ? "strip__item--on" : ""}`} onClick={() => setSel(k)} aria-label={`${k + 1}번째 카드`}>
            <CardPreview card={c} page={k + 1} {...look} />
            <span>{k + 1}</span>
          </button>
        ))}
      </div>
      <div className="edit">
        <div className="edit__big">
          <CardPreview card={card} page={i + 1} {...look} />
          <div className="row card-ops">
            <button className="btn btn--light" disabled={i === 0} onClick={() => (moveCard(id, i, -1), setSel(i - 1))} aria-label="앞으로 옮기기">
              ←
            </button>
            <button className="btn btn--light" disabled={i === cards.length - 1} onClick={() => (moveCard(id, i, 1), setSel(i + 1))} aria-label="뒤로 옮기기">
              →
            </button>
            <button className="btn btn--light" onClick={() => (addCard(id, i), setSel(i + 1))}>
              뒤에 카드 추가
            </button>
            <button className="btn btn--light" disabled={cards.length <= 2} onClick={() => removeCard(id, i)}>
              이 카드 빼기
            </button>
          </div>
        </div>
        <div className="edit__fields">
          {card.kind === "body" && (
            <label className="field">
              <span>꼬리표</span>
              <input id={`tag-${id}-${i}`} value={card.tag ?? ""} onChange={(e) => editCard(id, i, { tag: e.target.value })} />
            </label>
          )}
          <label className="field">
            <span>제목</span>
            <input id={`title-${id}-${i}`} value={card.title} onChange={(e) => editCard(id, i, { title: e.target.value })} />
          </label>
          <label className="field">
            <span>{card.kind === "outro" ? "정리 (줄마다 하나)" : "내용"}</span>
            <textarea id={`body-${id}-${i}`} rows={4} value={card.body} onChange={(e) => editCard(id, i, { body: e.target.value })} />
          </label>
          <label className="field">
            <span>캡션</span>
            <textarea id={`cap-${id}`} rows={5} value={draft.deck.caption} onChange={(e) => editDeck(id, { caption: e.target.value })} />
          </label>
          <ListField id={`hash-${id}`} label="해시태그 (띄어쓰기로 구분)" value={draft.deck.hashtags} sep=" " onCommit={(v) => editDeck(id, { hashtags: v.map((t) => t.replace(/^#*/, "#")) })} />
        </div>
      </div>
    </div>
  );
}

// ---------- 인쇄기 ----------
async function printDraft(d: Draft, only?: number): Promise<File[]> {
  const st = useLab.getState();
  if (st.busy) return [];
  st.setBusy("print");
  try {
    const files = await draftImages(d, { handle: st.brand.handle, series: st.brand.series }, only);
    const how = await saveFiles(files);
    if (how !== "cancelled") st.say(how === "shared" ? `카드 ${files.length}장을 보냈어요.` : `카드 ${files.length}장을 1080×1350 이미지로 뽑았어요.`);
    return files;
  } catch {
    st.say("이미지를 만들지 못했어요. 다시 한번 눌러 주세요.");
    return [];
  } finally {
    useLab.getState().setBusy(null);
  }
}

/** 방금 뽑은 카드 이미지. 내려받기가 막힌 곳에서도 길게 누르거나 오른쪽 클릭으로 저장할 수 있어요 */
function usePrints() {
  const [prints, setPrints] = useState<{ name: string; url: string }[]>([]);
  useEffect(() => () => prints.forEach((p) => URL.revokeObjectURL(p.url)), [prints]);
  return [prints, (files: File[]) => files.length && setPrints(files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })))] as const;
}

export function PrinterPanel() {
  const { draft, pool } = useDraft();
  const brand = useLab((s) => s.brand);
  const busy = useLab((s) => s.busy);
  const [prints, showPrints] = usePrints();
  if (!draft) return <NoDraft />;
  const look = { total: draft.deck.cards.length, handle: brand.handle, series: brand.series, deep: draft.type === "심층" };
  return (
    <div className="pn">
      <div className="pn__bar">
        <DraftPicker pool={pool} draft={draft} />
        <span className="muted">카드를 누르면 그 한 장만 저장해요</span>
      </div>
      <div className="print__grid">
        {draft.deck.cards.map((c, i) => (
          <button key={i} className="print__item" disabled={!!busy} onClick={() => printDraft(draft, i).then(showPrints)} aria-label={`${i + 1}번째 카드 이미지로 저장`}>
            <CardPreview card={c} page={i + 1} {...look} />
          </button>
        ))}
      </div>
      {prints.length > 0 && (
        <section className="prints" aria-label="방금 뽑은 카드">
          <h3 className="pn__h">방금 뽑은 카드 {prints.length}장</h3>
          <p className="muted">파일이 저장되지 않았다면 이미지를 길게 누르거나 오른쪽 클릭해서 저장하세요.</p>
          <div className="print__grid">
            {prints.map((p) => (
              <img key={p.url} src={p.url} alt={p.name} width={1080} height={1350} />
            ))}
          </div>
        </section>
      )}
      <footer className="pn__foot">
        <span className="muted">1080×1350 PNG로 뽑아요. 휴대폰에서는 공유 창이 열려 사진에 저장할 수 있어요.</span>
        <button className="btn btn--primary" disabled={!!busy} onClick={() => printDraft(draft).then(showPrints)}>
          {busy === "print" ? "인쇄하는 중…" : `${draft.deck.cards.length}장 모두 인쇄하기`}
        </button>
      </footer>
    </div>
  );
}

// ---------- 블로그 원고 ----------
const blogText = (b: Draft["blog"]) => [b.intro, ...b.sections.map((s) => `■ ${s.heading}\n\n${s.body}`), b.outro].join("\n\n");

export function BlogPanel() {
  const { draft, pool } = useDraft();
  const editBlog = useLab((s) => s.editBlog);
  const [mode, setMode] = useState<"보기" | "고치기">("보기");
  if (!draft) return <NoDraft />;
  const b = draft.blog;
  const id = draft.id;
  const setSection = (k: number, patch: Partial<{ heading: string; body: string }>) =>
    editBlog(id, { sections: b.sections.map((s, j) => (j === k ? { ...s, ...patch } : s)) });
  return (
    <div className="pn">
      <div className="pn__bar">
        <DraftPicker pool={pool} draft={draft} />
        <Seg value={mode} options={["보기", "고치기"] as const} onChange={setMode} label="보기 방식" />
      </div>
      {mode === "보기" ? (
        <article className="paper">
          <h3>{b.title}</h3>
          <p>{b.intro}</p>
          {b.sections.map((s, k) => (
            <section key={k}>
              <h4>{s.heading}</h4>
              {s.body.split(/\n\n/).map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </section>
          ))}
          <p>{b.outro}</p>
          <p className="tags">{b.tags.map((t) => `#${t}`).join(" ")}</p>
        </article>
      ) : (
        <div className="blog-edit">
          <label className="field">
            <span>제목</span>
            <input id={`bt-${id}`} value={b.title} onChange={(e) => editBlog(id, { title: e.target.value })} />
          </label>
          <label className="field">
            <span>들어가는 말</span>
            <textarea id={`bi-${id}`} rows={3} value={b.intro} onChange={(e) => editBlog(id, { intro: e.target.value })} />
          </label>
          {b.sections.map((s, k) => (
            <fieldset key={k} className="blog-edit__sec">
              <legend>소제목 {k + 1}</legend>
              <input id={`bh-${id}-${k}`} aria-label={`소제목 ${k + 1}`} value={s.heading} onChange={(e) => setSection(k, { heading: e.target.value })} />
              <textarea id={`bb-${id}-${k}`} aria-label={`소제목 ${k + 1} 본문`} rows={6} value={s.body} onChange={(e) => setSection(k, { body: e.target.value })} />
              <button className="link-btn" disabled={b.sections.length <= 1} onClick={() => editBlog(id, { sections: b.sections.filter((_, j) => j !== k) })}>
                이 소제목 빼기
              </button>
            </fieldset>
          ))}
          <button className="btn btn--light" onClick={() => editBlog(id, { sections: [...b.sections, { heading: "새 소제목", body: "" }] })}>
            소제목 추가
          </button>
          <label className="field">
            <span>맺는 말</span>
            <textarea id={`bo-${id}`} rows={3} value={b.outro} onChange={(e) => editBlog(id, { outro: e.target.value })} />
          </label>
          <ListField id={`btag-${id}`} label="태그 (쉼표로 구분)" value={b.tags} sep=", " onCommit={(v) => editBlog(id, { tags: v.map((t) => t.replace(/^#+/, "")) })} />
        </div>
      )}
      <footer className="pn__foot">
        <span className="muted">네이버 글쓰기 화면에 제목과 본문을 각각 붙여 넣으세요.</span>
        <div className="row">
          <button className="btn btn--light" onClick={() => copyText(b.title, "제목을 복사했어요")}>
            제목 복사
          </button>
          <button className="btn btn--light" onClick={() => copyText(b.tags.join(", "), "태그를 복사했어요")}>
            태그 복사
          </button>
          <button className="btn btn--primary" onClick={() => copyText(blogText(b), "본문을 복사했어요")}>
            본문 복사
          </button>
        </div>
      </footer>
    </div>
  );
}

// ---------- 우편선 (게시) ----------
export function MailboatPanel() {
  const { draft, pool } = useDraft(true);
  const brand = useLab((s) => s.brand);
  const busy = useLab((s) => s.busy);
  const publish = useLab((s) => s.publish);
  const say = useLab((s) => s.say);
  const [ok, setOk] = useState(false);
  const [packed, setPacked] = useState(false);
  useEffect(() => {
    setOk(false);
    setPacked(false);
  }, [draft?.id]);
  if (!draft) return <NoDraft text="게시를 기다리는 초안이 없어요. 수신소에서 새 초안을 만들어 보세요." />;
  const d = draft;
  const caption = `${d.deck.caption}\n\n${d.deck.hashtags.join(" ")}`;
  const look = { total: d.deck.cards.length, handle: brand.handle, series: brand.series, deep: d.type === "심층" };

  // 인스타그램 앱으로 넘길 짐: 카드 이미지 + 캡션
  const pack = async () => {
    const st = useLab.getState();
    st.setBusy("print");
    try {
      await navigator.clipboard?.writeText(caption).catch(() => undefined);
      const files = await draftImages(d, { handle: brand.handle, series: brand.series });
      const how = await saveFiles(files, caption);
      if (how === "cancelled") return;
      setPacked(true);
      say(how === "shared" ? "인스타그램에서 올리고 나면 '게시 완료'를 눌러 주세요." : "카드를 저장하고 캡션을 복사했어요. 인스타그램에 올리고 나면 '게시 완료'를 눌러 주세요.");
    } catch {
      say("짐을 꾸리지 못했어요. 다시 한번 눌러 주세요.");
    } finally {
      useLab.getState().setBusy(null);
    }
  };

  return (
    <div className="pn">
      <div className="pn__bar">
        <DraftPicker pool={pool} draft={d} />
        <span className="muted">{brand.handle}에 게시</span>
      </div>
      <div className="strip strip--small">
        {d.deck.cards.map((c, i) => (
          <div key={i} className="strip__item">
            <CardPreview card={c} page={i + 1} {...look} />
          </div>
        ))}
      </div>
      <pre className="caption">{caption}</pre>
      <label className="check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>
          카드 {d.deck.cards.length}장과 캡션을 확인했고, {brand.handle}에 올릴게요.
        </span>
      </label>
      <footer className="pn__foot">
        <span className="muted">게시는 언제나 소장님이 직접 해요. 인스타그램 자동 게시는 5단계에서 연결돼요.</span>
        <div className="row">
          <button className="btn btn--light" disabled={!ok || !!busy} onClick={pack}>
            {busy === "print" ? "꾸리는 중…" : "우편선 띄우기"}
          </button>
          <button
            className="btn btn--primary"
            disabled={!ok || !packed}
            onClick={() => {
              publish(d.id);
              say("게시 완료! 성과 게시판에 올려 뒀어요. 반응 수치는 게시판에서 적을 수 있어요.");
            }}
          >
            게시 완료
          </button>
        </div>
      </footer>
    </div>
  );
}

// ---------- 자료 도서관 ----------
const PAGE = 120;

export function LibraryPanel() {
  const library = useLab((s) => s.library);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("전체");
  const [limit, setLimit] = useState(PAGE);
  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return library.filter((x) => {
      if (cat !== "전체" && x.category !== cat) return false;
      const hay = `${x.title} ${x.excerpt} ${x.source}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [library, q, cat]);
  useEffect(() => setLimit(PAGE), [q, cat]);
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
        모아 둔 소식 {library.length.toLocaleString()}건 중 {list.length.toLocaleString()}건이에요. 담아서 주제별 특집 초안을 만들 수 있어요.
      </p>
      <ul className="news news--compact">
        {list.slice(0, limit).map((n) => (
          <NewsRow key={n.link} n={n} compact />
        ))}
      </ul>
      {list.length > limit && (
        <button className="btn btn--light more" onClick={() => setLimit(limit + PAGE)}>
          더 보기 ({(list.length - limit).toLocaleString()}건 남음)
        </button>
      )}
      <BasketFoot />
    </div>
  );
}

// ---------- 성과 게시판 ----------
export function StatsPanel() {
  const posts = useLab((s) => s.posts);
  const editPost = useLab((s) => s.editPost);
  const sorted = useMemo(() => [...posts].sort((a, b) => a.postedAt - b.postedAt), [posts]);
  const recent = sorted.slice(-8);
  const max = Math.max(1, ...recent.map((s) => s.saves));
  const avg = (t: DraftType, k: "saves" | "likes" | "reach") => {
    const xs = posts.filter((s) => s.type === t);
    return xs.length ? Math.round(xs.reduce((a, s) => a + s[k], 0) / xs.length) : 0;
  };
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  return (
    <div className="pn">
      {posts.some((p) => p.sample) && <p className="sample">'예시' 표시가 붙은 줄은 예시 수치예요. 게시한 카드뉴스는 아래 표에 반응 수치를 적어 주세요.</p>}
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
      <h3 className="pn__h">최근 게시물 저장 수</h3>
      <div className="bars" role="img" aria-label={`최근 게시물 ${recent.length}개의 저장 수 막대그래프`}>
        {recent.map((s) => (
          <div key={s.id} className="bars__col">
            <span className="bars__v">{s.saves}</span>
            <div className={`bars__bar bars__bar--${s.type === "묶음" ? "a" : "b"}`} style={{ height: `${(s.saves / max) * 100}%` }} />
            <span className="bars__x">{fmtShort(s.postedAt)}</span>
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
            {[...sorted].reverse().map((s) => (
              <tr key={s.id}>
                <td>{fmtShort(s.postedAt)}</td>
                <td>
                  {s.title} <span className="muted">{s.type}{s.sample ? " · 예시" : ""}</span>
                </td>
                {(["likes", "saves", "reach"] as const).map((k) => (
                  <td key={k}>
                    {s.sample ? (
                      s[k].toLocaleString()
                    ) : (
                      <input className="num" id={`${k}-${s.id}`} type="number" min={0} inputMode="numeric" aria-label={`${s.title} ${k === "likes" ? "좋아요" : k === "saves" ? "저장" : "도달"}`} value={s[k]} onChange={(e) => editPost(s.id, { [k]: num(e.target.value) })} />
                    )}
                  </td>
                ))}
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
      <p className="muted">직함과 이름을 바꾸면 간판과 말풍선에 바로 반영돼요. 글 쓰는 연구원은 역할 지시문을 고치면 다음 초안부터 그대로 따라요.</p>
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
            {DEFAULT_PROMPTS[b.id] && (
              <label className="field roster__prompt">
                <span>
                  역할 지시문
                  {staff[b.id].prompt !== DEFAULT_PROMPTS[b.id] && (
                    <button className="link-btn" onClick={() => edit(b.id, { ...staff[b.id], prompt: DEFAULT_PROMPTS[b.id] })}>
                      처음대로
                    </button>
                  )}
                </span>
                <textarea id={`st-prompt-${b.id}`} rows={3} value={staff[b.id].prompt ?? ""} onChange={(e) => edit(b.id, { ...staff[b.id], prompt: e.target.value })} />
              </label>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- 소장 책상 (브랜드 설정) ----------
function useServerStatus() {
  const [st, setSt] = useState<Awaited<ReturnType<typeof fetchStatus>> | "loading">("loading");
  useEffect(() => {
    let alive = true;
    fetchStatus().then((s) => alive && setSt(s));
    return () => {
      alive = false;
    };
  }, []);
  return st;
}

function Backup() {
  const say = useLab((s) => s.say);
  const importData = useLab((s) => s.importData);
  const resetData = useLab((s) => s.resetData);
  const file = useRef<HTMLInputElement>(null);
  const exportData = () => {
    const raw = localStorage.getItem("otter-lab");
    const data = raw ? (JSON.parse(raw) as { state: SavedData }).state : null;
    if (!data) return say("아직 저장된 데이터가 없어요.");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `otterlab-backup-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as Partial<SavedData>;
      if (!Array.isArray(data.drafts) || !Array.isArray(data.library)) throw new Error();
      importData(data);
      say(`백업을 불러왔어요. 초안 ${data.drafts.length}개, 소식 ${data.library.length}건이에요.`);
    } catch {
      say("오터랩 백업 파일이 아니에요.");
    } finally {
      if (file.current) file.current.value = "";
    }
  };
  return (
    <div className="row backup">
      <button className="btn btn--light" onClick={exportData}>
        백업 내려받기
      </button>
      <button className="btn btn--light" onClick={() => file.current?.click()}>
        백업 불러오기
      </button>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <ConfirmButton
        label="처음 상태로"
        ask="모두 지울까요? 한 번 더 누르세요"
        onConfirm={() => {
          resetData();
          say("초안·소식·설정을 지우고 예시 데이터로 되돌렸어요.");
        }}
      />
    </div>
  );
}

export function BrandPanel() {
  const brand = useLab((s) => s.brand);
  const setBrand = useLab((s) => s.setBrand);
  const server = useServerStatus();
  const set = (k: keyof typeof brand, v: string) => setBrand({ ...brand, [k]: v });
  const ai = server === "loading" ? "확인하는 중…" : !server ? "서버 없이 열려 있어요 (뼈대 초안으로 대신 써요)" : server.groq ? `연결됨 (${server.model})` : "키가 없어요 (.env.local에 GROQ_API_KEY)";
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
          <dt>소식 받기</dt>
          <dd>수신 모니터에서 '새 소식 받기'</dd>
          <dd className="muted">{server && server !== "loading" ? "서버 연결됨" : "Next.js 앱에서만 돼요"}</dd>
        </div>
        <div>
          <dt>글 쓰는 AI</dt>
          <dd>Groq 무료 등급</dd>
          <dd className="muted">{ai}</dd>
        </div>
        <div>
          <dt>자동 초안</dt>
          <dd>매일 오전 10시, 묶음 1개와 심층 1개</dd>
          <dd className="muted">4단계에서 연결</dd>
        </div>
        <div>
          <dt>로그인·저장</dt>
          <dd>지금은 이 브라우저에 저장돼요</dd>
          <dd className="muted">2단계에서 구글 로그인·Supabase로</dd>
        </div>
      </dl>
      <h3 className="pn__h">데이터</h3>
      <p className="muted">초안·소식·설정은 이 브라우저에만 저장돼요. 다른 기기로 옮기거나 지키려면 백업을 내려받아 두세요.</p>
      <Backup />
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
  const drafts = useLab((s) => s.drafts);
  const setCurrent = useLab((s) => s.setCurrent);
  const removeDraft = useLab((s) => s.removeDraft);
  const travel = useLab((s) => s.travel);
  const say = useLab((s) => s.say);
  if (!drafts.length) return <NoDraft text="보관함이 비어 있어요." />;
  return (
    <div className="pn">
      <ul className="drafts">
        {drafts.map((d) => (
          <li key={d.id}>
            <div>
              <time>{fmtDay(d.createdAt)}</time>
              <strong>{draftLabel(d)}</strong>
              <span className="muted">
                {d.type} · 카드 {d.deck.cards.length}장, 블로그 · {ENGINE[d.engine]}
              </span>
            </div>
            <span className={`status ${d.status === "게시함" ? "status--done" : "status--wait"}`}>{d.status}</span>
            <div className="row">
              <button
                className="btn btn--light"
                onClick={() => {
                  setCurrent(d.id);
                  travel("cards");
                }}
              >
                열기
              </button>
              <ConfirmButton
                label="지우기"
                ask="정말 지울까요?"
                onConfirm={() => {
                  removeDraft(d.id);
                  say(`'${draftLabel(d)}' 초안을 지웠어요.`);
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <footer className="pn__foot">
        <span className="muted">검토 대기 {drafts.filter((d) => d.status === "검토 대기").length}개, 게시함 {drafts.filter((d) => d.status === "게시함").length}개</span>
        <button className="btn btn--primary" onClick={() => travel("receiver")}>
          새 초안 만들러 가기
        </button>
      </footer>
    </div>
  );
}
