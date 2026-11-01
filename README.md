# Public Data AI

건강보험심사평가원(HIRA)·법제처 등 공공 API를 자연어로 검색·가공하는
**로컬 SLM 기반 Electron 데스크톱 에이전트**.

> 전체 설계 배경과 근거는 [`docs/technical_plan.md`](docs/technical_plan.md)
> (기술기획서)를 참고한다. 이 README는 실제 저장소를 실행/개발하는 방법을 다룬다.

## 핵심 아이디어

```text
자연어 → Local SLM(3~5B) → Query DSL → Schema Validator → Tool Router
   → API Connector → 공공 API → Data Processor(filter/sort/group/aggregate)
   → 표/그래프/엑셀 + Local SLM의 자연어 설명
```

LLM은 데이터를 직접 판단하거나 임의로 API를 호출하지 않는다. 오직 "어떤
데이터를 어떻게 가져올지"를 나타내는 **Query DSL**을 생성할 뿐이고, 실제
조회·필터링·집계는 검증된 프로그램 코드가 담당한다 (`docs/architecture/overview.md` 참고).

## 저장소 구조

```text
public-data-ai/
├─ install.bat         # Windows: 처음 설치할 때 한 번 실행 (npm install + 빌드)
├─ run.bat             # Windows: 설치 후 프로그램 실행
├─ apps/desktop/       # Electron 앱 (main / preload / renderer)
├─ core/               # LLM 연동, Query Planner, Tool Router, 캐시, 대화 저장, 데이터 가공
├─ connectors/         # HIRA, 법제처 등 실제 API Connector
├─ data/               # 코드 매핑 사전, 정규화 스키마
├─ scripts/            # build-installer.bat 등 배포용 보조 스크립트
├─ tests/              # Vitest 단위 테스트
└─ docs/               # 아키텍처/API/라이선스 문서, 기술기획서
```

## 사전 요구 사항

