// Server-only public-page reader. DNS answers are checked and pinned for every redirect.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { plainText } from "../news/rss";
import type { NewsItem } from "../data/demo";
import type { ResearchSource } from "./types";

export function isPublicAddress(ip: string): boolean {
  if (isIP(ip)===4) {
    const [a,b,c] = ip.split(".").map(Number);
    return !(a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || (a===100&&b>=64&&b<=127) || (a===198&&(b===18||b===19)) || (a===192&&b===0) || (a===198&&b===51&&c===100) || (a===203&&b===0&&c===113));
  }
  if (isIP(ip)===6) return /^[23][0-9a-f]{3}:/i.test(ip) && !/^2001:(db8|0{1,4}):/i.test(ip) && !/^2002:/i.test(ip);
  return false;
}
export function publicUrl(value: string): URL {
  const u = new URL(value);
  const host = u.hostname.replace(/^\[|\]$/g,"");
  if (!["http:","https:"].includes(u.protocol) || u.username || u.password || (u.port && u.port !== (u.protocol==="https:"?"443":"80")) || host==="localhost" || host.endsWith(".localhost") || (isIP(host) && !isPublicAddress(host))) throw new Error("공개 웹페이지의 http/https 주소만 조사할 수 있어요.");
  u.hash = "";
  return u;
}
export function extractPage(html: string, url: string) {
  const title = plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || new URL(url).hostname;
  const cleaned = html.replace(/<(script|style|nav|footer|header|aside|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi," ");
  const main = cleaned.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1] ?? cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? cleaned;
  return {title:title.slice(0,200),text:plainText(main).slice(0,6000)};
}
export async function readPublicPage(value: string, redirects=0, deadline=Date.now()+10_000): Promise<{url:string;html:string}> {
  const u = publicUrl(value);
  const hostname = u.hostname.replace(/^\[|\]$/g,"");
  const remaining = deadline-Date.now();
  if (remaining<=0) throw new Error("원문을 읽는 시간이 초과됐어요.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let addresses: {address:string;family:number}[];
  try { addresses = isIP(hostname) ? [{address:hostname,family:isIP(hostname)}] : await Promise.race([
    lookup(hostname,{all:true}),
    new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error("원문 주소를 확인하는 시간이 초과됐어요.")),remaining);}),
  ]); } finally { if (timer) clearTimeout(timer); }
  if (!addresses.length || addresses.some((a)=>!isPublicAddress(a.address))) throw new Error("내부 네트워크 주소는 조사할 수 없어요.");
  const pinned = addresses[0];
  const result = await new Promise<{status:number;location?:string;html:string}>((resolve,reject)=>{
    const req = (u.protocol==="https:"?httpsRequest:httpRequest)(u,{
      signal:AbortSignal.timeout(Math.max(1,deadline-Date.now())),headers:{"user-agent":"OtterLab/0.4 (topic research)","accept":"text/html,text/plain","accept-encoding":"identity"},
      lookup: (_hostname,opts,cb) => {
        if (typeof opts==="object" && opts.all) cb(null,[{address:pinned.address,family:pinned.family as 4|6}]);
        else cb(null,pinned.address,pinned.family);
      },
    },(res)=>{
      const status = res.statusCode ?? 0;
      if (status>=300 && status<400) {res.resume();resolve({status,location:res.headers.location,html:""});return;}
      if (status!==200) {res.resume();reject(new Error("원문 서버 응답 "+status));return;}
      const type = res.headers["content-type"] ?? "";
      if (!/text\/(?:html|plain)|application\/xhtml/i.test(type)) {res.resume();reject(new Error("HTML·텍스트 원문만 읽을 수 있어요."));return;}
      const chunks:Buffer[]=[];let bytes=0;
      res.on("data",(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>800_000){req.destroy(new Error("원문이 너무 커서 읽지 못했어요."));return;}chunks.push(chunk);});
      res.on("end",()=>resolve({status,html:Buffer.concat(chunks).toString("utf8")}));
      res.on("error",reject);
    });
    req.on("error",reject);req.end();
  });
  if (result.status>=300 && result.status<400) {
    if (!result.location || redirects>=3) throw new Error("원문 주소 이동을 확인하지 못했어요.");
    return readPublicPage(new URL(result.location,u).href,redirects+1,deadline);
  }
  return {url:u.href,html:result.html};
}
const OFFICIAL = ["openai.com","anthropic.com","ai.google","blog.google","research.google","developers.google.com","microsoft.com","learn.microsoft.com","github.com","huggingface.co","arxiv.org","hancom.com","hancom.ai"];
export function referenceLinks(html: string, base: string): string[] {
  const links:string[]=[];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    try {
      const u = publicUrl(new URL(match[1].replace(/&amp;/g,"&"),base).href);
      if (u.hostname===new URL(base).hostname || u.pathname==="/" || /\.(png|jpe?g|svg|pdf|webp|zip)$/i.test(u.pathname)) continue;
      if (!OFFICIAL.some((host)=>u.hostname===host||u.hostname.endsWith("."+host))) continue;
      if (!links.includes(u.href)) links.push(u.href);
    } catch { /* An invalid article link is not a source. */ }
    if (links.length===2) break;
  }
  return links;
}
export async function collectResearch(items: NewsItem[], extraLinks: string[] = [], read=readPublicPage) {
  const news = items.map((n)=>({url:n.link,title:n.title,publisher:n.source,kind:"news" as const,region:n.region}));
  const queue = [...news.slice(0,1),...extraLinks.filter((url)=>url.trim()).map((url)=>({url:url.trim(),title:"",publisher:"",kind:"reference" as const})),...news.slice(1)];
  const seen = new Set<string>();const sources:ResearchSource[]=[];const failures:{url:string;error:string}[]=[];
  const batches = [queue.slice(0,6)];
  for (const batch of batches) {
    const discovered:string[]=[];
    const results = await Promise.all(batch.map(async (input)=>{
      try {
        const canonical = publicUrl(input.url).href;
        if (seen.has(canonical)) return;
        seen.add(canonical);
        const page = await read(canonical);
        const resolved = publicUrl(page.url).href;
        const text = extractPage(page.html,resolved);
        if (text.text.length<160) throw new Error("읽을 수 있는 원문 내용이 부족해요.");
        if (sources.some((s)=>s.url===resolved)) return;
        discovered.push(...referenceLinks(page.html,resolved));
        return {title:input.title||text.title,url:resolved,publisher:input.publisher||new URL(resolved).hostname,text:text.text,fetchedAt:Date.now(),kind:input.kind,...("region" in input ? {region:input.region} : {})};
      } catch(e) {failures.push({url:input.url,error:e instanceof Error?e.message:"원문 수집 실패"});}
    }));
    for (const s of results) if (s && !sources.some((x)=>x.url===s.url)) sources.push({id:"S"+(sources.length+1),...s});
    if (batches.length===1) batches.push([...new Set(discovered)].filter((url)=>!seen.has(url)).slice(0,2).map((url)=>({url,title:"",publisher:"",kind:"reference" as const})));
  }
  return {sources,failures,fetchedAt:Date.now()};
}
