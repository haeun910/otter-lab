# 오터랩 연결하기

연구소를 인터넷에 올리고, 매일 회의 시간에 연구원들이 알아서 회의하고 초안을 쓰게 만드는 순서예요.
모두 무료 등급으로 돼요. 처음 한 번만 하면 돼요 (30분쯤).

| 순서 | 할 일 | 얻는 것 |
|---|---|---|
| 1 | Groq 키 만들기 | AI가 초안을 써요 |
| 2 | 텔레그램 봇 만들기 | 회의가 끝나면 휴대폰으로 알림이 와요 |
| 3 | Supabase에 표 만들기 | 초안·소식·회의록이 어디서나 같이 보여요 |
| 4 | Vercel에 올리기 | 휴대폰·컴퓨터 어디서나 연구소를 열어요 |
| 5 | GitHub에 비밀값 넣기 | 연구소를 닫아 둬도 매일 자동 회의를 해요 |

> 아래에 나오는 키들은 비밀번호와 같아요. 채팅·이슈·코드에 붙여 넣지 말고, 알려 드리는 설정 칸에만 넣어 주세요.
> 특히 Supabase의 `service_role` 키는 GitHub 비밀값에만 넣어요. Vercel이나 `NEXT_PUBLIC_`으로 시작하는 칸에는 절대 넣지 마세요.

---

## 1. Groq 키

1. <https://console.groq.com> 에 가입하고 로그인해요.
2. 왼쪽 **API Keys** → **Create API Key** → 이름은 `otter-lab`.
3. 나온 키(`gsk_`로 시작)를 메모해 두세요. 창을 닫으면 다시 볼 수 없어요.

모델은 기본으로 `openai/gpt-oss-120b`를 써요. 다른 모델(예: `qwen/qwen3.6-27b`)을 쓰려면 Groq 콘솔의 **Models**에서 이름을 골라 `GROQ_MODEL`에 넣으면 돼요.
Groq는 모델을 종종 은퇴시켜요 (2026년 8월에 Llama 3.3 70B가 없어졌어요). 초안에 '(뼈대)'가 붙고 알림에 `Groq 404`가 보이면 모델 이름을 바꿔 주세요.

## 2. 텔레그램 봇

1. 텔레그램에서 **@BotFather**를 찾아 `/newbot`을 보내요.
2. 봇 이름(예: 오터랩 비서)과 아이디(예: `otterlab_desk_bot`, `bot`으로 끝나야 해요)를 정해요.
3. BotFather가 준 **토큰**(`123456:ABC...`)을 메모해요.
4. 방금 만든 봇과의 대화방을 열고 아무 말이나 한 번 보내요 (예: `안녕`).
5. 채팅 번호 찾기 (둘 중 하나):
   - 브라우저 주소창에 `https://api.telegram.org/bot<토큰>/getUpdates` 를 열고 `"chat":{"id":` 뒤의 숫자를 찾아요.
   - 또는 이 폴더에서 `TELEGRAM_BOT_TOKEN=<토큰> npm run telegram:chat-id`

## 3. Supabase

1. <https://supabase.com/dashboard> → **New project** (지역은 `Northeast Asia (Seoul)`이 가까워요).
2. 왼쪽 **SQL Editor** → **New query** → 이 저장소의 [`supabase/schema.sql`](supabase/schema.sql) 내용을 통째로 붙여 넣어요.
3. 맨 아래 줄의 `'me@example.com'`을 **소장님 이메일**로 바꾸고 **Run**. 이 이메일로 로그인한 사람만 연구소를 열 수 있어요.
4. **Project Settings → API**(또는 **API Keys**)에서 세 가지를 메모해요:
   - Project URL (`https://xxxx.supabase.co`)
   - `anon` `public` 키 (브라우저에 써도 되는 키)
   - `service_role` 키 (비밀! 자동 회의 전용)
5. **Authentication → URL Configuration**
   - Site URL: 4단계에서 받을 Vercel 주소 (나중에 채워도 돼요)
   - Redirect URLs: Vercel 주소와 `http://localhost:3000` 을 추가해요.

로그인은 기본으로 **이메일 로그인 링크**를 써요 (따로 설정할 것 없음).
구글 로그인도 쓰고 싶으면 **Authentication → Providers → Google**을 켜고 구글 클라우드에서 OAuth 클라이언트를 만든 뒤, Vercel 환경변수에 `NEXT_PUBLIC_LOGIN_GOOGLE=1`을 넣어 주세요.

