export type Role = "support-analyst" | "security-reviewer" | "platform-administrator";

export type Tool =
  | "read_ticket"
  | "unlock_account"
  | "disable_account"
  | "create_admin_account"
  | "export_employee_records";

export type PolicyOutcome = "allow" | "approval" | "deny";

export type ScenarioKind = "routine" | "sensitive" | "prompt-injection" | "privilege-escalation";

export interface ToolProposal {
  agentId: string;
  role: Role;
  tool: Tool;
  target: string;
  rationale: string;
  source: string;
}

export interface PolicyDecision {
  outcome: PolicyOutcome;
  reasonCode: string;
  explanation: string;
  policyVersion: string;
}

export interface Scenario {
  id: string;
  name: string;
  shortName: string;
  kind: ScenarioKind;
  summary: string;
  prompt: string;
  proposal: ToolProposal;
  expectedOutcome: PolicyOutcome;
}

export interface AuditPayload {
  type: "proposal" | "policy" | "approval" | "execution" | "verification" | "system";
  title: string;
  detail: string;
  status: "neutral" | "allowed" | "waiting" | "denied" | "verified";
  scenarioId: string;
  reasonCode?: string;
}

export interface AuditEvent extends AuditPayload {
  id: string;
  timestamp: string;
  previousHash: string;
  hash: string;
}

export interface StorageState {
  mode: "local" | "memory";
  message: string;
}
