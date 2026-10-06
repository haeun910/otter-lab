// 연구원들이 하는 말 (지금 연구소 상황에 맞춰서)
import { byId } from "./data/buildings";
import { useLab } from "./store";

/** 직원을 누르면 하는 말 (지금 연구소 상황에 맞춰서) */
export function staffLine(id: string): string {
  const st = useLab.getState();
  const waiting = st.drafts.filter((d) => d.status === "검토 대기").length;
  if (st.phase === "gathering") return "회의 마당으로 가는 중이에요!";
  if (st.writing.includes(id)) return id === "cards" ? "카드 문구 쓰는 중이에요. 조금만 기다려 주세요!" : "블로그 글 쓰는 중이에요. 금방 끝나요!";
  switch (id) {
    case "me":
      return "오늘도 좋은 소식을 골라 볼까요?";
    case "receiver":
      return `오늘 소식 ${st.inbox.length}개가 들어와 있어요. 회의 때 추천 소식을 골라 갈게요!`;
    case "cards":
      return waiting ? `검토할 카드뉴스가 ${waiting}개 있어요. 작업 모니터에서 봐 주세요!` : "다음 회의에서 주제를 정해 주시면 카드를 만들게요.";
    case "blog":
      return waiting ? "블로그 원고도 같이 써 뒀어요. 원고 책상에 있어요." : "오늘은 어떤 글을 써 볼까요?";
    case "dock":
      return waiting ? `게시를 기다리는 초안이 ${waiting}개예요. 확인해 주시면 우편선 띄울게요!` : "지금은 띄울 우편선이 없어요. 쉬는 중!";
    case "stats": {
      const real = st.posts.filter((p) => !p.sample);
      return real.length
        ? `게시물 ${real.length}개의 반응을 모으고 있어요. 수치를 적어 주시면 분석할게요.`
        : "아직 진짜 게시물이 없어서 예시 수치로 연습 중이에요.";
    }
    case "library":
      return `지금까지 모은 소식이 ${st.library.length.toLocaleString()}건이에요.`;
    case "dorm":
      return "연구원들 이름과 역할은 명부에서 바꿀 수 있어요.";
    default:
      return byId(id).staff?.line ?? "";
  }
}
