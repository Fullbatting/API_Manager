import { describe, expect, it } from "vitest";
import { ToolRegistry } from "../../core/tools/registry";
import { ToolRouter } from "../../core/tools/router";
import { PermissionManager } from "../../core/permission/permissionManager";
import type { ApiConnector } from "../../connectors/common/types";
import type { NormalizedRecord, NormalizedResult, ConnectorRequestParams } from "../../core/types/domain";
import type { QueryDSL } from "../../core/query/dsl/types";

/** 테스트 전용 가짜 Connector: 실제 네트워크 호출 없이 고정 데이터를 돌려준다 */
class FakeHospitalConnector implements ApiConnector {
  readonly name = "fake_hospital_search";
  readonly description = "테스트용";
  readonly source = "fake";
  readonly entity = "hospital";
  readonly sourceLabel = "테스트 소스";

  buildParams(): ConnectorRequestParams {
    return {};
  }

  async request(): Promise<unknown> {
    return [
      { name: "가나병원", region: "서울" },
      { name: "다라병원", region: "부산" },
    ];
  }

  normalize(rawResponse: unknown): NormalizedResult {
    return {
      entity: this.entity,
      source: this.source,
      sourceLabel: this.sourceLabel,
      fetchedAt: new Date().toISOString(),
      rows: rawResponse as NormalizedResult["rows"],
    };
  }
}

class FakeJoinConnector implements ApiConnector {
  readonly description = "테스트용";
  readonly source = "fake";
  readonly sourceLabel = "테스트 소스";
  readonly name: string;
  calls = 0;
  receivedDsl?: QueryDSL;

  constructor(
    readonly entity: string,
    private readonly rows: NormalizedRecord[],
    private readonly failure?: string
  ) {
    this.name = `fake_${entity}`;
  }

  buildParams(dsl: QueryDSL): ConnectorRequestParams {
    this.receivedDsl = dsl;
    return {};
  }

  async request(): Promise<unknown> {
    this.calls++;
    if (this.failure) throw new Error(this.failure);
    return this.rows;
  }

  normalize(rawResponse: unknown): NormalizedResult {
    return {
      entity: this.entity,
      source: this.source,
      sourceLabel: this.sourceLabel,
      fetchedAt: "fixed",
      totalCount: 123,
      rows: rawResponse as NormalizedRecord[],
    };
  }
}

describe("ToolRouter", () => {
  it("등록된 Connector를 실행하고 Data Processor 파이프라인을 적용한다", async () => {
    const registry = new ToolRegistry([new FakeHospitalConnector()]);
    const router = new ToolRouter(registry, new PermissionManager(registry));

    const dsl: QueryDSL = {
      source: "fake",
      operation: "search",
      entity: "hospital",
      filters: [{ field: "region", operator: "eq", value: "서울" }],
    };

    const result = await router.execute(dsl);
    expect(result.ok).toBe(true);
    expect(result.result?.rows).toEqual([{ name: "가나병원", region: "서울" }]);
  });

  it("등록되지 않은 source/entity는 Permission 단계에서 차단한다", async () => {
    const registry = new ToolRegistry([new FakeHospitalConnector()]);
    const router = new ToolRouter(registry, new PermissionManager(registry));

    const dsl: QueryDSL = { source: "unknown", operation: "search", entity: "hospital" };
    const result = await router.execute(dsl);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/허용되지 않은/);
  });

  it("양쪽 정규화 결과를 inner join한 뒤 주 쿼리 파이프라인을 적용한다", async () => {
    const primary = new FakeJoinConnector("left", [
      { name: "missing" },
      { key: null, name: "null" },
      { key: "", name: "empty" },
      { key: 0, name: "zero" },
      { key: "x", name: "unmatched" },
    ]);
    const secondary = new FakeJoinConnector("right", [
      { label: "missing" },
      { key: null, label: "null" },
      { key: "", label: "empty" },
      { key: "0", label: "zero1" },
      { key: 0, label: "zero2" },
    ]);
    const registry = new ToolRegistry([primary, secondary]);
    const router = new ToolRouter(registry, new PermissionManager(registry));
    const nested: QueryDSL = { source: "fake", entity: "right", operation: "search" };
    const dsl: QueryDSL = {
      source: "fake",
      entity: "left",
      operation: "join",
      join: { with: nested, on: "key" },
      filters: [{ field: "name", operator: "eq", value: "zero" }],
      select: ["key", "label"],
      limit: 1,
    };

    expect(await router.execute(dsl)).toEqual({
      ok: true,
      result: {
        entity: "left",
        source: "fake",
        sourceLabel: "테스트 소스",
        fetchedAt: "fixed",
        totalCount: 123,
        rows: [{ key: 0, label: "zero1" }],
      },
    });
    expect(primary.receivedDsl).toEqual(dsl);
    expect(secondary.receivedDsl).toEqual(nested);
    expect(primary.calls).toBe(1);
    expect(secondary.calls).toBe(1);
  });

  it("조인 대상 권한이 없으면 어느 Connector도 실행하지 않는다", async () => {
    const primary = new FakeJoinConnector("left", [{ key: "a" }]);
    const registry = new ToolRegistry([primary]);
    const router = new ToolRouter(registry, new PermissionManager(registry));
    const dsl: QueryDSL = {
      source: "fake", entity: "left", operation: "join",
      join: { on: "key", with: { source: "fake", entity: "unknown", operation: "search" } },
    };
    const result = await router.execute(dsl);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/허용되지 않은/);
    expect(primary.calls).toBe(0);
  });

  it("두 번째 Connector 오류를 반환한다", async () => {
    const primary = new FakeJoinConnector("left", [{ key: "a" }]);
    const secondary = new FakeJoinConnector("right", [], "secondary failed");
    const registry = new ToolRegistry([primary, secondary]);
    const router = new ToolRouter(registry, new PermissionManager(registry));
    const result = await router.execute({
      source: "fake", entity: "left", operation: "join",
      join: { on: "key", with: { source: "fake", entity: "right", operation: "search" } },
    });
    expect(result).toEqual({ ok: false, error: "secondary failed" });
    expect(primary.calls).toBe(1);
    expect(secondary.calls).toBe(1);
  });

  it("누락/null 키가 있어도 라우터가 빈 문자열과 0 조인만 반환한다", async () => {
    const primary = new FakeJoinConnector("left", [
      { left: "missing" }, { key: null, left: "null" },
      { key: "", left: "empty" }, { key: 0, left: "zero" },
    ]);
    const secondary = new FakeJoinConnector("right", [
      { right: "missing" }, { key: null, right: "null" },
      { key: "", right: "empty" }, { key: "0", right: "zero" },
    ]);
    const registry = new ToolRegistry([primary, secondary]);
    const router = new ToolRouter(registry, new PermissionManager(registry));
    const result = await router.execute({
      source: "fake", entity: "left", operation: "join",
      join: { on: "key", with: { source: "fake", entity: "right", operation: "search" } },
    });
    expect(result.result?.rows).toEqual([
      { key: "", left: "empty", right: "empty" },
      { key: 0, left: "zero", right: "zero" },
    ]);
  });
});
