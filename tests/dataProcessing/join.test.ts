import { describe, expect, it } from "vitest";
import { applyJoin } from "../../core/dataProcessing/join";
import type { NormalizedRecord } from "../../core/types/domain";

describe("applyJoin inner join", () => {
  it("누락, null, undefined 키는 서로 또는 빈 문자열과 일치하지 않는다", () => {
    const left = [
      { left: "missing" },
      { key: null, left: "null" },
      { key: undefined, left: "undefined" },
      { key: "", left: "empty" },
    ] as unknown as NormalizedRecord[];
    const right = [
      { right: "missing" },
      { key: null, right: "null" },
      { key: undefined, right: "undefined" },
      { key: "", right: "empty" },
    ] as unknown as NormalizedRecord[];

    expect(applyJoin(left, right, "key")).toEqual([
      { key: "", left: "empty", right: "empty" },
    ]);
  });

  it("빈 문자열, 0, false는 유효한 키이며 문자열 변환으로 비교한다", () => {
    const left = [
      { key: "", left: "empty" },
      { key: 0, left: "zero" },
      { key: false, left: "false" },
      { key: "missing", left: "unmatched" },
    ];
    const right = [
      { key: "", right: "empty" },
      { key: "0", right: "zero" },
      { key: "false", right: "false" },
    ];
    expect(applyJoin(left, right, "key")).toEqual([
      { key: "", left: "empty", right: "empty" },
      { key: 0, left: "zero", right: "zero" },
      { key: false, left: "false", right: "false" },
    ]);
  });

  it("중복 키의 모든 조합을 왼쪽 순서와 오른쪽 순서로 출력하고 충돌에 접두사를 붙인다", () => {
    const left = [{ key: "a", name: "L1" }, { key: "a", name: "L2" }];
    const right = [{ key: "a", name: "R1" }, { key: "a", name: "R2" }];
    expect(applyJoin(left, right, "key")).toEqual([
      { key: "a", name: "L1", right_name: "R1" },
      { key: "a", name: "L1", right_name: "R2" },
      { key: "a", name: "L2", right_name: "R1" },
      { key: "a", name: "L2", right_name: "R2" },
    ]);
    expect(left).toEqual([{ key: "a", name: "L1" }, { key: "a", name: "L2" }]);
    expect(right).toEqual([{ key: "a", name: "R1" }, { key: "a", name: "R2" }]);
  });

  it("한쪽이 비었거나 키가 일치하지 않으면 빈 결과를 반환한다", () => {
    expect(applyJoin([], [{ key: "a" }], "key")).toEqual([]);
    expect(applyJoin([{ key: "a" }], [], "key")).toEqual([]);
    expect(applyJoin([{ key: "a" }], [{ key: "b" }], "key")).toEqual([]);
  });

  it("상속된 속성은 실제 행의 조인 키로 취급하지 않는다", () => {
    const inherited = Object.create({ key: "a" }) as NormalizedRecord;
    expect(applyJoin([inherited], [{ key: "a" }], "key")).toEqual([]);
    expect(applyJoin([{ key: "a" }], [inherited], "key")).toEqual([]);
  });
});
