import assert from "node:assert/strict";
import { inspectCards, CardQualityError, reviewAndRepair } from "../src/lab/gen/quality.ts";
import { generate } from "../src/lab/gen/generate.ts";
import { writeDeck } from "../src/lab/gen/pipeline.ts";
import { DEFAULT_BRAND, cardsMessages, type DraftRequest } from "../src/lab/gen/prompt.ts";
import { analyzeSources, researchBatches, validateReport, validateOutline } from "../src/lab/research/workflow.ts";
import { extractPage } from "../src/lab/research/reader.ts";
import type { AnalysisCheckpoint, ResearchSource } from "../src/lab/research/types.ts";
import type { Card, Deck } from "../src/lab/data/demo.ts";

const quote="Administrators configure access for each task.";
const sources:ResearchSource[]=[1,2].map(i=>({id:"S"+i,title:"검증 문서 "+i,url:"https://example.com/doc"+i,publisher:"검증",text:quote+" "+"Reviewed tool output is supplied to the next step. ".repeat(2),fetchedAt:1,kind:"reference"}));
const raw={summary:"검증 예제",facts:Array.from({length:6},(_,i)=>({text:"작업별 접근 범위와 확인 과정 "+i,detail:"설명을 확장하는 문맥 "+i,kind:"fact",evidence:[{sourceId:"S"+(i%2+1),quote}]})),gaps:[]};
const report=validateReport(raw,sources);
assert.throws(()=>validateReport({...raw,facts:raw.facts.slice(0,4)},sources),/6개/);
const outline=validateOutline({cards:Array.from({length:7},(_,i)=>({kind:i===0?"cover":i===6?"outro":"body",title:"검증 제목 "+i,point:"서로 다른 질문 "+i,factIds:["F"+(i%6+1)]}))},report);
assert.throws(()=>validateOutline({cards:outline.map(c=>({...c,factIds:["F1"]}))},report),/반복/);
assert.throws(()=>validateOutline({cards:outline.map((c,i)=>({...c,point:i>0&&i<6?"동일한 설명":c.point}))},report),/반복/);
const paragraphs=[
  "관리자는 작업별로 접근 권한을 설정합니다. 실행에 필요한 도구만 허용하면 에이전트가 사용할 수 있는 범위가 정해집니다. 이 자료는 권한을 명시적으로 설정하는 예시를 설명하며 실제 서비스의 성능 수치를 비교하지 않습니다.",
  "도구를 호출하면 실행 결과가 반환됩니다. 에이전트는 이 결과를 확인한 다음 다음 동작을 진행합니다. 결과 확인 단계가 작업 사이에 들어가며, 최초 요청에서 마지막 실행까지 한 번에 처리하는 흐름으로 설명하지 않습니다.",
  "이 문서는 실제 제품 발표가 아니라 통제된 검증 예시입니다. 자료에 없는 서비스를 추가하거나 상용 제품의 성능으로 해석할 수 없습니다. 인용문에 기록된 작동 방식과 예시의 범위를 구분해 읽어야 합니다.",
  "요청마다 관리자가 정한 접근 범위가 적용됩니다. 도구 사용은 명시적으로 허용된 작업을 대상으로 합니다. 권한 설정에 대한 문서의 설명을 바탕으로, 에이전트의 요청과 실제로 허용된 행동이 같은 단계인지 구분할 수 있습니다.",
  "자료에는 미래에 대한 예측이나 성능 전망이 포함되어 있지 않습니다. 따라서 처리 속도나 비용 개선 정도를 이 예시로 계산할 수 없습니다. 확인한 사실을 설명하는 부분과 추가 자료가 있어야 알 수 있는 부분을 나눕니다.",
];
const deck:Deck={cards:outline.map((c,i)=>({...c,body:i>0&&i<6?paragraphs[i-1]:"표지와 정리",template:i===0?"main":"researcher"} as Card)),caption:"원래 요약",hashtags:["#테스트"]};
const research={topic:{title:"작업 권한",focus:"검증 예시",questions:["권한은?","확인은?"],seedLinks:[sources[0].url]},sources,report,outline,approvedAt:1};
const req:DraftRequest={type:"심층",items:[{title:"검증",link:sources[0].url,source:"문서",region:"해외",category:"AI",publishedAt:1,excerpt:quote}],brand:DEFAULT_BRAND,prompts:{},research,qualityVersion:1};
assert.ok(cardsMessages(req)[0].content.includes("100~220"));
assert.ok(cardsMessages(req)[1].content.includes("설명을 확장하는 문맥"));
assert.ok(cardsMessages(req)[1].content.includes("Reviewed tool output"));
assert.deepEqual(inspectCards(deck.cards),[]);
const thin={...deck,cards:deck.cards.map(c=>({...c,body:"AI 기술이 발전하고 있습니다."}))};
assert.equal(inspectCards(thin.cards).filter(i=>i.kind==="thin").length,5);
assert.ok(inspectCards(thin.cards).some(i=>i.kind==="repeat"));
assert.ok(inspectCards(deck.cards.map((c,i)=>i===2?{...c,body:paragraphs[0]}:c)).some(i=>i.card===3&&i.kind==="repeat"));

