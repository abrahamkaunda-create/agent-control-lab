import type { PolicyDecision, PolicyOutcome, Role, Tool, ToolProposal } from "../domain/types";

export const POLICY_VERSION = "acl-policy-1.0";

type Rule = {
  outcome: PolicyOutcome;
  reasonCode: string;
  explanation: string;
};

export const roles: Array<{ id: Role; label: string; description: string }> = [
  { id: "support-analyst", label: "Support analyst", description: "Reads tickets and requests limited account recovery." },
  { id: "security-reviewer", label: "Security reviewer", description: "Investigates and contains suspicious access." },
  { id: "platform-administrator", label: "Platform administrator", description: "Performs privileged platform changes with approval." },
];

export const tools: Array<{ id: Tool; label: string }> = [
  { id: "read_ticket", label: "Read support ticket" },
  { id: "unlock_account", label: "Unlock account" },
  { id: "disable_account", label: "Disable account" },
  { id: "create_admin_account", label: "Create administrator account" },
  { id: "export_employee_records", label: "Export employee records" },
];

export const policyMatrix: Record<Role, Record<Tool, Rule>> = {
  "support-analyst": {
    read_ticket: { outcome: "allow", reasonCode: "ACL-ALLOW-001", explanation: "Ticket reading is within the support analyst's assigned scope." },
    unlock_account: { outcome: "approval", reasonCode: "ACL-REVIEW-001", explanation: "Account recovery requires a recorded human approval before execution." },
    disable_account: { outcome: "deny", reasonCode: "ACL-DENY-003", explanation: "Support analysts cannot disable identities." },
    create_admin_account: { outcome: "deny", reasonCode: "ACL-DENY-004", explanation: "Administrator creation is outside the support role." },
    export_employee_records: { outcome: "deny", reasonCode: "ACL-DENY-005", explanation: "Bulk employee-data export is not an approved support capability." },
  },
  "security-reviewer": {
    read_ticket: { outcome: "allow", reasonCode: "ACL-ALLOW-001", explanation: "Ticket context is available for security investigation." },
    unlock_account: { outcome: "deny", reasonCode: "ACL-DENY-006", explanation: "Security reviewers investigate access but do not restore accounts." },
    disable_account: { outcome: "approval", reasonCode: "ACL-REVIEW-002", explanation: "Containment is permitted only after a human reviewer approves the target." },
    create_admin_account: { outcome: "deny", reasonCode: "ACL-DENY-004", explanation: "Security review does not include administrator provisioning." },
    export_employee_records: { outcome: "deny", reasonCode: "ACL-DENY-005", explanation: "Bulk employee-data export is outside the security-review scope." },
  },
  "platform-administrator": {
    read_ticket: { outcome: "allow", reasonCode: "ACL-ALLOW-001", explanation: "Ticket context may be read to support an authorised change." },
    unlock_account: { outcome: "approval", reasonCode: "ACL-REVIEW-001", explanation: "Account recovery remains subject to recorded approval." },
    disable_account: { outcome: "approval", reasonCode: "ACL-REVIEW-002", explanation: "Identity containment requires approval and target verification." },
    create_admin_account: { outcome: "approval", reasonCode: "ACL-REVIEW-003", explanation: "Privileged account creation requires a separate human approval." },
    export_employee_records: { outcome: "deny", reasonCode: "ACL-DENY-005", explanation: "The simulated agent has no bulk employee-data export capability." },
  },
};

export function evaluatePolicy(proposal: ToolProposal): PolicyDecision {
  const rule = policyMatrix[proposal.role][proposal.tool];
  return { ...rule, policyVersion: POLICY_VERSION };
}
