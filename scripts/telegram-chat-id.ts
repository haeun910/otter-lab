// 텔레그램 채팅 번호 찾기: 봇에게 아무 말이나 보낸 뒤 실행하세요.
//   TELEGRAM_BOT_TOKEN=... npm run telegram:chat-id
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN을 넣고 실행해 주세요");
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const data = (await res.json()) as { result?: { message?: { chat: { id: number; first_name?: string; title?: string } } }[] };
  const chats = new Map<number, string>();
  for (const u of data.result ?? []) if (u.message) chats.set(u.message.chat.id, u.message.chat.title ?? u.message.chat.first_name ?? "");
  if (!chats.size) return console.log("받은 메시지가 없어요. 텔레그램에서 봇에게 아무 말이나 보낸 뒤 다시 실행해 주세요.");
  for (const [id, name] of chats) console.log(`TELEGRAM_CHAT_ID=${id}   (${name})`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