## 4. Vercel

1. <https://vercel.com/new> → GitHub의 `otter-lab` 저장소를 **Import**.
2. **Environment Variables**에 넣어요:

   | 이름 | 값 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase `anon` 키 |
   | `GROQ_API_KEY` | Groq 키 |
   | `GROQ_MODEL` | (선택) 모델 이름 |

3. **Deploy**. 끝나면 `https://otter-lab-xxxx.vercel.app` 같은 주소가 나와요. 이 주소를 Supabase의 Site URL·Redirect URLs에 넣어 주세요 (3-5단계).
4. Vercel은 기본으로 `main` 브랜치를 올려요. 지금 작업은 `1006` 브랜치에 있으니, `main`에 합치거나 Vercel **Settings → Git → Production Branch**를 `1006`으로 바꿔 주세요.

열어 보면 로그인 화면이 나와요. 소장님 이메일을 넣고 메일로 온 링크를 누르면 연구소가 열려요.
처음 로그인하면 그 브라우저에 있던 초안·설정이 Supabase로 올라가요.

## 5. GitHub 자동 회의

저장소 **Settings → Secrets and variables → Actions**에서:

**Secrets** (New repository secret)

| 이름 | 값 |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` 키 |
| `GROQ_API_KEY` | Groq 키 |
| `TELEGRAM_BOT_TOKEN` | 텔레그램 봇 토큰 |
| `TELEGRAM_CHAT_ID` | 텔레그램 채팅 번호 |

**Variables** (Variables 탭)

| 이름 | 값 |
|---|---|
| `LAB_URL` | Vercel 주소 (알림에 링크로 붙어요) |
| `GROQ_MODEL` | (선택) 모델 이름 |

**바로 시험해 보기:** **Actions** 탭 → **daily-meeting** → **Run workflow** → "회의 시간과 상관없이 지금 회의하기" 체크 → 실행.
1~2분 뒤 텔레그램 알림이 오고, 연구소를 열면 회의록 칠판과 공방에 새 초안이 있어요.

**매일 자동으로:** GitHub는 예약 실행을 저장소의 **기본 브랜치(main)** 에서만 해요. `1006` 브랜치를 `main`에 합치면 그때부터 매시간 깨어나서, 회의 시간(회의록 칠판에서 정한 시간, 한 시간 안쪽 오차)이 지났고 오늘 회의를 아직 안 했으면 회의를 해요.

---

## 어떻게 돌아가나요

```
매시 7분   GitHub Actions 깨어남 (scripts/daily.ts)
           ├─ 회의 시간 전이거나 오늘 이미 했으면 → 그냥 끝
           ├─ 루미: 피드 9곳에서 소식 받기 → Supabase에 쌓기
           ├─ 루미: 아직 안 쓴 소식 중 묶음 5개 + 심층 1개 추천
           ├─ 모모·테오: Groq로 카드뉴스·블로그 초안 (안 되면 뼈대 초안)
           ├─ 회의록 남기기 (소장 부재, 자동 회의)
           └─ 텔레그램으로 "회의 끝, 초안 N개" 알림

소장님      알림을 보고 연구소를 열어요 → 공방에서 고치기 → 우편선으로 게시
           연구소를 열어 둔 채로 회의 시간이 되면, 연구원들이 회의실에 모여 소장님이 직접 골라요
```

## 자주 막히는 곳

- **로그인 링크를 눌렀는데 다시 로그인 화면이에요** → Supabase Redirect URLs에 지금 주소가 들어 있는지 확인해 주세요.
- **"이 계정은 연구소의 주인으로 등록돼 있지 않아요"** → `schema.sql` 마지막 줄 이메일과 로그인한 이메일이 같은지 확인해 주세요. SQL Editor에서 `select * from lab_owner;`로 볼 수 있어요.
- **로그인 메일이 안 와요** → Supabase 기본 메일은 한 시간에 몇 통으로 제한돼 있어요. 스팸함을 보고, 잠시 뒤 다시 해 주세요.
- **자동 회의가 안 돌아요** → Actions 탭의 실행 기록에서 빨간 줄을 눌러 보면 이유가 한국어로 나와요 (예: `SUPABASE_SERVICE_ROLE_KEY 환경변수가 없어요`).
- **초안에 (뼈대)가 붙어요** → `GROQ_API_KEY`가 비었거나 Groq 사용량을 넘었어요. 알림의 '참고' 줄에 이유가 적혀 있어요.