- Node.js 18 이상 — [nodejs.org](https://nodejs.org)에서 설치.
  대화·캐시 저장에는 [sql.js](https://sql.js.org)(WebAssembly로 컴파일된 SQLite)를
  쓰기 때문에 네이티브 애드온 컴파일이나 별도 빌드 도구 없이 `npm install`만으로 동작하고,
  Electron이 내장한 Node 버전과도 무관하게 항상 동일하게 동작한다.
- (선택) 3~5B급 **GGUF 모델 파일** — 앱을 실행한 뒤 사이드바에서 파일을
  선택하기만 하면 된다 (아래 "로컬 SLM(GGUF) 사용하기" 참고). 모델을
  올리지 않아도 규칙 기반 폴백 SLM으로 파이프라인 전체를 그대로 개발/테스트할 수 있다.
- 공공데이터포털에서 발급받은 HIRA 서비스키, 법제처 오픈API 이용자 ID(OC)

## 로컬 SLM(GGUF) 사용하기

이 앱은 [node-llama-cpp](https://github.com/withcatai/node-llama-cpp)를 통해
GGUF 모델을 **Electron 프로세스 안에서 직접** 구동한다. 별도의 llama.cpp
서버를 띄우거나 포트를 설정할 필요가 없다.

1. 앱을 실행하면 사이드바 아래쪽에 **"로컬 SLM (GGUF)"** 패널이 보인다.
2. **GGUF 모델 업로드** 버튼을 눌러 `.gguf` 파일을 선택한다.
   - [Hugging Face](https://huggingface.co/models?library=gguf)에서
     3~5B급 한국어 지원 모델(GGUF 포맷)을 미리 받아두면 된다
     (기술기획서 17~18장의 모델 선정 기준 참고).
3. 로딩 진행률이 진행바로 표시되고, 완료되면 초록색 체크와 함께 모델 이름이
   표시된다. 이후 질문부터 바로 이 모델이 자연어 → Query DSL 변환에 쓰인다.
4. 마지막으로 로드한 모델 경로는 자동 저장되어, 다음에 앱을 실행하면
   다시 자동으로 불러온다. **모델 해제** 버튼으로 언제든 내릴 수 있다.

모델을 올리지 않았거나 로드에 실패하면 자동으로 규칙 기반 폴백(또는
`LLAMA_SERVER_URL`에 별도 llama.cpp 서버를 띄워둔 경우 그 서버)으로
전환되므로 앱 자체가 멈추지는 않는다.

> **참고**: GGUF 모델 파일과 node-llama-cpp의 플랫폼별 바이너리는 용량이
> 크다(수백 MB~수 GB). 첫 `npm install`/`install.bat` 실행 시 인터넷
> 상황에 따라 시간이 걸릴 수 있다.

## Windows에서 압축파일로 다운받아 설치하기 (Git/CLI 지식 불필요)

1. GitHub 저장소 페이지 → **Code → Download ZIP**으로 소스를 내려받는다.
2. 원하는 폴더에 압축을 푼다.
3. **`install.bat`을 더블클릭**한다.
   - Node.js 설치 여부를 확인하고, 없으면 설치 안내 후 종료한다.
   - `npm install`로 의존성을 설치한다.
   - `.env.example`을 복사해 `.env`를 만든다.
   - 앱을 빌드한다 (`dist/` 생성).
4. **`run.bat`을 더블클릭**하면 Electron 창이 뜨며 프로그램이 시작된다.
   이후에는 `install.bat`을 다시 실행할 필요 없이 `run.bat`만 실행하면 된다.
5. 앱이 뜨면 사이드바의 **"API 키 설정"** 버튼을 눌러 별도의 설정 화면을 연다.
   맨 위 **"빠른 등록"** 칸에 발급받은 키를 아무거나 붙여넣고 **자동 등록**을
   누르면, 값의 생김새(길이·문자 구성)를 보고 HIRA 서비스키인지 법제처
   인증키(OC)인지 자동으로 구분해서 알맞은 칸에 채워 준다 — 어느 쪽인지
   애매한 값이면 추측하지 않고 "HIRA로 등록/법제처로 등록" 중 직접 고르게
   보여준다. 물론 아래 두 칸에 `HIRA_SERVICE_KEY`, `LAW_API_OC`를 각각 직접
   입력해도 된다. 값을 채운 뒤 **저장**을 누른다. `.env` 파일을 메모장으로
   직접 열 필요 없이 화면에서 바로 등록할 수 있고, 앱을 재시작하지 않아도
   다음 질문부터 바로 반영된다. 값은 사용자 PC의 `userData\app-settings.json`
   에만 저장되며 외부로 전송되지 않는다.
   (`.env`에 값을 넣어두면 설정 화면에서 아무것도 입력하지 않았을 때 기본값
   으로 계속 쓰인다 — 두 방식을 함께 쓸 필요는 없다.)

`install.bat`/`run.bat`은 더블클릭 시 자기 자신을 새 콘솔 창으로 다시 실행하고,
성공/실패 어느 경로든 마지막에 "아무 키나 누르면 닫힙니다"로 멈춘다 — 그래서
로그를 다 읽은 뒤 **키를 누르면 창이 자동으로 닫힌다**. 아무 키도 누르지 않으면
당연히 계속 떠 있다. 그래도 안내와 다르게 동작한다면:

- 탐색기 압축 해제 화면(ZIP 미리보기)에서 바로 실행한 것은 아닌지 확인하고,
  반드시 "압축 풀기"로 완전히 해제한 폴더에서 실행한다.
- Windows가 "PC 보호" 경고를 띄우면 **추가 정보 → 실행**을 눌러야 스크립트가
  진행된다.
- 그래도 원인을 알 수 없다면 `Win+R` → `cmd` → 압축 푼 폴더로 `cd` 이동 →
  `install.bat` 을 직접 입력해 실행하면, 창이 사용자가 직접 연 것이라 어떤
  경우에도 닫히지 않고 전체 로그를 확인할 수 있다.
- `run.bat` 실행 시 `Electron failed to install correctly`(또는
  `node_modules\electron\dist\electron.exe is missing`) 오류가 뜨면, 이 앱의
  코드 문제가 아니라 `npm install` 도중 **Electron이 자기 실행파일을
  GitHub에서 내려받는 데 실패**한 것이다(백신/사내 방화벽/VPN이 흔한
  원인). `install.bat`을 다시 실행하면 이 다운로드를 자동으로 한 번 더
  시도하고, 그래도 안 되면 백신·VPN을 잠시 끄고 다시 시도하거나
  `node_modules` 폴더를 통째로 지우고 `install.bat`부터 다시 실행한다.

`install.bat`/`run.bat`/`scripts\build-installer.bat`은 의도적으로 **순수
ASCII, 영어 안내문만** 쓴다 — 앱 자체는 계속 한글이지만, 배치파일에 한글을
섞고 `chcp 65001`에 기대는 방식은 이 프로젝트에서 실제로 두 번 실행을
깨뜨린 전력이 있다(코드페이지를 잘못 해석해 단어 하나하나가 "내부 명령이
아닙니다" 오류로 이어짐). `npm run check:bat-ascii`가 이 규칙을 CI에서
계속 검사한다. 재설치 시 이전 실행이 비정상 종료해 백그라운드에 남은
프로세스가 파일을 잠그는 문제도 `install.bat`이 시작할 때
`scripts\stop-app.ps1`로(이 프로젝트 폴더를 가리키는 프로세스만 골라)
정리한다. 또한 앱 자체에도 `app.requestSingleInstanceLock()`을 걸어 두 개를
동시에 띄우는 것 자체를 막는다 — sql.js는 실제 SQLite 파일과 달리 여러
프로세스가 동시에 써도 막아주지 않아서, 두 인스턴스가 동시에 뜨면 나중에
저장한 쪽이 앞선 대화 기록을 조용히 덮어쓸 수 있기 때문이다.

> 배포용 단일 설치 프로그램(.exe 인스톨러)이 필요하다면
> `scripts\build-installer.bat`을 실행한다. `electron-builder`로 NSIS
> 인스톨러를 만들어 `release\` 폴더에 생성한다 (배포 대상 PC에는 Node.js가
> 필요 없다).

## 소스에서 직접 개발하기 (git 사용)

```bash
git clone https://github.com/Fullbatting/AI-Law-Agent.git
cd AI-Law-Agent
npm install
cp .env.example .env   # HIRA_SERVICE_KEY, LAW_API_OC 등을 채워 넣는다
```

### 개발 실행 (Electron)

```bash
npm start          # build 후 Electron 창을 띄운다
```

사이드바에서 GGUF 모델을 업로드하지 않았고, `LLAMA_SERVER_URL`(기본
`http://127.0.0.1:8080`)에 별도 llama.cpp 서버도 떠 있지 않으면
`core/llm/inference/ruleBasedFallback.ts`의 규칙 기반 폴백이 자동으로
대신 동작한다 (개발/데모용).

### 타입 체크 / 테스트

```bash
npm run typecheck
npm test
```

조인 및 Tool Router 회귀 테스트만 실행하려면:

```bash
npm test -- tests/dataProcessing/join.test.ts tests/dataProcessing/pipeline.test.ts tests/tools/router.test.ts
```

위 테스트의 Router는 가짜 Connector를 사용하므로 외부 API를 호출하지 않는다.
조인 DSL과 결과 규칙은 [조인 안내](docs/api/join.md)를 참고한다.

### 배포 패키지 빌드

```bash
npm run package:win     # Windows NSIS 인스톨러
npm run package:mac     # macOS DMG
npm run package:linux   # Linux AppImage
```

결과물은 `release/` 폴더에 생성된다. Windows에서는 `scripts\build-installer.bat`
더블클릭으로 동일한 작업(`npm run package:win`)을 수행할 수 있다.

## API 키 설정 (앱 내 화면)

사이드바의 **"API 키 설정"** 버튼을 누르면 별도의 설정 화면(모달)이 뜬다.
`HIRA_SERVICE_KEY`, `LAW_API_OC`를 입력하고 저장하면 `userData/app-settings.json`
에 저장되고, Connector들이 요청마다 이 값을 다시 읽으므로 앱을 재시작하지
않아도 바로 적용된다 (`core/settings/settingsManager.ts`,
`core/tools/registry.ts` 참고). 설정 화면에 값을 넣지 않았다면 아래 환경
변수(`.env`)를 대신 사용한다.

### 붙여넣은 키가 어느 서비스 것인지 자동으로 알 수 있나?

키 값 자체에 "이건 HIRA 것"이라는 표시가 박혀 있는 건 아니다 — 두 값 모두
그냥 발급된 문자열일 뿐이다. 다만 실제 생김새가 뚜렷하게 달라서
(`core/settings/detectApiKeyKind.ts`) 꽤 신뢰성 있게 구분할 수 있다:

- **HIRA 서비스키**: 공공데이터포털이 발급하는 값이라 매우 길다(80자 이상)
  + base64/URL 인코딩 문자(`A-Z a-z 0-9 + / = %`)로 구성된다.
- **법제처 OC**: 신청 시 등록한 이메일의 아이디 부분이라 사람이 고른 짧은
  문자열(보통 24자 이하, 영문/숫자/`.`/`-`/`_`)이다. 이메일 전체를
  붙여넣어도 `@` 앞부분만 잘라 쓴다.

설정 화면의 "빠른 등록" 칸이 이 규칙으로 자동 분류하고, 어느 쪽에도
뚜렷하게 들어맞지 않으면 추측하지 않고 "HIRA로 등록 / 법제처로 등록" 버튼을
보여줘 사용자가 직접 고르게 한다.

## API 등록 — HIRA/법제처 외에 거의 모든 API

"API 키 설정" 화면 아래쪽 **"API 등록"** 섹션에서 HIRA/법제처처럼 코드로
미리 만들어두지 않은 API도 등록해 쓸 수 있다. GET/POST, 쿼리·헤더·Bearer
인증, 추가 헤더, POST 본문까지 지원해서 코드 수정 없이 대부분의 REST API를
등록할 수 있는 것이 목표다. 등록할 때 입력하는 항목:

| 항목 | 설명 |
|---|---|
| 서비스 이름 * | 화면 표시 + 자동 라우팅(아래 참고)에 쓰인다 |
| 설명 | 이 API가 무엇을 조회하는지 — 구체적으로 적을수록 자동 라우팅이 정확해진다 |
| **이런 질문이 오면 이 API로** (예시 질문) | 이 API가 답해야 할 자연어 질문 예시를 한 줄에 하나씩. **인식 정확도를 가장 크게 높여주는 항목** — 아래 참고 |
| Base URL * | 요청을 보낼 기본 엔드포인트 |
| 키를 발급받은 곳 URL | 참고용(어디서 이 키를 받았는지 기록만, 요청에는 안 쓰임) |
| 요청 방식 | GET(기본) / POST — 검색을 POST로만 지원하는 API도 등록 가능 |
| 인증 방식 | 쿼리 파라미터 / HTTP 헤더 / Bearer 토큰 / 인증 없음 |
| 인증 파라미터·헤더 이름 | 예: `serviceKey`, `X-API-Key` |
| 인증 키 값 | 실제 발급받은 키 |
| 검색어 파라미터 이름 | 사용자의 검색어를 실어 보낼 쿼리 파라미터 이름(선택, 비워두면 검색어 없이 고정 파라미터로만 호출) |
| POST 요청 본문 | 요청 방식이 POST일 때 보낼 JSON. `{{query}}` 자리에 검색어가 안전하게 치환됨. 예: `{"keyword": "{{query}}"}` |
| 고정 쿼리 파라미터 | 항상 붙일 값. `dataType=JSON&numOfRows=20` 형식 |
| 추가 헤더 | 인증 헤더 외에 더 필요한 헤더. 한 줄에 하나, `Key: Value` 형식 |

등록 즉시(앱 재시작 없이) 다음 질문부터 쓸 수 있다. 지원 범위는 "검색어
하나 + 고정 파라미터/헤더/본문"으로 호출하고, 응답 JSON에서 배열처럼
보이는 부분을 찾아 표로 보여주는 수준의 범용 Connector
(`connectors/generic/customApiConnector.ts`)라서, HIRA/법제처 Connector처럼
필드별로 깔끔하게 정리되진 않는다.

### 질문마다 어떤 API로 답을 구할지: 자동 분류 vs 직접 지정

두 방식 중 **자동 분류(1)가 가능해서 그 방식으로 구현했고, 직접 지정(2)은
그 안에 자연스럽게 포함**된다 — 질문에 등록해둔 서비스 이름을 그대로
말하면 그게 곧 "직접 지정"이 된다. 그리고 **"인식을 위한 추가 정보"로
예시 질문(exampleQuestions)을 요청**해, 이름/설명만으로는 부족한 인식
정확도를 보강한다.

- **GGUF 모델을 올려서 쓰는 경우**: 등록된 모든 API(HIRA/법제처 + 등록한
  API)의 이름·설명·예시 질문이 모델의 시스템 프롬프트에 그대로 나열되므로
  (`core/tools/registry.ts`의 `describeForPrompt()`), 모델이 질문을 읽고
  어느 API를 쓸지 직접 판단한다. 가장 정확한 방식이다.
- **모델을 안 올리고 규칙 기반 폴백으로 쓰는 경우**
  (`core/llm/inference/ruleBasedFallback.ts`)도 실제 언어 이해 없이 나름의
  규칙으로 자동 분류를 시도한다:
  1. 질문에 등록한 API 이름이 그대로 들어있으면 그 API로 확정한다(=직접 지정).
  2. "법령/법률/조문" 등 키워드가 있으면 법제처로 보낸다.
  3. 그 외엔 등록한 API의 이름+설명(+예시 질문, **가중치 2배**)과 질문의
     단어 겹침 점수가 2점 이상이면 그 API로 보낸다. 뚜렷하게 겹치는 게
     없으면 잘못 추측하는 대신 기존 기본값(병원 검색)으로 처리한다.

즉 "질문에 서비스 이름을 넣으면 확실하게 그 API로, 안 넣어도 예시 질문과
비슷하게 물어보면 어느 정도는 알아서" 동작한다. 애매한 질문을 항상
정확히 분류해주진 않으므로, API를 자주 쓸 계획이면 **예시 질문을 실제로
사용자가 물어볼 법한 문장 그대로 여러 개 적어두는 것**이 가장 효과적이고,
질문에 서비스 이름을 직접 넣어주는 것도 확실한 방법이다.

## 환경 변수 (`.env`)

| 변수 | 설명 |
|---|---|
| `HIRA_SERVICE_KEY` | 공공데이터포털 HIRA 병원정보서비스 서비스키 (설정 화면에 값이 없을 때의 기본값) |
| `LAW_API_OC` | 법제처 국가법령정보 오픈API 이용자 이메일 ID (설정 화면에 값이 없을 때의 기본값) |
| `LLAMA_SERVER_URL` | llama.cpp `llama-server` 엔드포인트 (기본 `http://127.0.0.1:8080`) |
| `APP_DB_PATH` | 대화/캐시 SQLite 파일 경로 (Electron 실행 시 기본값은 `userData` 아래) |

## 사용 예시 질문

- "서울에 있는 종합병원 목록을 보여줘."
- "서울 종합병원 중 응급실이 있는 곳만 보여줘."
- "병원명, 주소, 전화번호만 표로 만들어줘."
- "지역별 병원 수를 집계해줘."
- "이 결과를 엑셀로 저장해줘."
- "개인정보를 수집할 때 적용되는 법령을 찾아줘."

## 개발 단계 (Roadmap)

`docs/technical_plan.md` 23장 기준:

- **Phase 1 (현재)** — Electron + Local SLM + HIRA + 법제처 + Chat UI + SQLite 대화 저장
- **Phase 2** — 필터/정렬/집계/그룹화, CSV·Excel 내보내기, API 캐시 (이 저장소는 Phase 1/2 핵심 파이프라인을 함께 갖추고 있다)
- **Phase 3** — 여러 API 연속 호출, Join, Task Planning, 자동 재시도
- **Phase 4** — Skill 단위 플랫폼 확장 (질병관리청, 식약처, 통계청 등)

## 라이선스

프로그램 소스는 [Apache License 2.0](LICENSE)을 따른다. Local SLM 모델과
HIRA·법제처 데이터의 이용조건은 별도이므로 [`docs/license/README.md`](docs/license/README.md)를 반드시 확인한다.
