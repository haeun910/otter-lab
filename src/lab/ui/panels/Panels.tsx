"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAIN_COVER_TEMPLATE, CARD_TEMPLATES, chooseCardTemplate, isCardTemplate } from "../../data/cardTemplates";
import { BUILDINGS } from "../../data/buildings";
import type { Draft, DraftType, NewsItem } from "../../data/demo";
import { quotas, writeJob, retryDraftPart } from "../../company";
import { CATEGORIES, CATEGORY_INFO } from "../../news/category";
import { aiFailText, fetchNews, fetchStatus, remoteLLM } from "../../gen/client";
import { blogLength, rewriteDeck, rewriteSection } from "../../gen/pipeline";
import { LENGTHS, blogTarget, designOf, writingOf, type CardDesign, type DraftRequest, type WritingPlan } from "../../gen/prompt";
import { captionWithSources, finalizeDeck, selectHashtags } from "../../gen/editorial";
import { DEFAULT_PROMPTS } from "../../gen/prompt";
import { ACCENTS, FONTS, THEMES, draftImages, saveFiles } from "../../render/cardImage";
import { draftLabel, pickCurrent, useLab, type SavedData } from "../../store";
import CardPreview from "../CardPreview";

const CATS = ["전체", ...CATEGORIES] as const;
const fmtTime = (t: number) =>
  new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(t);
const fmtDay = (t: number) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(t);
const fmtShort = (t: number) =>
  new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" }).format(t).replace(/\.\s?/g, "/").replace(/\/$/, "");

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
        onBlur={() =>
          onCommit(
            text
              .split(sep === " " ? /\s+/ : /\s*,\s*/)
              .map((t) => t.trim())
              .filter(Boolean),
          )
        }
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

function DraftPicker({ pool, draft, part = "cards" }: { pool: Draft[]; draft?: Draft; part?: "cards" | "blog" }) {
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
      <span className={`engine engine--${draft.engine}`}>{draft.generation ? draft.generation[part].status === "running" ? "작성 중" : draft.generation[part].status === "skipped" || draft.generation[part].status === "pending" ? "미생성" : draft.generation[part].status === "failed" ? "생성 실패" : draft.generation[part].status === "partial" ? "일부 실패" : draft.generation[part].engine === "groq" ? "Groq" : "뼈대" : ENGINE[draft.engine]}</span>
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
        <button className="btn btn--primary" onClick={() => { travel("receiver"); useLab.getState().openFocus(BUILDINGS.find((b) => b.id === "receiver")!.objects[0]); }}>
          수신소로 가기
        </button>
      </footer>
    </div>
  );
}

