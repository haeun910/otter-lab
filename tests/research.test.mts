import assert from "node:assert/strict";
import { proposeTopics, chooseRelatedNews, validateReport, validateOutline, validateApprovedResearch, researchNews } from "../src/lab/research/workflow.ts";
import { collectResearch, extractPage, isPublicAddress, publicUrl, referenceLinks } from "../src/lab/research/reader.ts";
import { writeDeck } from "../src/lab/gen/pipeline.ts";
import { DEFAULT_BRAND, cardsMessages } from "../src/lab/gen/prompt.ts";
import type { ApprovedResearch, ResearchSource } from "../src/lab/research/types.ts";
import type { NewsItem } from "../src/lab/data/demo.ts";

const seed:NewsItem={title:"AI 에이전트 발표",link:"https://news.example/agent",source:"매체",region:"국내",category:"AI",publishedAt:1,excerpt:"AI 에이전트의 도구와 권한을 설명합니다."};
const topics=await proposeTopics(async()=>({topics:[{title:"에이전트의 도구와 권한",focus:"하나의 업무 수행 방식",questions:["도구는?","권한은?"],seedIndices:[0,999],links:["https://invented.example"]}]}),[seed]);
assert.deepEqual(topics[0].seedLinks,[seed.link]);
const extra={...seed,title:"에이전트 권한 문서",link:"https://docs.example/agent"};
const chosen=await chooseRelatedNews(async()=>({indices:[0,999]}),topics[0],[seed,extra]);
assert.deepEqual(chosen.map(n=>n.link),[seed.link,extra.link]);
const text="Agents may call tools only with explicit permissions. Administrators configure access for each task. Tool results are checked before another action is taken. This testing document contains no forecasts and records only a fictional, controlled example.";
const sources:ResearchSource[]=[0,1,2].map((i)=>({id:"S"+(i+1),title:"검증 자료 "+i,url:"https://example.com/source"+i,publisher:"문서",text,fetchedAt:1,kind:"reference"}));
const raw={summary:"자료로 확인한 에이전트의 작동 방식",facts:Array.from({length:6},(_,i)=>({text:"확인된 정보 "+i,kind:i===1?"background":"fact",evidence:[{sourceId:"S"+(i%2+1),quote:"Administrators configure access for each task."}]})),gaps:["수치 비교 자료 없음"]};
const report=validateReport(raw,sources);
assert.throws(()=>validateReport({...raw,facts:[{...raw.facts[0],evidence:[{sourceId:"S1",quote:"An invented unsupported assertion."}]}]},sources),/인용문/);
assert.throws(()=>validateReport({...raw,facts:[{...raw.facts[0],evidence:[{sourceId:"S999",quote:text}]}]},sources),/인용문/);
assert.throws(()=>validateReport({...raw,facts:[raw.facts[0],raw.facts[0],raw.facts[0],raw.facts[0]]},sources),/부족/);
const outline=validateOutline({cards:Array.from({length:7},(_,i)=>({kind:i===0?"cover":i===6?"outro":"body",title:"제목 "+i,point:"설명할 내용 "+i,factIds:["F"+(i%6+1)]}))},report);
assert.throws(()=>validateOutline({cards:outline.slice(0,6)},report),/7장/);
assert.throws(()=>validateOutline({cards:outline.map((c,i)=>i===3?{...c,factIds:["F999"]}:c)},report),/근거/);
const research:ApprovedResearch={topic:topics[0],sources,report,outline,approvedAt:1};
validateApprovedResearch(research);
assert.throws(()=>validateApprovedResearch({...research,approvedAt:0}),/확인/);
assert.equal(researchNews(research,"AI").length,2,"Only sources used by approved facts are included");
assert.equal(researchNews(research,"AI")[0].region,"미확인","Do not invent the region of reference documents");
const req={type:"심층" as const,items:researchNews(research,"AI"),brand:DEFAULT_BRAND,prompts:{},research};
assert.ok(cardsMessages(req)[1].content.includes("소장이 승인한 7장 구성안"));
let calls=0;
const explanations=[
  "관리자는 작업별로 접근 권한을 설정합니다. 실행에 필요한 도구만 허용하면 에이전트가 사용할 수 있는 범위가 정해집니다. 이 자료는 권한을 명시적으로 설정하는 예시를 설명하며 실제 서비스의 성능 수치를 비교하지 않습니다.",
  "도구를 호출하면 실행 결과가 반환됩니다. 에이전트는 이 결과를 확인한 다음 다음 동작을 진행합니다. 결과 확인 단계가 작업 사이에 들어가며, 최초 요청에서 마지막 실행까지 한 번에 처리하는 흐름으로 설명하지 않습니다.",
  "이 문서는 실제 제품 발표가 아니라 통제된 검증 예시입니다. 자료에 없는 서비스를 추가하거나 상용 제품의 성능으로 해석할 수 없습니다. 인용문에 기록된 작동 방식과 예시의 범위를 구분해 읽어야 합니다.",
  "요청마다 관리자가 정한 접근 범위가 적용됩니다. 도구 사용은 명시적으로 허용된 작업을 대상으로 합니다. 권한 설정에 대한 문서의 설명을 바탕으로, 에이전트의 요청과 실제로 허용된 행동이 같은 단계인지 구분할 수 있습니다.",
  "자료에는 미래에 대한 예측이나 성능 전망이 포함되어 있지 않습니다. 따라서 처리 속도나 비용 개선 정도를 이 예시로 계산할 수 없습니다. 확인한 사실을 설명하는 부분과 추가 자료가 있어야 알 수 있는 부분을 나눕니다.",
];
const llm=async()=>{calls++;return {cards:outline.map((c,i)=>({...c,body:i>0&&i<6?explanations[i-1]:"확인한 정보를 설명합니다."})),caption:"주제를 쉽게 정리했어요.",hashtags:["#에이전트"]};};
const deck=await writeDeck(llm,req);
assert.equal(deck.cards.length,7);assert.equal(deck.cards[0].template,"main");
assert.ok(deck.caption.includes(sources[0].url)&&deck.caption.includes(sources[1].url)&&!deck.caption.includes(sources[2].url));
await assert.rejects(()=>writeDeck(llm,{...req,research:{...research,approvedAt:0}}),/확인/);
assert.equal(calls,1,"Do not call the writing model before outline approval");
await assert.rejects(()=>writeDeck(async()=>({cards:outline.map((c,i)=>({...c,body:"내용",factIds:i===1?["F999"]:c.factIds})),caption:"c",hashtags:["#태그"]}),req),/확정 구성안/);

