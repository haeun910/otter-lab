# 오터랩 연결하기

연구소를 인터넷에 올리고, 매일 회의 시간에 연구원들이 주제 후보를 준비하고 소장의 확인을 기다리게 만드는 순서예요.
모두 무료 등급으로 돼요. 처음 한 번만 하면 돼요 (30분쯤).

| 순서 | 할 일 | 얻는 것 |
|---|---|---|
| 1 | Groq 키 만들기 | AI가 초안을 써요 |
| 2 | 디스코드 웹후크 (또는 텔레그램 봇) | 회의가 끝나면 휴대폰으로 알림이 와요 |
| 3 | Supabase에 표 만들기 | 초안·소식·회의록이 어디서나 같이 보여요 |
| 4 | Vercel에 올리기 | 휴대폰·컴퓨터 어디서나 연구소를 열어요 |
| 5 | GitHub에 비밀값 넣기 | 연구소를 닫아 둬도 매일 자동 회의를 해요 |

> 아래에 나오는 키들은 비밀번호와 같아요. 채팅·이슈·코드에 붙여 넣지 말고, 알려 드리는 설정 칸에만 넣어 주세요.
> 특히 Supabase의 secret 키(`sb_secret_...`, 예전 이름 `service_role`)는 GitHub 비밀값에만 넣어요. Vercel이나 `NEXT_PUBLIC_`으로 시작하는 칸에는 절대 넣지 마세요.

---

## 1. Groq 키

1. <https://console.groq.com> 에 가입하고 로그인해요.
2. 왼쪽 **API Keys** → **Create API Key** → 이름은 `otter-lab`.
3. 나온 키(`gsk_`로 시작)를 메모해 두세요. 창을 닫으면 다시 볼 수 없어요.

모델은 기본으로 `openai/gpt-oss-120b`를 써요. 다른 모델(예: `qwen/qwen3.6-27b`)을 쓰려면 Groq 콘솔의 **Models**에서 이름을 골라 `GROQ_MODEL`에 넣으면 돼요.
Groq는 모델을 종종 은퇴시켜요 (2026년 8월에 Llama 3.3 70B가 없어졌어요). 초안에 '(뼈대)'가 붙고 알림에 `Groq 404`가 보이면 모델 이름을 바꿔 주세요.

## 2. 알림 받을 곳

디스코드와 텔레그램 중 편한 쪽 하나만 하면 돼요. 둘 다 해도 돼요.

### 디스코드 (더 간단해요)

1. 디스코드에서 알림을 받을 서버를 정해요. 혼자 쓰는 서버를 하나 만들어도 좋아요 (왼쪽 **+** → **직접 만들기**).
2. 알림 받을 채널 옆 톱니바퀴(**채널 편집**) → **연동** → **웹후크** → **새 웹후크**.
3. 이름을 `오터랩`으로 바꾸고 **웹후크 URL 복사**. 이 주소(`https://discord.com/api/webhooks/...`)를 메모해요.

> 웹후크 주소를 아는 사람은 누구나 그 채널에 글을 올릴 수 있어요. GitHub 비밀값에만 넣어 주세요.

**휴대폰 알림이 안 울리면** (메시지는 채널에 와 있는데 알림만 없을 때)
- 디스코드는 컴퓨터에서 디스코드를 켜 두고 있으면 휴대폰 알림을 보내지 않아요.
- 서버 아이콘 길게 누르기(또는 오른쪽 클릭) → **알림 설정** → **모든 메시지**로 바꿔요.
- 그래도 안 울리면 **@멘션**을 켜세요. 멘션은 알림 설정과 상관없이 울려요:
  1. 디스코드 **사용자 설정 → 고급 → 개발자 모드** 켜기
  2. 내 프로필(이름) 오른쪽 클릭 또는 길게 누르기 → **사용자 ID 복사** (숫자 18~19자리)
  3. GitHub **Variables**에 `DISCORD_MENTION_USER_ID` = 그 숫자

