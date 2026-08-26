import { describe, expect, it } from "vitest";
import { scenarios } from "../data/scenarios";
import { evaluatePolicy, policyMatrix, roles, tools } from "./policy";

describe("policy matrix", () => {
  it("defines a decision and reason code for every role/action combination", () => {
    const evaluated = roles.flatMap(role => tools.map(tool => ({ role: role.id, tool: tool.id, rule: policyMatrix[role.id][tool.id] })));

    expect(evaluated).toHaveLength(15);
    evaluated.forEach(({ rule }) => {
      expect(["allow", "approval", "deny"]).toContain(rule.outcome);
      expect(rule.reasonCode).toMatch(/^ACL-(ALLOW|REVIEW|DENY)-\d{3}$/);
      expect(rule.explanation.length).toBeGreaterThan(25);
    });
  });

  it("returns the documented result for every synthetic scenario", () => {
    scenarios.forEach(scenario => {
      expect(evaluatePolicy(scenario.proposal).outcome).toBe(scenario.expectedOutcome);
    });
  });

  it("never allows bulk employee export for any role", () => {
    roles.forEach(role => {
      expect(policyMatrix[role.id].export_employee_records.outcome).toBe("deny");
    });
  });

  it("requires approval for privileged administrator creation", () => {
    expect(policyMatrix["platform-administrator"].create_admin_account.outcome).toBe("approval");
    expect(policyMatrix["support-analyst"].create_admin_account.outcome).toBe("deny");
  });
});
