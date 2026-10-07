"use client";
import { useState } from "react";
import type { NewsItem } from "../../data/demo";
import { BUILDINGS } from "../../data/buildings";
import { writeJob } from "../../company";
import { fetchResearch, remoteLLM } from "../../gen/client";
import { useLab } from "../../store";
import { newTopicProject, type Topic, type TopicProject, type ApprovedResearch } from "../../research/types";
import { proposeTopics, chooseRelatedNews, analyzeSources, planCards, researchNews, validateApprovedResearch } from "../../research/workflow";
import type { DraftRequest } from "../../gen/prompt";

const STAGES = { topic: "주제 검토", research: "자료 조사", outline: "구성안 확인", generated: "카드 완성" };
export default function TopicWorkshop({ selected }: { selected: NewsItem[] }) {
  const st = useLab();
  const [pending, setPending] = useState("");
  const p = st.projects.find((x)=>x.id===st.currentProject) ?? st.projects[0];
  const disabled = Boolean(st.busy || pending);
  const patch = (values: Partial<TopicProject>) => p && st.patchProject(p.id,values);
  const act = async (id:string, label:string, work:()=>Promise<void>) => {
    if (useLab.getState().busy) return;
    setPending(label);useLab.getState().setBusy("research");useLab.getState().patchProject(id,{error:undefined});
    try {await work();} catch(e) {useLab.getState().patchProject(id,{error:e instanceof Error?e.message:"작업을 완료하지 못했어요."});}
    finally {useLab.getState().setBusy(null);setPending("");}
  };
  const propose = async (project:TopicProject) => act(project.id,"주제를 제안하고 있어요",async()=>{
    const proposals = await proposeTopics(remoteLLM,project.seeds);
    useLab.getState().patchProject(project.id,{proposals,stage:"topic",topic:undefined,report:undefined,outline:[],sources:[],failures:[],draftId:undefined});
  });
  const start = async () => {
    if (disabled || !selected.length || selected.length>6) return;
    const project = newTopicProject(selected);
    st.addProject(project);
    await propose(project);
  };
  const topicChange = (topic:Topic) => patch({topic,report:undefined,outline:[],sources:[],failures:[],draftId:undefined,stage:"topic",error:undefined});
  const investigate = async (again=false) => {
    if (!p?.topic?.title.trim() || !p.topic.focus.trim()) return;
    const project = structuredClone(p);
    const topic = project.topic!;
    st.patchProject(project.id,{stage:"research"});
    await act(project.id,"관련 자료를 조사·분석하고 있어요",async()=>{
      let sources = project.sources;
      let report = project.report;
      if (again || sources.length<2) {
        const library = [...project.seeds,...useLab.getState().library].filter((n,i,all)=>all.findIndex((x)=>x.link===n.link)===i);
        const news = await chooseRelatedNews(remoteLLM,topic,library);
        const collected = await fetchResearch(news,project.extraLinks);
        sources = collected.sources;report=undefined;
        useLab.getState().patchProject(project.id,{sources,failures:collected.failures,report:undefined,outline:[]});
      }
      if (!report) {
        report = await analyzeSources(remoteLLM,topic,sources,(done,total)=>setPending(`원문 구간 분석 ${done}/${total} · 사실과 설명 근거를 모으고 있어요`),again?undefined:project.analysis,(analysis)=>useLab.getState().patchProject(project.id,{analysis}));
        useLab.getState().patchProject(project.id,{report});
      }
      const outline = await planCards(remoteLLM,topic,report);
      useLab.getState().patchProject(project.id,{outline,stage:"outline",error:undefined});
    });
  };
  const makeCards = async () => {
    if (!p?.topic || !p.report || disabled) return;
    setPending("확정 구성안으로 카드 7장을 쓰고, 내용 검수와 필요한 보완을 진행하고 있어요");
    try {
      const research:ApprovedResearch = structuredClone({topic:p.topic,sources:p.sources,report:p.report,outline:p.outline,approvedAt:Date.now()});
      validateApprovedResearch(research);
      const items = researchNews(research,p.seeds[0].category);
      const state = useLab.getState();
      const request:DraftRequest = {type:"심층",items,brand:{...state.brand,writing:{...state.brand.writing,deepCards:5}},prompts:{cards:state.staff.cards?.prompt,blog:state.staff.blog?.prompt},research,qualityVersion:1,cardFormatVersion:1};
      const previous = state.drafts.find((d)=>d.id===p.draftId && d.status!=="게시함");
      const draft = await writeJob("심층",items,undefined,{target:"cards",request,...(previous?{draftId:previous.id}:{})});
      if (!draft) throw new Error("카드 제작을 시작하지 못했어요.");
      state.patchProject(p.id,{draftId:draft.id,stage:draft.generation?.cards.status==="complete"?"generated":"outline",error:draft.generation?.cards.error});
      if (draft.generation?.cards.status==="complete") for (const link of state.basket) if (p.seeds.some((n)=>n.link===link)) state.toggleBasket(link);
    } catch(e) {st.patchProject(p.id,{error:e instanceof Error?e.message:"카드 제작 실패"});}
    finally {setPending("");}
  };
  const openDraft = () => {
    if (!p?.draftId) return;
    st.setCurrent(p.draftId);st.travel("cards");st.openFocus(BUILDINGS.find((b)=>b.id==="cards")!.objects[0]);
  };
  return <section className="topic-workshop" aria-label="주제 조사와 카드뉴스 제작">
    <h3>뉴스에서 주제로, 주제에서 카드뉴스로</h3>
    <p className="muted">한 편에 주제 하나를 설명합니다. 주제 확정 → 추가 자료 조사·분석 → 7장 구성안 확인 → 카드 제작.</p>
    <div className="pn__foot"><span>출발 뉴스 {selected.length}개 선택</span><button className="btn btn--primary" disabled={disabled||!selected.length||selected.length>6} onClick={start}>선택한 뉴스로 주제 제안</button></div>
    {selected.length>6 && <p>출발 뉴스는 6개까지 선택해 주세요.</p>}
    {st.projects.length>0 && <label className="field"><span>진행 중인 주제</span><select disabled={disabled} value={p?.id ?? ""} onChange={(e)=>st.setCurrentProject(e.target.value)}>{st.projects.map((x)=><option key={x.id} value={x.id}>{STAGES[x.stage]} · {x.topic?.title ?? x.proposals[0]?.title ?? x.seeds[0]?.title}</option>)}</select></label>}
    {pending && <p role="status">{pending}</p>}
    {p && <div>
      <ol className="topic-steps"><li className={p.stage==="topic"?"active":""}>1 주제 확정</li><li className={p.stage==="research"?"active":""}>2 조사·분석</li><li className={p.stage==="outline"?"active":""}>3 구성안 확인</li><li className={p.stage==="generated"?"active":""}>4 카드 제작</li></ol>
      {p.error && <p className="topic-error" role="alert">{p.error}</p>}
      <fieldset disabled={disabled}>
        <legend>주제와 범위</legend>
        {p.stage==="topic" && <>
          {p.proposals.map((topic,i)=><label key={i} className="topic-proposal"><input type="radio" name={"topic-"+p.id} checked={p.topic?.seedLinks.join("|")===topic.seedLinks.join("|") && p.topic?.title===topic.title} onChange={()=>topicChange(topic)} /><span><strong>{topic.title}</strong><br/>{topic.focus}<br/><small>{topic.questions.join(" · ")}</small></span></label>)}
          <div className="row"><button className="btn btn--light" onClick={()=>propose(p)}>주제 다시 제안</button><button className="btn btn--light" onClick={()=>topicChange({title:"",focus:"",questions:[""],seedLinks:[p.seeds[0].link]})}>직접 주제 정하기</button></div>
        </>}
        {p.topic && <>
          {p.stage==="topic" ? <>
            <label className="field"><span>설명할 주제</span><input maxLength={60} value={p.topic.title} onChange={(e)=>topicChange({...p.topic!,title:e.target.value})}/></label>
            <label className="field"><span>설명 범위</span><textarea rows={2} value={p.topic.focus} onChange={(e)=>topicChange({...p.topic!,focus:e.target.value})}/></label>
            <label className="field"><span>조사할 질문 (줄마다 하나)</span><textarea rows={3} value={p.topic.questions.join("\n")} onChange={(e)=>topicChange({...p.topic!,questions:e.target.value.split("\n")})}/></label>
          </> : <p><strong>{p.topic.title}</strong><br/>{p.topic.focus}</p>}
          <label className="field"><span>추가 참고 링크 (선택 · 줄마다 하나, 최대 4개)</span><textarea rows={3} value={p.extraLinks.join("\n")} onChange={(e)=>patch({extraLinks:e.target.value.split("\n"),sources:[],failures:[],report:undefined,outline:[],stage:p.stage==="topic"?"topic":"research",error:undefined})}/></label>
          {p.stage==="topic" && <button className="btn btn--primary" disabled={!p.topic.title.trim()||!p.topic.focus.trim()} onClick={()=>investigate()}>주제 확정 · 자료 조사하기</button>}
          {p.stage!=="topic" && <div className="row"><button className="btn btn--light" onClick={()=>patch({stage:"topic",report:undefined,outline:[],sources:[],failures:[],draftId:undefined,error:undefined})}>주제 다시 정하기</button><button className="btn btn--light" onClick={()=>investigate(true)}>자료 다시 조사</button>{p.stage==="research" && <button className="btn btn--primary" onClick={()=>investigate()}>{p.report?"구성안 다시 만들기":p.sources.length>=2?"분석 다시 시도":"자료 조사 다시 시도"}</button>}</div>}
        </>}
      </fieldset>
      {p.sources.length>0 && <section><h4>읽은 자료 {p.sources.length}개</h4>{p.sources.map((s)=><details key={s.id}><summary>{s.id} · {s.title}</summary><a href={s.url} target="_blank" rel="noreferrer">{s.publisher} · 원문 보기</a><p>{s.text.slice(0,700)}</p></details>)}</section>}
      {p.failures.length>0 && <details><summary>읽지 못한 자료 {p.failures.length}개</summary>{p.failures.map((f)=><p key={f.url}>{f.url}<br/>{f.error}</p>)}</details>}
      {p.report && <section><h4>조사·분석 결과</h4><p>{p.report.summary}</p>{p.report.facts.map((f)=><details key={f.id}><summary>{f.id} · {f.text}</summary>{f.detail && <p>{f.detail}</p>}{f.evidence.map((e,i)=><blockquote key={i}>{e.quote}<br/><small>{e.sourceId} · {p.sources.find((s)=>s.id===e.sourceId)?.title}</small></blockquote>)}</details>)}{p.report.gaps.length>0 && <><h4>추가 확인할 내용</h4><ul>{p.report.gaps.map((gap,i)=><li key={i}>{gap}</li>)}</ul></>}</section>}
      {p.outline.length>0 && <fieldset disabled={disabled}><legend>7장 구성안 · 제작 전에 확인해 주세요</legend>{p.outline.map((card,i)=><div className="topic-outline-card" key={i}>
        <strong>{i+1}장 · {card.kind==="cover"?"메인 수달 표지":card.kind==="outro"?"핵심 정리":"설명"}</strong>
        <label className="field"><span>{i+1}장 제목</span><input maxLength={36} value={card.title} onChange={(e)=>patch({outline:p.outline.map((c,j)=>i===j?{...c,title:e.target.value}:c),stage:"outline",error:undefined})}/></label>
        <label className="field"><span>{i+1}장 설명할 내용</span><textarea rows={2} value={card.point} onChange={(e)=>patch({outline:p.outline.map((c,j)=>i===j?{...c,point:e.target.value}:c),stage:"outline",error:undefined})}/></label>
        <p className="muted">근거: {card.factIds.join(", ")}</p>
      </div>)}<button className="btn btn--primary" onClick={makeCards}>구성안 확정 · 카드 7장 제작</button></fieldset>}
      {p.draftId && <button className="btn btn--light" disabled={disabled} onClick={openDraft}>공방에서 카드 확인</button>}
    </div>}
  </section>;
}
