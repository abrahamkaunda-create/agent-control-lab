import { describe, expect, it } from "vitest";
import type { AuditEvent } from "../domain/types";
import { appendAuditEvent, clearAuditEvents, verifyAuditChain } from "./audit";

describe("hash-chained browser audit", () => {
  it("links each new event to the previous hash", async () => {
    clearAuditEvents();
    const first = await appendAuditEvent([], { type: "proposal", title: "Proposal", detail: "Synthetic request", status: "neutral", scenarioId: "test" });
    const second = await appendAuditEvent(first.events, { type: "policy", title: "Allowed", detail: "Policy matched", status: "allowed", scenarioId: "test", reasonCode: "ACL-ALLOW-001" });

    expect(second.events[0].previousHash).toBe("GENESIS");
    expect(second.events[1].previousHash).toBe(second.events[0].hash);
    await expect(verifyAuditChain(second.events)).resolves.toEqual({ valid: true });
  });

  it("detects a simple change to stored event content", async () => {
    const result = await appendAuditEvent([], { type: "system", title: "Original", detail: "Untouched", status: "neutral", scenarioId: "test" });
    const changed: AuditEvent[] = [{ ...result.events[0], detail: "Changed after hashing" }];

    await expect(verifyAuditChain(changed)).resolves.toEqual({ valid: false, brokenAt: 0 });
  });

  it("falls back to memory when localStorage cannot be written", async () => {
    const original = Storage.prototype.setItem;
    let result;
    try {
      Storage.prototype.setItem = () => { throw new Error("unavailable"); };
      result = await appendAuditEvent([], { type: "system", title: "Fallback", detail: "Temporary", status: "neutral", scenarioId: "test" });
    } finally {
      Storage.prototype.setItem = original;
    }

    expect(result.storage.mode).toBe("memory");
    expect(result.events).toHaveLength(1);
  });
});
