// 디스코드 채널 웹후크로 소장님께 알림을 보내요 (봇 없이 웹후크 주소 하나면 돼요).
export interface DiscordNote {
  title: string;
  lines: string[];
  url?: string;
  mention?: string; // 디스코드 사용자 ID: 그 사람을 @멘션해서 알림 설정과 상관없이 울리게
}

const LIMIT = 4000; // 임베드 설명 최대 4096자

export async function sendDiscord(webhookUrl: string, note: DiscordNote) {
  let description = note.lines.join("\n");
  if (description.length > LIMIT) description = `${description.slice(0, LIMIT - 1)}…`;
  const res = await fetch(`${webhookUrl}${webhookUrl.includes("?") ? "&" : "?"}wait=true`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "오터랩",
      ...(note.mention ? { content: `<@${note.mention}>` } : {}),
      embeds: [{ title: note.title, description, color: 0x8ccbff, ...(note.url ? { url: note.url } : {}) }],
      allowed_mentions: { parse: [], users: note.mention ? [note.mention] : [] },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Discord ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
