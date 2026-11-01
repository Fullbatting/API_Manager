# 실행 방법

Node.js 18 이상이 필요합니다. 저장소 루트에서 의존성을 설치하고 앱을 실행합니다.

```bash
npm ci
npm start
```

조인 관련 회귀 테스트는 `npm test -- tests/dataProcessing/join.test.ts tests/dataProcessing/pipeline.test.ts tests/tools/router.test.ts`로 실행합니다. 모델과 공공 API 설정은 [README](README.md)를 참고하세요.