// ---------- 담은 소식으로 초안 만들기 ----------
function BasketFoot() {
  const st = useLab();
  const [review, setReview] = useState(false);
  const [target, setTarget] = useState<"cards" | "both">("cards");
  const [bodyCount, setBodyCount] = useState(writingOf(st.brand).deepCards);
  const [tone, setTone] = useState("");
  const [error, setError] = useState("");
  const items = st.basket.map((link) => st.library.find((n) => n.link === link)).filter((n): n is NewsItem => Boolean(n));
  const type: DraftType = items.length === 1 ? "심층" : "묶음";
  const total = (type === "심층" ? bodyCount : items.length) + 2;
  const valid = items.length > 0 && items.length <= BUNDLE_MAX && items.length === st.basket.length;
  const request: DraftRequest = { type, items, brand: { ...st.brand, ...(type === "심층" ? { deepTone: tone.trim() || st.brand.deepTone } : { tone: tone.trim() || st.brand.tone }), writing: { ...writingOf(st.brand), deepCards: bodyCount } }, prompts: { cards: st.staff.cards?.prompt, blog: st.staff.blog?.prompt } };
  return <section className="generation-form" aria-label="카드뉴스 생성 요청">
    <div className="pn__foot"><span className="muted">{items.length ? `${items.length}개 소식 선택 · ${type} 카드뉴스` : "소식 1개는 심층, 2~6개는 묶음 카드뉴스"}</span><div className="row"><button className="btn btn--light" disabled={!items.length || !!st.busy} onClick={() => { st.clearBasket(); setReview(false); }}>선택 비우기</button><button className="btn btn--primary" disabled={!valid || !!st.busy} onClick={() => { setReview(!review); setError(""); }}>{review ? "요청 접기" : "카드뉴스 만들기"}</button></div></div>
    {review && <div className="generation-form__review">
      <h3>모모에게 보낼 요청 확인</h3><p className="muted">기본 7장 · 표지 1장 + 설명 5장 + 정리 1장. 묶음은 선택한 소식 수에 맞춰 구성해요.</p><ul>{items.map((n) => <li key={n.link}>{n.title} <small>· {n.source}</small></li>)}</ul>
      <div className="form2"><label className="field"><span>만들 결과</span><select value={target} onChange={(e) => setTarget(e.target.value as "cards" | "both")}><option value="cards">카드뉴스만 만들기</option><option value="both">카드뉴스 + 블로그</option></select></label>
      {type === "심층" ? <label className="field"><span>카드 장수 (표지·정리 포함)</span><select value={bodyCount} onChange={(e) => setBodyCount(Number(e.target.value))}>{[3,4,5,6].map((n) => <option key={n} value={n}>{n + 2}장 · 본문 {n}장</option>)}</select></label> : <p className="muted">총 {total}장 · 표지 1 + 소식 {items.length} + 정리 1</p>}
      <label className="field"><span>말투</span><input value={tone} placeholder={type === "심층" ? st.brand.deepTone : st.brand.tone} onChange={(e) => setTone(e.target.value)} /></label></div>
      <p className="muted">주제는 위 소식을 바탕으로 작성합니다. 총 {total}장 · {tone.trim() || (type === "심층" ? st.brand.deepTone : st.brand.tone)}. 실패한 생성은 완료로 표시하지 않습니다.</p>
      {error && <p role="alert">{error}</p>}
      <button className="btn btn--primary" disabled={!valid || !!st.busy} onClick={async () => {
        setError("");
        try {
          const draft = await writeJob(type, items, undefined, { target, request });
          if (!draft) return;
          if (draft.generation?.cards.status === "complete") useLab.getState().clearBasket();
          const s = useLab.getState(); s.travel("cards"); s.openFocus(BUILDINGS.find((b) => b.id === "cards")!.objects[0]);
        } catch (e) { setError(e instanceof Error ? e.message : "생성 실패"); }
      }}>{st.busy === "draft" ? "작성 중…" : target === "cards" ? `확인 · 카드 ${total}장 생성` : `확인 · 카드 ${total}장과 블로그 생성`}</button>
    </div>}
  </section>;
}