### 텔레그램

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
4. **주소 하나와 키 두 개를 메모해요.** 메모장을 열어 두고 하나씩 복사해 붙여 두세요.

   **① 프로젝트 주소 (Project URL)**
   - 프로젝트 첫 화면 맨 위의 **Connect** 버튼을 누르면 `https://abcdefgh.supabase.co` 처럼 생긴 주소가 보여요.
   - (Connect 버튼이 안 보이면) 왼쪽 아래 톱니바퀴 **Project Settings → Data API**에도 있어요.

   **② publishable 키 (공개해도 되는 키)**
   - 왼쪽 아래 톱니바퀴 **Project Settings → API Keys**로 가요.
   - 위쪽 탭 중 **Publishable and secret API keys**를 골라요.
   - **Publishable key** 칸의 `sb_publishable_...` 로 시작하는 값을 복사해요.

   **③ secret 키 (비밀 키, 자동 회의 전용)**
   - 같은 화면 아래 **Secret keys** 칸에서 눈 모양(보기) 또는 복사 버튼을 눌러 `sb_secret_...` 로 시작하는 값을 복사해요.
   - 이 키는 데이터베이스를 마음대로 고칠 수 있는 열쇠예요. **GitHub 비밀값(5단계)에만** 넣고, 다른 곳에는 붙여 넣지 마세요.

   > 예전에 만든 프로젝트라 **Legacy API Keys** 탭만 있으면, ② 대신 `anon` 키, ③ 대신 `service_role` 키를 써도 돼요 (둘 다 `eyJ`로 시작해요).

   어디에 넣는지 미리 보면:

   | 메모한 것 | Vercel (4단계) | GitHub 비밀값 (5단계) |
   |---|---|---|
   | ① 프로젝트 주소 | `NEXT_PUBLIC_SUPABASE_URL` | `SUPABASE_URL` |
   | ② publishable 키 | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 넣지 않아요 |
   | ③ secret 키 | **넣지 마세요** | `SUPABASE_SECRET_KEY` |
5. **Authentication → URL Configuration**
   - Site URL: 4단계에서 받을 Vercel 주소 (나중에 채워도 돼요)
   - Redirect URLs: Vercel 주소와 `http://localhost:3000` 을 추가해요.

6. **비밀번호 만들기** (이메일 + 비밀번호로 바로 로그인하려면)
   - 왼쪽 **Authentication → Users**
   - 내 이메일이 이미 목록에 있으면(메일 링크를 받아 본 적이 있으면) 그 줄 오른쪽 **⋯ → Delete user**로 지워요. 연구소 데이터는 지워지지 않아요.
   - 오른쪽 위 **Add user → Create new user**
   - Email: 소장님 이메일 / Password: 쓸 비밀번호 / **Auto Confirm User 체크** → **Create user**
   - 이제 연구소에서 이메일과 비밀번호로 바로 로그인돼요. 한 번 로그인한 브라우저는 계속 로그인돼 있어요.
   - 나중에 비밀번호를 바꾸려면 연구소 **소장실 → 소장 책상**에서 바꿀 수 있어요.

비밀번호 대신 **메일 로그인 링크**로 들어갈 수도 있어요 (로그인 화면의 "비밀번호 없이 메일 링크로 로그인").
구글 로그인도 쓰고 싶으면 **Authentication → Providers → Google**을 켜고 구글 클라우드에서 OAuth 클라이언트를 만든 뒤, Vercel 환경변수에 `NEXT_PUBLIC_LOGIN_GOOGLE=1`을 넣어 주세요.

## 4. Vercel