let reviews=0,repairs=0;
const repaired=await reviewAndRepair(async(messages)=>{
  if(messages[0].content.includes("내용 검수")) {reviews++;return reviews===1?{passed:false,issues:[{card:3,kind:"grounding",message:"근거에서 확인한 동작 순서로 고쳐 주세요."}]}:{passed:true,issues:[]};}
  repairs++;return {cards:[{page:3,card:{...deck.cards[2],body:paragraphs[1]+" 원문 문맥을 함께 확인합니다."}}]};
},req,deck,()=>{});
assert.equal(reviews,2);assert.equal(repairs,1);assert.equal(repaired.quality?.status,"passed");assert.deepEqual(repaired.quality?.repaired,[3]);
assert.strictEqual(repaired.cards[1],deck.cards[1],"A correction must preserve unaffected cards");assert.equal(repaired.caption,deck.caption);
assert.notEqual(repaired.cards[2].body,deck.cards[2].body);assert.equal(deck.cards[2].body,paragraphs[1],"The original deck remains unchanged");
await assert.rejects(()=>reviewAndRepair(async()=>({passed:false,issues:[]}),req,deck,()=>{}),/판정/);
await assert.rejects(()=>reviewAndRepair(async()=>({passed:false,issues:[{card:99,kind:"grounding",message:"오류"}]}),req,deck,()=>{}),/페이지/);
let badCalls=0;
await assert.rejects(()=>reviewAndRepair(async()=>{
  badCalls++;return badCalls===2?{cards:[{page:2,card:deck.cards[1]}]}:{passed:false,issues:[{card:3,kind:"grounding",message:"근거 없는 주장"}]};
},req,deck,()=>{}),/지적한 카드/);
let failedReviews=0;
const failed=await generate(async(messages)=>{
  if(messages[0].content.includes("내용 검수")){failedReviews++;return {passed:false,issues:[{card:3,kind:"grounding",message:"인용에서 확인할 수 없어요."}]};}
  if(messages[0].content.includes("지적된 카드만"))return {cards:[{page:3,card:deck.cards[2]}]};
  return deck;
},req,{target:"cards",previous:{deck,blog:{title:"편집한 원고",intro:"",sections:[],outro:"",tags:[]},cards:{status:"complete",engine:"groq"},blogState:{status:"complete"}}});
assert.equal(failed.cards.status,"failed");assert.equal(failed.cards.review?.status,"needs_revision");assert.equal(failedReviews,2);assert.strictEqual(failed.deck,deck);assert.equal(failed.blog.title,"편집한 원고");
await assert.rejects(()=>writeDeck(async()=>thin,{...req,qualityVersion:undefined}),CardQualityError);
let malformedCalls=0;
await assert.rejects(()=>writeDeck(async(messages)=>{
  if (messages[0].content.includes("내용 검수")) return {passed:false,issues:[{card:3,kind:"grounding",message:"근거 없는 주장"}]};
  if (messages[0].content.includes("지적된 카드만")) {malformedCalls++;return {cards:[{page:3,card:{...deck.cards[2],sections:{heading:"잘못된 형식"}}}]};}
  return deck;
},req),/추가 설명/);
assert.equal(malformedCalls,1,"Malformed repair output must be rejected instead of becoming a publishable deck");

const tail="The later part documents a newly introduced permission condition.";
const long=[{...sources[0],text:quote+" "+"Earlier paragraphs with context. ".repeat(150)+tail},{...sources[1],text:quote+" "+"Background facts. ".repeat(160)}];
assert.ok(researchBatches(long).flat().some(p=>p.text.includes(tail)));
assert.ok(extractPage("<article>"+long[0].text+"</article>",sources[0].url).text.includes(tail));
let checkpoint:AnalysisCheckpoint|undefined,calls=0,seenTail=false,failOnce=true;
const partial=async(messages:{content:string}[])=>{
  calls++;const text=messages[1].content;seenTail ||= text.includes(tail);
  if(calls===2&&failOnce){failOnce=false;throw new Error("Groq 429");}
  const pieces=JSON.parse(text.split("수집 원문:\n")[1]) as {id:string;text:string}[];
  const piece=pieces[0];const q=piece.text.slice(0,50);
  return {summary:"구간에서 확인한 설명",facts:Array.from({length:6},(_,i)=>({text:piece.text.slice(0,50)+" · 항목 "+i,detail:"원문의 구체적인 조건",kind:"fact",evidence:[{sourceId:piece.id,quote:q}]})),gaps:[]};
};
await assert.rejects(()=>analyzeSources(partial,research.topic,long,undefined,undefined,c=>checkpoint=c),/429/);
assert.equal(checkpoint?.parts.length,1);
const result=await analyzeSources(partial,research.topic,long,undefined,checkpoint,c=>checkpoint=c);
assert.ok(seenTail);assert.ok(result.facts.length>=6);assert.equal(calls,researchBatches(long).length+1,"Retry reuses verified, saved chunk analysis");
console.log("QUALITY OK: repeated/thin cards blocked, grounding review required, selective repair, failed edits preserved, complete source chunks, checkpoint retry");
