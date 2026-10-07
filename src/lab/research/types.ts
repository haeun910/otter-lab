import type { Card, NewsItem } from "../data/demo";
export interface Topic {
  title: string;
  focus: string;
  questions: string[];
  seedLinks: string[];
}
export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  text: string;
  fetchedAt: number;
  kind: "news" | "reference";
  region?: NewsItem["region"];
}
export interface Evidence { sourceId: string; quote: string }
export interface ResearchFact { id: string; text: string; detail?: string; kind: "fact" | "background"; evidence: Evidence[] }
export interface ResearchReport { summary: string; facts: ResearchFact[]; gaps: string[] }
export interface AnalysisCheckpoint { key: string; parts: {summary:string;facts:ResearchFact[];gaps:string[]}[] }
export interface PlannedCard {
  kind: Card["kind"];
  title: string;
  point: string;
  factIds: string[];
}
export interface ApprovedResearch {
  topic: Topic;
  sources: ResearchSource[];
  report: ResearchReport;
  outline: PlannedCard[];
  approvedAt: number;
}
export interface TopicProject {
  id: string;
  createdAt: number;
  stage: "topic" | "research" | "outline" | "generated";
  seeds: NewsItem[];
  proposals: Topic[];
  topic?: Topic;
  extraLinks: string[];
  sources: ResearchSource[];
  failures: { url: string; error: string }[];
  report?: ResearchReport;
  analysis?: AnalysisCheckpoint;
  outline: PlannedCard[];
  error?: string;
  draftId?: string;
}
export function newTopicProject(seeds: NewsItem[], now = Date.now()): TopicProject {
  return { id: "topic-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 7), createdAt: now, stage: "topic", seeds, proposals: [], extraLinks: [], sources: [], failures: [], outline: [] };
}