1. <https://vercel.com/new> → GitHub의 `otter-lab` 저장소를 **Import**.
2. **Environment Variables**에 넣어요:

   | 이름 | 값 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ① 프로젝트 주소 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ② publishable 키 (예전 프로젝트면 이름을 `NEXT_PUBLIC_SUPABASE_ANON_KEY`로 하고 anon 키) |
   | `GROQ_API_KEY` | Groq 키 |
   | `GROQ_MODEL` | (선택) 모델 이름. 비워 두면 `openai/gpt-oss-120b`. 넣을 때는 `openai/`, `qwen/` 같은 앞부분까지 통째로 |
   | `OPENAI_API_KEY` | 카드 전체 이미지 생성용 서버 키 (문구·도식·일러스트를 함께 생성) |
   | `OPENAI_IMAGE_MODEL` | (선택) 기본 `gpt-image-1` |
   | `OPENAI_IMAGE_QUALITY` | (선택) `low`, `medium`, `high` 중 하나. 기본 `high` |

3. **Deploy**. 끝나면 `https://otter-lab-xxxx.vercel.app` 같은 주소가 나와요. 이 주소를 Supabase의 Site URL·Redirect URLs에 넣어 주세요 (3-5단계).
4. Vercel은 저장소의 **기본 브랜치**를 실제 서비스로 올려요. 5단계 맨 앞의 "기본 브랜치 바꾸기"를 먼저 하거나, Vercel **Settings → Git → Production Branch**를 `main`으로 바꾼 뒤 **Deployments → ⋯ → Redeploy** 해 주세요.

열어 보면 로그인 화면이 나와요. 소장님 이메일을 넣고 메일로 온 링크를 누르면 연구소가 열려요.
처음 로그인하면 그 브라우저에 있던 초안·설정이 Supabase로 올라가요.

## 5. GitHub 자동 회의

**먼저 기본 브랜치 바꾸기 (한 번만)**
GitHub는 저장소의 **기본 브랜치**에 있는 워크플로만 Actions 목록에 보여 주고 예약 실행해요.
저장소 **Settings → General → Default branch** 오른쪽 ⇄ 버튼 → `main` → **Update**.
(그다음 예전 브랜치 `claude/multi-agent-automation-lab-vr8s45`는 **Branches** 화면에서 지워도 돼요.)

그리고 저장소 **Settings → Secrets and variables → Actions**에서:

**Secrets** (New repository secret)

| 이름 | 값 |
|---|---|
| `SUPABASE_URL` | ① 프로젝트 주소 |
| `SUPABASE_SECRET_KEY` | ③ secret 키 (예전 프로젝트면 service_role 키) |
| `GROQ_API_KEY` | Groq 키 |
| `DISCORD_WEBHOOK_URL` | 디스코드 웹후크 주소 (디스코드를 쓸 때) |
| `TELEGRAM_BOT_TOKEN` | 텔레그램 봇 토큰 (텔레그램을 쓸 때) |
| `TELEGRAM_CHAT_ID` | 텔레그램 채팅 번호 (텔레그램을 쓸 때) |

**Variables** (Variables 탭)

| 이름 | 값 |
|---|---|
| `LAB_URL` | Vercel 주소 (알림에 링크로 붙어요) |
| `GROQ_MODEL` | (선택) 모델 이름. 비워 두면 `openai/gpt-oss-120b`. 넣을 때는 `openai/`, `qwen/` 같은 앞부분까지 통째로 |
| `DISCORD_MENTION_USER_ID` | (선택) 디스코드 내 사용자 ID. 넣으면 알림에 @멘션이 붙어 휴대폰이 확실히 울려요 |

**바로 시험해 보기:** 저장소 위쪽 **Actions** 탭 (처음이면 "I understand my workflows, go ahead and enable them") → 왼쪽 **daily-meeting** → 오른쪽 **Run workflow ▾** → Branch `main`, "회의 시간과 상관없이 지금 회의하기" 체크 → 초록 **Run workflow**.
실패(빨간 X)하면 그 실행 → **meeting** → **Run npm run daily**를 펼쳐 마지막 줄을 보면 이유가 적혀 있어요.
1~2분 뒤 디스코드(또는 텔레그램) 알림이 오고, 연구소를 열면 회의록과 수신소에 검토할 주제 후보가 있어요. 주제를 확정한 뒤 자료 조사와 구성안 검토를 거쳐 카드뉴스를 제작합니다.