function GenerationStatus({ draft, part }: { draft: Draft; part: "cards" | "blog" }) {
  const busy = useLab((s) => s.busy);
  const [error, setError] = useState("");
  const g = draft.generation;
  if (!g) return null;
  const state = g[part];
  const labels = { pending: "대기", running: "작성 중", complete: "AI 생성 완료", partial: "일부 작성 실패", failed: "생성 실패", skipped: "생성하지 않음" };
  const expected = g.request.type === "심층" ? writingOf(g.request.brand).deepCards + 2 : g.request.items.length + 2;
  return <section className={`generation-status generation-status--${state.status}`} aria-label={`${part === "cards" ? "카드" : "블로그"} 생성 상태`}>
    <strong>{part === "cards" ? "모모 · 카드뉴스" : "테오 · 블로그"} — {state.status === "running" && !busy ? "작업 중단 · 재시도 필요" : labels[state.status]}</strong>
    <p>요청: {g.request.items.map((n) => n.title).join(" / ")} · 카드 {expected}장 · {g.request.type === "심층" ? g.request.brand.deepTone : g.request.brand.tone}</p>
    {state.error && <p role="alert">{state.error}</p>}
    {state.status === "failed" && <p>{state.engine === "groq" ? "이전 AI 결과를 보존했습니다." : part === "cards" ? "아래는 AI 결과가 아닌 편집용 뼈대입니다." : "다른 작업에서 완성한 카드는 그대로 보존했습니다."}</p>}
    {state.status === "partial" && <p>작성된 부분은 보존되어 있어요. 전체 블로그 재시도는 현재 원고를 교체합니다.</p>}
    {(state.status === "failed" || state.status === "skipped" || state.status === "partial" || state.status === "running" && !busy) && draft.status !== "게시함" && <button className="btn btn--light" disabled={!!busy} onClick={async () => { setError(""); try { await retryDraftPart(draft, part); } catch (e) { setError(e instanceof Error ? e.message : "재시도 실패"); } }}>{part === "cards" ? "카드만 다시 생성" : state.status === "skipped" ? "블로그 추가 생성" : "블로그만 다시 생성"}</button>}
    {error && <p role="alert">{error}</p>}
  </section>;
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
      `소식 ${res.items.length}개를 받았어요${fresh ? ` (새 소식 ${fresh}개)` : ""}.` +
        (res.failed.length ? ` ${res.failed.join(", ")}은(는) 이번에 받지 못했어요.` : ""),
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
/** 초안을 다시 쓸 때 AI에게 줄 재료 (바탕 소식·브랜드·지시문) */
function requestFor(d: Draft): DraftRequest {
  if (d.generation?.request) return d.generation.request;
  const st = useLab.getState();
  const byLink = new Map(st.library.map((n) => [n.link, n]));
  return {
    type: d.type,
    items: d.sources.map((l) => byLink.get(l)).filter((n): n is NewsItem => Boolean(n)),
    brand: st.brand,
    prompts: { cards: st.staff.cards?.prompt, blog: st.staff.blog?.prompt },
  };
}

/** AI에게 다시 쓰게 하기: 자주 쓰는 요청은 버튼으로, 나머지는 직접 */
function RewriteBox({ id, chips, label, onRun }: { id: string; chips: string[]; label: string; onRun: (instruction: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (instruction: string) => {
    if (!instruction.trim() || busy) return;
    setBusy(true);
    try {
      await onRun(instruction.trim());
      setText("");
    } catch (e) {
      useLab.getState().say(aiFailText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rewrite">
      <span className="rewrite__label">{busy ? "다시 쓰는 중…" : label}</span>
      <div className="rewrite__chips">
        {chips.map((c) => (
          <button key={c} className="chip-btn" disabled={busy} onClick={() => run(c)}>
            {c}
          </button>
        ))}
      </div>
      <form
        className="rewrite__own"
        onSubmit={(e) => {
          e.preventDefault();
          void run(text);
        }}
      >
        <input
          id={id}
          aria-label="직접 요청하기"
          placeholder="직접 요청 (예: 숫자를 더 강조해 줘)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <button className="btn btn--light" type="submit" disabled={busy || !text.trim()}>
          다시 쓰기
        </button>
      </form>
    </div>
  );
}

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
        <button className="btn btn--light" onClick={() => useLab.getState().openFocus(BUILDINGS.find((b) => b.id === "cards")!.objects.find((o) => o.panel === "printer")!)}>PNG 저장 · 인쇄기</button>
      </div>
      <GenerationStatus draft={draft} part="cards" />
      <fieldset className="generation-edit" disabled={draft.generation?.cards.status === "running" && useLab.getState().busy === "draft"}>
      <div className="strip" role="list">
        {cards.map((c, k) => (
          <button
            key={k}
            role="listitem"
            className={`strip__item ${k === i ? "strip__item--on" : ""}`}
            onClick={() => setSel(k)}
            aria-label={`${k + 1}번째 카드`}
          >
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
          {i === 0 ? <label className="field"><span>첫 페이지 일러스트</span><select value={MAIN_COVER_TEMPLATE.id} disabled><option value={MAIN_COVER_TEMPLATE.id}>{MAIN_COVER_TEMPLATE.name}</option></select></label> : <label className="field"><span>일러스트 템플릿 · 10종</span>
            <select value={card.template === MAIN_COVER_TEMPLATE.id ? "auto" : card.template ?? "auto"} onChange={(e) => editCard(id, i, { template: isCardTemplate(e.target.value) ? e.target.value : undefined })}>
              <option value="auto">자동 · {CARD_TEMPLATES.find((t) => t.id === chooseCardTemplate({ ...card, template: undefined }, i + 1))?.name}</option>
              {CARD_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>}
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
          {card.sections?.map((section, index) => <div key={index}>
            <label className="field"><span>설명 {index + 1} · 소제목</span><input value={section.heading} onChange={(e) => editCard(id, i, { sections: card.sections!.map((s, j) => j === index ? { ...s, heading: e.target.value } : s) })} /></label>
            <label className="field"><span>설명 {index + 1} · 내용</span><textarea rows={3} value={section.body} onChange={(e) => editCard(id, i, { sections: card.sections!.map((s, j) => j === index ? { ...s, body: e.target.value } : s) })} /></label>
          </div>)}
          <label className="field">
            <span>캡션 · 요약 + 고정 인사 + 원문 출처</span>
            <textarea id={`cap-${id}`} rows={8} onBlur={() => editDeck(id, { caption: captionWithSources(draft.deck.caption, requestFor(draft).items) })} value={draft.deck.caption} onChange={(e) => editDeck(id, { caption: e.target.value })} />
          </label>
          <ListField
            id={`hash-${id}`}
            label="해시태그 5개 (띄어쓰기로 구분)"
            value={draft.deck.hashtags}
            sep=" "
            onCommit={(v) => editDeck(id, { hashtags: selectHashtags(v, requestFor(draft).items) })}
          />
          <RewriteBox
            id={`rw-deck-${id}`}
            label="카드 문구 전체를 AI에게 다시 쓰게 하기 (장수는 그대로)"
            chips={["더 짧고 굵게", "더 쉽게", "더 흥미롭게", "숫자 강조", "전문가 말투"]}
            onRun={async (instruction) => {
              const next = await rewriteDeck(remoteLLM, requestFor(draft), draft.deck, instruction);
              editDeck(id, next);
              useLab.getState().say(`카드 문구를 다시 썼어요 (${instruction}).`);
            }}
          />
        </div>
      </div>
      </fieldset>
    </div>
  );
}

// ---------- 인쇄기 ----------
async function printDraft(d: Draft, only?: number): Promise<File[]> {
  const st = useLab.getState();
  if (st.busy) return [];
  st.setBusy("print");
  try {
    const files = await draftImages(d, st.brand, only);
    const how = await saveFiles(files);
    const size = designOf(st.brand).size === "square" ? "1080×1080" : "1080×1350";
    if (how !== "cancelled") st.say(how === "shared" ? `카드 ${files.length}장을 보냈어요.` : `카드 ${files.length}장을 ${size} 이미지로 뽑았어요.`);
    return files;
  } catch (e) {
    st.say(e instanceof Error ? e.message : "이미지를 만들지 못했어요. 다시 한번 눌러 주세요.");
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
          <button
            key={i}
            className="print__item"
            disabled={!!busy}
            onClick={() => printDraft(draft, i).then(showPrints)}
            aria-label={`${i + 1}번째 카드 이미지로 저장`}
          >
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
              <img key={p.url} src={p.url} alt={p.name} />
            ))}
          </div>
        </section>
      )}
      <footer className="pn__foot">
        <span className="muted">
          {designOf(brand).size === "square" ? "1080×1080" : "1080×1350"} PNG로 뽑아요. 디자인은 소장실 책상에서 바꿔요. 휴대폰에서는 공유 창이 열려 사진에
          저장할 수 있어요.
        </span>
        <button className="btn btn--primary" disabled={!!busy} onClick={() => printDraft(draft).then(showPrints)}>
          {busy === "print" ? "인쇄하는 중…" : `${draft.deck.cards.length}장 모두 인쇄하기`}
        </button>
      </footer>
    </div>
  );
}

// ---------- 블로그 원고 ----------
const blogText = (b: Draft["blog"]) =>
  [b.intro, ...b.sections.map((s) => `■ ${s.heading}\n\n${s.photo ? `[사진: ${s.photo}]\n\n` : ""}${s.body}`), b.outro].join("\n\n");

export function BlogPanel() {
  const { draft, pool } = useDraft();
  const editBlog = useLab((s) => s.editBlog);
  const [mode, setMode] = useState<"보기" | "고치기">("보기");
  if (!draft) return <NoDraft />;
  const b = draft.blog;
  const id = draft.id;
  const setSection = (k: number, patch: Partial<{ heading: string; body: string; photo: string }>) =>
    editBlog(id, { sections: b.sections.map((s, j) => (j === k ? { ...s, ...patch } : s)) });
  const len = blogLength(b);
  const target = blogTarget(requestFor(draft));
  return (
    <div className="pn">
      <div className="pn__bar">
        <DraftPicker pool={pool} draft={draft} part="blog" />
        <span className={`count ${len < target * 0.7 ? "count--short" : ""}`} title="공백 포함, 제목 제외">
          {len.toLocaleString()}자 <span className="muted">/ 목표 {target.toLocaleString()}자</span>
        </span>
        <Seg value={mode} options={["보기", "고치기"] as const} onChange={setMode} label="보기 방식" />
      </div>
      <GenerationStatus draft={draft} part="blog" />
      {draft.generation && ["skipped", "pending", "running", "failed"].includes(draft.generation.blog.status) && !b.title ? <p className="empty">블로그 원고는 아직 생성되지 않았습니다. 완성된 카드는 공방에서 확인하세요.</p> : mode === "보기" ? (
        <article className="paper">
          <h3>{b.title}</h3>
          <p>{b.intro}</p>
          {b.sections.map((s, k) => (
            <section key={k}>
              <h4>{s.heading}</h4>
              {s.photo && (
                <figure className="photo-slot">
                  <span>사진 자리</span>
                  {s.photo}
                </figure>
              )}
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
              <textarea
                id={`bb-${id}-${k}`}
                aria-label={`소제목 ${k + 1} 본문`}
                rows={8}
                value={s.body}
                onChange={(e) => setSection(k, { body: e.target.value })}
              />
              <input
                id={`bp-${id}-${k}`}
                aria-label={`소제목 ${k + 1} 사진 설명`}
                placeholder="사진 자리 설명 (비우면 사진 없음)"
                value={s.photo ?? ""}
                onChange={(e) => setSection(k, { photo: e.target.value })}
              />
              <RewriteBox
                id={`rw-sec-${id}-${k}`}
                label={`이 소제목을 AI에게 다시 쓰게 하기 (지금 ${(s.heading.length + s.body.length).toLocaleString()}자)`}
                chips={["더 길게", "더 짧게", "더 쉽게", "예시 추가", "전문가 말투"]}
                onRun={async (instruction) => {
                  const next = await rewriteSection(remoteLLM, requestFor(draft), useLab.getState().drafts.find((x) => x.id === id)!.blog, k, instruction);
                  const cur = useLab.getState().drafts.find((x) => x.id === id)!.blog;
                  editBlog(id, { sections: cur.sections.map((x, j) => (j === k ? next : x)) });
                  useLab.getState().say(`'${next.heading}' 소제목을 다시 썼어요 (${instruction}).`);
                }}
              />
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
          <ListField
            id={`btag-${id}`}
            label="태그 (쉼표로 구분)"
            value={b.tags}
            sep=", "
            onCommit={(v) => editBlog(id, { tags: v.map((t) => t.replace(/^#+/, "")) })}
          />
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
  const deck = finalizeDeck(d.deck, requestFor(d).items);
  const caption = `${deck.caption}\n\n${deck.hashtags.join(" ")}`;
  const look = { total: d.deck.cards.length, handle: brand.handle, series: brand.series, deep: d.type === "심층" };

  // 인스타그램 앱으로 넘길 짐: 카드 이미지 + 캡션
  const pack = async () => {
    const st = useLab.getState();
    st.setBusy("print");
    try {
      await navigator.clipboard?.writeText(caption).catch(() => undefined);
      const files = await draftImages(d, brand);
      const how = await saveFiles(files, caption);
      if (how === "cancelled") return;
      setPacked(true);
      say(
        how === "shared"
          ? "인스타그램에서 올리고 나면 '게시 완료'를 눌러 주세요."
          : "카드를 저장하고 캡션을 복사했어요. 인스타그램에 올리고 나면 '게시 완료'를 눌러 주세요.",
      );
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
                  {s.title}{" "}
                  <span className="muted">
                    {s.type}
                    {s.sample ? " · 예시" : ""}
                  </span>
                </td>
                {(["likes", "saves", "reach"] as const).map((k) => (
                  <td key={k}>
                    {s.sample ? (
                      s[k].toLocaleString()
                    ) : (
                      <input
                        className="num"
                        id={`${k}-${s.id}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`${s.title} ${k === "likes" ? "좋아요" : k === "saves" ? "저장" : "도달"}`}
                        value={s[k]}
                        onChange={(e) => editPost(s.id, { [k]: num(e.target.value) })}
                      />
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
              <input
                id={`st-title-${b.id}`}
                aria-label={`${b.name} 직원 직함`}
                value={staff[b.id].title}
                onChange={(e) => edit(b.id, { ...staff[b.id], title: e.target.value })}
              />
              <input
                id={`st-name-${b.id}`}
                aria-label={`${b.name} 직원 이름`}
                value={staff[b.id].name}
                onChange={(e) => edit(b.id, { ...staff[b.id], name: e.target.value })}
              />
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
                <textarea
                  id={`st-prompt-${b.id}`}
                  rows={3}
                  value={staff[b.id].prompt ?? ""}
                  onChange={(e) => edit(b.id, { ...staff[b.id], prompt: e.target.value })}
                />
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

/** 로그인한 뒤 비밀번호 만들기·바꾸기 (다음부터 이메일 + 비밀번호로 바로 로그인) */
function PasswordSetter() {
  const say = useLab((s) => s.say);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="row backup"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pw.length < 8) return say("비밀번호는 8자 이상으로 해 주세요.");
        setBusy(true);
        try {
          const { setPassword } = await import("../../cloud/session");
          await setPassword(pw);
          setPw("");
          say("비밀번호를 저장했어요. 다음부터 이메일과 비밀번호로 바로 로그인할 수 있어요.");
        } catch (x) {
          say(`비밀번호를 저장하지 못했어요: ${x instanceof Error ? x.message : String(x)}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span>로그인 비밀번호 만들기·바꾸기 (8자 이상)</span>
        <input id="b-password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      <button className="btn btn--light" type="submit" disabled={busy || !pw}>
        {busy ? "저장 중…" : "비밀번호 저장"}
      </button>
    </form>
  );
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

// ---------- 카드 디자인·글 분량 설정 ----------
const SAMPLE_COVER = { kind: "cover" as const, title: "오늘의 AI 소식 5가지", body: "수달이 골라 온 아침 소식" };

function CardDesignSettings() {
  const brand = useLab((s) => s.brand);
  const setBrand = useLab((s) => s.setBrand);
  const design = designOf(brand);
  const set = (patch: Partial<CardDesign>) => setBrand({ ...brand, design: { ...design, ...patch } });
  return (
    <section className="settings">
      <h3 className="pn__h">카드뉴스 디자인</h3>
      <div className="themes" role="radiogroup" aria-label="카드 테마">
        {THEMES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={design.theme === t.id}
            className={`theme ${design.theme === t.id ? "theme--on" : ""}`}
            onClick={() => set({ theme: t.id })}
          >
            <CardPreview card={SAMPLE_COVER} page={1} total={7} design={{ ...design, theme: t.id }} />
            <strong>{t.name}</strong>
            <span>{t.about}</span>
          </button>
        ))}
      </div>
      <div className="form2">
        <div className="field">
          <span>포인트 색</span>
          <div className="accents">
            {ACCENTS.map((c) => (
              <button
                key={c}
                className={`accent ${design.accent.toLowerCase() === c.toLowerCase() ? "accent--on" : ""}`}
                style={{ background: c }}
                aria-label={`포인트 색 ${c}`}
                onClick={() => set({ accent: c })}
              />
            ))}
            <label className="accent accent--pick" title="직접 고르기">
              <span className="sr-only">포인트 색 직접 고르기</span>
              <input id="b-accent" type="color" value={design.accent} onChange={(e) => set({ accent: e.target.value })} />
            </label>
          </div>
        </div>
        <label className="field">
          <span>제목 글꼴</span>
          <select id="b-font" value={design.font} onChange={(e) => set({ font: e.target.value as CardDesign["font"] })}>
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>카드 크기</span>
          <p>인스타그램 정사각형 · 1080×1080</p>
        </div>
      </div>
    </section>
  );
}

function Stepper({
  id,
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <span id={id}>{label}</span>
      <div className="stepper" role="group" aria-labelledby={id}>
        <button className="btn btn--light" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="줄이기">
          −
        </button>
        <strong>
          {value}
          {unit}
        </strong>
        <button className="btn btn--light" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="늘리기">
          +
        </button>
      </div>
    </div>
  );
}

function WritingSettings() {
  const brand = useLab((s) => s.brand);
  const setBrand = useLab((s) => s.setBrand);
  const w = writingOf(brand);
  const set = (patch: Partial<WritingPlan>) => setBrand({ ...brand, writing: { ...w, ...patch } });
  const lengthName = (n: number) => LENGTHS.find((l) => l.chars === n)?.label ?? "보통";
  const pickLength = (label: string) => LENGTHS.find((l) => l.label === label)!.chars;
  return (
    <section className="settings">
      <h3 className="pn__h">글 분량</h3>
      <div className="form2">
        <Stepper
          id="w-bundle"
          label="묶음 카드뉴스 소식 수 (카드는 +2장)"
          value={w.bundleCount}
          min={2}
          max={6}
          unit="개"
          onChange={(v) => set({ bundleCount: v })}
        />
        <Stepper
          id="w-deep"
          label="심층 카드뉴스 본문 장수 (카드는 +2장)"
          value={w.deepCards}
          min={3}
          max={6}
          unit="장"
          onChange={(v) => set({ deepCards: v })}
        />
        <div className="field">
          <span>묶음 블로그 길이</span>
          <Seg
            value={lengthName(w.bundleLength)}
            options={LENGTHS.map((l) => l.label)}
            onChange={(v) => set({ bundleLength: pickLength(v) })}
            label="묶음 블로그 길이"
          />
        </div>
        <div className="field">
          <span>심층 블로그 길이</span>
          <Seg
            value={lengthName(w.deepLength)}
            options={LENGTHS.map((l) => l.label)}
            onChange={(v) => set({ deepLength: pickLength(v) })}
            label="심층 블로그 길이"
          />
        </div>
      </div>
      <p className="muted">
        짧게 1,500자 · 보통 2,500자 · 길게 4,000자 · 아주 길게 6,000자 (공백 포함). 2,000자가 넘으면 설계도를 먼저 짜고 소제목마다 나눠 써서 시간이 조금 더
        걸려요.
      </p>
      <label className="check">
        <input id="w-photos" type="checkbox" checked={w.photos} onChange={(e) => set({ photos: e.target.checked })} />
        <span>블로그 소제목마다 사진 자리와 사진 설명(대체 텍스트)을 넣어 줘요</span>
      </label>
      <h3 className="pn__h">묶음 카드뉴스 분야 비율</h3>
      <p className="muted">루미가 회의 때 이 비율대로 소식을 골라 와요. 0이면 그 분야는 빼요. 국내·해외 매체는 반반쯤 섞어요.</p>
      <div className="mix">
        {CATEGORIES.map((c) => (
          <div key={c} className="mix__row" title={CATEGORY_INFO[c].desc}>
            <span className={`cat cat--${c}`}>{c}</span>
            <span className="mix__desc">{CATEGORY_INFO[c].desc}</span>
            <Stepper id={`w-mix-${c}`} label={`${c} 비율`} value={w.mix[c]} min={0} max={3} unit="" onChange={(v) => set({ mix: { ...w.mix, [c]: v } })} />
          </div>
        ))}
      </div>
      <p className="muted">
        지금 설정이면 묶음 {w.bundleCount}개를{" "}
        {CATEGORIES.map((c) => [c, quotas(w.bundleCount, w.mix)[c]] as const)
          .filter(([, n]) => n > 0)
          .map(([c, n]) => `${c} ${n}`)
          .join(" · ")}
        개로 골라요.
      </p>
    </section>
  );
}

export function BrandPanel() {
  const brand = useLab((s) => s.brand);
  const setBrand = useLab((s) => s.setBrand);
  const server = useServerStatus();
  const cloud = useLab((s) => s.cloud);
  const set = (k: "handle" | "series" | "tone" | "deepTone", v: string) => setBrand({ ...brand, [k]: v });
  const ai =
    server === "loading"
      ? "확인하는 중…"
      : !server
        ? "서버 없이 열려 있어요 (뼈대 초안으로 대신 써요)"
        : server.groq
          ? `연결됨 (${server.model})`
          : "키가 없어요 (.env.local에 GROQ_API_KEY)";
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
      <CardDesignSettings />
      <WritingSettings />
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
          <dt>자동 회의</dt>
          <dd>매일 회의 시간에 묶음 1개와 심층 1개</dd>
          <dd className="muted">GitHub Actions가 소장님 대신 회의해요 (SETUP.md)</dd>
        </div>
        <div>
          <dt>로그인·저장</dt>
          <dd>{cloud === "off" ? "이 브라우저에만 저장돼요" : "Supabase에 저장돼요"}</dd>
          <dd className="muted">
            {cloud === "off"
              ? "Supabase 주소를 넣고 배포하면 어디서나 열려요"
              : cloud === "error"
                ? "저장에 실패해서 다시 시도하고 있어요"
                : cloud === "saving"
                  ? "저장하는 중…"
                  : "모두 저장됨"}
            {cloud !== "off" && (
              <button className="link-btn" onClick={() => void import("../../cloud/session").then((m) => m.signOut())}>
                로그아웃
              </button>
            )}
          </dd>
        </div>
      </dl>
      {cloud !== "off" && <PasswordSetter />}
      <h3 className="pn__h">데이터</h3>
      <p className="muted">초안·소식·설정은 이 브라우저에만 저장돼요. 다른 기기로 옮기거나 지키려면 백업을 내려받아 두세요.</p>
      <Backup />
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
        <span className="muted">
          검토 대기 {drafts.filter((d) => d.status === "검토 대기").length}개, 게시함 {drafts.filter((d) => d.status === "게시함").length}개
        </span>
        <button className="btn btn--primary" onClick={() => { travel("receiver"); useLab.getState().openFocus(BUILDINGS.find((b) => b.id === "receiver")!.objects[0]); }}>
          새 초안 만들러 가기
        </button>
      </footer>
    </div>
  );
}
