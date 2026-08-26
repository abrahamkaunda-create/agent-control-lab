import type { AuditEvent, AuditPayload, StorageState } from "../domain/types";

const STORAGE_KEY = "agent-control-lab.audit.v1";
const GENESIS_HASH = "GENESIS";

let memoryEvents: AuditEvent[] = [];

function stableEventText(event: Omit<AuditEvent, "hash">): string {
  return JSON.stringify({
    id: event.id,
    timestamp: event.timestamp,
    previousHash: event.previousHash,
    type: event.type,
    title: event.title,
    detail: event.detail,
    status: event.status,
    scenarioId: event.scenarioId,
    reasonCode: event.reasonCode ?? "",
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function readLocal(): AuditEvent[] {
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed as AuditEvent[] : [];
}

export function loadAuditEvents(): { events: AuditEvent[]; storage: StorageState } {
  try {
    const events = readLocal();
    memoryEvents = events;
    return { events, storage: { mode: "local", message: "Audit history is stored only in this browser." } };
  } catch {
    return { events: memoryEvents, storage: { mode: "memory", message: "Browser storage is unavailable; this session uses temporary memory only." } };
  }
}

function saveAuditEvents(events: AuditEvent[]): StorageState {
  memoryEvents = events;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    return { mode: "local", message: "Audit history is stored only in this browser." };
  } catch {
    return { mode: "memory", message: "Browser storage is unavailable; this session uses temporary memory only." };
  }
}

export async function appendAuditEvent(events: AuditEvent[], payload: AuditPayload): Promise<{ events: AuditEvent[]; storage: StorageState }> {
  const previousHash = events.at(-1)?.hash ?? GENESIS_HASH;
  const eventWithoutHash: Omit<AuditEvent, "hash"> = {
    ...payload,
    id: `${Date.now()}-${events.length + 1}`,
    timestamp: new Date().toISOString(),
    previousHash,
  };
  const event: AuditEvent = { ...eventWithoutHash, hash: await sha256(stableEventText(eventWithoutHash)) };
  const nextEvents = [...events, event];
  return { events: nextEvents, storage: saveAuditEvents(nextEvents) };
}

export async function verifyAuditChain(events: AuditEvent[]): Promise<{ valid: boolean; brokenAt?: number }> {
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedPrevious = index === 0 ? GENESIS_HASH : events[index - 1].hash;
    const { hash, ...withoutHash } = event;
    const expectedHash = await sha256(stableEventText(withoutHash));
    if (event.previousHash !== expectedPrevious || hash !== expectedHash) return { valid: false, brokenAt: index };
  }
  return { valid: true };
}

export function clearAuditEvents(): StorageState {
  memoryEvents = [];
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return { mode: "local", message: "Audit history is stored only in this browser." };
  } catch {
    return { mode: "memory", message: "Browser storage is unavailable; this session uses temporary memory only." };
  }
}