**매일 자동으로:** 기본 브랜치를 `main`으로 바꿨으면 그때부터 매시간 깨어나서, 회의 시간(회의록 칠판에서 정한 시간, 한 시간 안쪽 오차)이 지났고 오늘 회의를 아직 안 했으면 회의를 해요.

---

## 어떻게 돌아가나요

```
매시 7분   GitHub Actions 깨어남 (scripts/daily.ts)
           ├─ 회의 시간 전이거나 오늘 이미 했으면 → 그냥 끝
           ├─ 루미: 피드에서 소식 받기 → Supabase에 쌓기
           ├─ 루미: 아직 다루지 않은 뉴스 최대 2개에서 주제 후보 준비
           ├─ 주제·조사 프로젝트 저장 (Groq 실패 시 검토 대기 + 오류)
           ├─ 회의록 남기기 (소장 부재, 자동 회의)
           └─ 디스코드·텔레그램으로 "회의 끝, 주제 검토 N개" 알림

소장님      수신소에서 주제 확정 → 관련 자료 조사·분석 → 7장 구성안 확정
           → 카드뉴스 제작 → 공방에서 고치기 → 우편선으로 게시
           연구소를 열어 둔 채로 회의 시간이 되면, 연구원들이 회의실에 모여 소장님이 직접 골라요
```

## 자주 막히는 곳

- **로그인 링크를 눌렀는데 다시 로그인 화면이에요** → Supabase Redirect URLs에 지금 주소가 들어 있는지 확인해 주세요.
- **"이 계정은 연구소의 주인으로 등록돼 있지 않아요"** → `schema.sql` 마지막 줄 이메일과 로그인한 이메일이 같은지 확인해 주세요. SQL Editor에서 `select * from lab_owner;`로 볼 수 있어요.
- **로그인 메일이 안 와요** → Supabase 기본 메일은 한 시간에 몇 통으로 제한돼 있어요. 스팸함을 보고, 잠시 뒤 다시 해 주세요.
- **자동 회의가 안 돌아요** → Actions 탭의 실행 기록에서 빨간 줄을 눌러 보면 이유가 한국어로 나와요 (예: `SUPABASE_SECRET_KEY 환경변수가 없어요`).
- **주제 제안·분석·카드 제작이 실패해요** → `GROQ_API_KEY`와 사용량을 확인하고 해당 단계만 재시도하세요. 이미 읽은 자료와 검증을 마친 구간별 분석은 보존합니다. 카드 작성 후 내용 검수 호출이 추가되며, 보완이 필요한 경우 해당 카드 수정과 재검수를 각각 한 번 진행합니다. 검수 실패는 이전 초안을 덮어쓰지 않습니다.
- **조사 자료가 부족해요** → 읽을 수 있는 서로 다른 HTML·텍스트 자료 2개 이상이 필요합니다. 수신소에서 공식 문서나 관련 기사 링크를 추가하세요. 조사 프로젝트는 기존 `lab_data`의 `setting/projects`에 저장되므로 새 테이블은 필요하지 않습니다.

## 승인한 카드 이미지 제작 방식

코드·프롬프트·설정은 [카드뉴스 제작 규칙](docs/card-production.md)에 등록했습니다. 배포 서버의 `OPENAI_API_KEY`를 추가하고 재배포하면 인쇄기에서 전체 카드 이미지를 생성할 수 있습니다. Groq 연결은 문구 작성과 검수에 사용하고, 이 이미지 키는 별도로 필요합니다. 이미지 생성에는 API 요금이 발생하며 소장이 버튼을 눌렀을 때만 요청합니다. 생성한 PNG 원본은 해당 브라우저에 보관하므로 파일로 내려받아 보관하세요.
