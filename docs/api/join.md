# Query DSL 조인

현재 DSL의 `join`은 같은 이름의 필드 하나를 기준으로 하는 **inner join**만
지원한다. `left`, `right`, `outer` 조인 종류를 지정하는 필드는 없다.

```json
{
  "source": "hira",
  "entity": "hospital",
  "operation": "join",
  "join": {
    "on": "region",
    "with": { "source": "another_source", "entity": "statistics", "operation": "search" }
  }
}
```

두 source/entity는 모두 등록되어야 한다. 각 Connector가 정규화한 행을 조인한 뒤
주 쿼리의 filter, group/aggregate, sort, select, limit을 순서대로 적용한다.
`join.with`는 두 번째 Connector에 전달되지만 별도 로컬 파이프라인이나 중첩
조인을 실행하지 않는다. 결과 메타데이터(`totalCount` 포함)는 첫 번째
Connector의 값을 유지하며 조인 결과의 행 수로 다시 계산하지 않는다.

## 키와 결과 규칙

- 필드가 없거나 값이 `null` 또는 `undefined`인 행은 매칭되지 않는다.
  실제 빈 문자열 `""`, 숫자 `0`, 불리언 `false`는 유효한 키다.
- 유효한 키는 기존과 같이 문자열로 변환해 비교한다. 따라서 숫자 `0`과
  문자열 `"0"`은 일치하지만 `0`과 `""`는 다르다.
- 일치하는 키의 중복 행은 모든 조합을 출력한다. 왼쪽 행 순서를 먼저,
  각 왼쪽 행에 대해 오른쪽 행 순서를 유지한다. 매칭되지 않은 행은 제외된다.
- 조인 키는 왼쪽 값을 유지한다. 나머지 오른쪽 필드가 왼쪽 필드와 이름이
  같으면 `right_` 접두사를 붙이고, 그렇지 않으면 원래 이름으로 추가한다.
  기존 `right_` 이름과 충돌할 때 별도의 이름 생성 규칙은 없다.

## 회귀 테스트 실행

의존성이 설치된 저장소 루트에서:

```bash
npm test -- tests/dataProcessing/join.test.ts tests/dataProcessing/pipeline.test.ts tests/tools/router.test.ts
```

이 테스트들은 고정 데이터와 가짜 Connector를 사용하며 외부 API에 요청하지 않는다.