for(const ip of ["127.0.0.1","10.0.0.1","169.254.169.254","172.16.0.1","192.168.1.1","100.64.0.1","::1","fe80::1","::ffff:127.0.0.1","2001:db8::1","2002:7f00:1::"]) assert.equal(isPublicAddress(ip),false,ip);
assert.equal(isPublicAddress("8.8.8.8"),true);assert.equal(isPublicAddress("2606:4700:4700::1111"),true);
for(const url of ["http://localhost/","http://127.1/","http://2130706433/","file:///etc/passwd","https://user:pass@example.com/","https://example.com:8080/"]) assert.throws(()=>publicUrl(url));
const page=extractPage("<title>本文</title><body><nav>雑音</nav><article>"+text+"</article><script>evil</script></body>","https://example.com");
assert.equal(page.text,text);assert.ok(!page.text.includes("evil"));
assert.deepEqual(referenceLinks('<a href="https://openai.com/research/example">資料</a><a href="http://127.0.0.1/">x</a><a href="https://openai.com.attacker.example/x">x</a>',seed.link),["https://openai.com/research/example"]);
assert.deepEqual(referenceLinks('<a href="https://developers.cloudflare.com/web-search/about/">공식 문서</a><a href="https://cloudflare.com.attacker.example/x">x</a>',seed.link),["https://developers.cloudflare.com/web-search/about/"]);
const visited:string[]=[];
const collected=await collectResearch([seed],["http://127.0.0.1/","https://docs.example/agent"],async(url)=>{visited.push(url);return {url,html:"<title>資料</title><article>"+text+'</article><a href="https://openai.com/research/example">公式</a>'};});
assert.equal(collected.sources.length,3);
assert.equal(collected.sources[0].region,seed.region);
assert.ok(!visited.includes("http://127.0.0.1/"));assert.equal(collected.failures.length,1);
assert.equal(new Set(collected.sources.map(s=>s.id)).size,collected.sources.length);
const {POST}=await import("../app/api/research/route.ts");
assert.equal((await POST(new Request("https://lab.example/api/research",{method:"POST",body:"null"}))).status,400);
console.log("RESEARCH OK: proposal provenance, confirmed topic, quoted evidence, source selection, approved seven-card plan, public-page reader, private-address rejection");
