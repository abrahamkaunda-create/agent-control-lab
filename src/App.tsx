import { useEffect, useMemo, useState } from "react";
import { scenarios } from "./data/scenarios";
import type { AuditEvent, AuditPayload, PolicyDecision, Role, StorageState } from "./domain/types";
import { evaluatePolicy, policyMatrix, roles, tools } from "./engine/policy";
import { appendAuditEvent, clearAuditEvents, loadAuditEvents, verifyAuditChain } from "./storage/audit";

type RunPhase = "idle" | "evaluating" | "awaiting-approval" | "complete" | "denied" | "rejected";
type IntegrityState = "empty" | "checking" | "valid" | "broken";

const outcomeLabels = { allow: "Allow", approval: "Approval required", deny: "Deny" } as const;

function shortHash(hash: string): string {
  return hash === "GENESIS" ? hash : `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function App() {
  const initialAudit = useMemo(() => loadAuditEvents(), []);
  const [scenarioId, setScenarioId] = useState(scenarios[1].id);
  const scenario = scenarios.find(item => item.id === scenarioId) ?? scenarios[1];
  const [activeRole, setActiveRole] = useState<Role>(scenario.proposal.role);
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [decision, setDecision] = useState<PolicyDecision | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>(initialAudit.events);
  const [storageState, setStorageState] = useState<StorageState>(initialAudit.storage);
  const [integrity, setIntegrity] = useState<IntegrityState>(events.length ? "checking" : "empty");
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );

  const activeProposal = useMemo(() => ({ ...scenario.proposal, role: activeRole }), [scenario, activeRole]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let active = true;
    if (!events.length) {
      setIntegrity("empty");
      return undefined;
    }
    setIntegrity("checking");
    verifyAuditChain(events).then(result => {
      if (active) setIntegrity(result.valid ? "valid" : "broken");
    });
    return () => { active = false; };
  }, [events]);

  function chooseScenario(nextId: string) {
    const next = scenarios.find(item => item.id === nextId) ?? scenarios[0];
    setScenarioId(next.id);
    setActiveRole(next.proposal.role);
    setPhase("idle");
    setDecision(null);
  }

  async function recordMany(payloads: AuditPayload[]) {
    let nextEvents = events;
    let nextStorage = storageState;
    for (const payload of payloads) {
      const result = await appendAuditEvent(nextEvents, payload);
      nextEvents = result.events;
      nextStorage = result.storage;
    }
    setEvents(nextEvents);
    setStorageState(nextStorage);
  }

  async function runScenario() {
    setPhase("evaluating");
    const result = evaluatePolicy(activeProposal);
    setDecision(result);
    const baseEvents: AuditPayload[] = [
      {
        type: "proposal",
        title: `${activeProposal.agentId} proposed ${activeProposal.tool}`,
        detail: `${activeProposal.role} · target ${activeProposal.target} · source ${activeProposal.source}`,
        status: "neutral",
        scenarioId: scenario.id,
      },
      {
        type: "policy",
        title: `${outcomeLabels[result.outcome]} · ${result.reasonCode}`,
        detail: result.explanation,
        status: result.outcome === "allow" ? "allowed" : result.outcome === "approval" ? "waiting" : "denied",
        scenarioId: scenario.id,
        reasonCode: result.reasonCode,
      },
    ];

    if (result.outcome === "allow") {
      await recordMany([
        ...baseEvents,
        { type: "execution", title: "Simulated tool completed", detail: `${activeProposal.tool} returned a synthetic result for ${activeProposal.target}.`, status: "allowed", scenarioId: scenario.id },
        { type: "verification", title: "Outcome verified", detail: "The expected synthetic state matches the tool result.", status: "verified", scenarioId: scenario.id },
      ]);
      setPhase("complete");
    } else if (result.outcome === "approval") {
      await recordMany(baseEvents);
      setPhase("awaiting-approval");
    } else {
      await recordMany([
        ...baseEvents,
        { type: "system", title: "Execution blocked", detail: "The requested tool was not called and no target state changed.", status: "denied", scenarioId: scenario.id, reasonCode: result.reasonCode },
      ]);
      setPhase("denied");
    }
  }

  async function approveAction() {
    await recordMany([
      { type: "approval", title: "Human approval recorded", detail: `Approved for ${activeProposal.target} in this browser-based simulation.`, status: "allowed", scenarioId: scenario.id },
      { type: "execution", title: "Simulated tool completed", detail: `${activeProposal.tool} returned a synthetic success result.`, status: "allowed", scenarioId: scenario.id },
      { type: "verification", title: "Outcome verified", detail: "The fictional account state now matches the requested outcome.", status: "verified", scenarioId: scenario.id },
    ]);
    setPhase("complete");
  }

  async function rejectAction() {
    await recordMany([
      { type: "approval", title: "Human approval rejected", detail: "The simulated tool call was cancelled before execution.", status: "denied", scenarioId: scenario.id },
    ]);
    setPhase("rejected");
  }

  function resetScenario() {
    setDecision(null);
    setPhase("idle");
  }

  function resetAudit() {
    setEvents([]);
    setStorageState(clearAuditEvents());
  }

  function exportAudit() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), chainStatus: integrity, events }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "agent-control-lab-audit.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const pipelineState = (index: number) => {
    if (phase === "idle") return index === 0 ? "current" : "pending";
    if (index === 0) return "complete";
    if (index === 1) return decision ? (decision.outcome === "deny" ? "denied" : "complete") : "current";
    if (index === 2) return phase === "awaiting-approval" ? "current" : phase === "complete" ? "complete" : phase === "rejected" || phase === "denied" ? "denied" : "pending";
    if (index === 3) return phase === "complete" ? "complete" : phase === "denied" || phase === "rejected" ? "denied" : "pending";
    return phase === "complete" ? "complete" : phase === "denied" || phase === "rejected" ? "denied" : "pending";
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#lab">Skip to interactive lab</a>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Agent Control Lab home"><span>AK</span> Agent Control Lab</a>
        <nav aria-label="Page navigation">
          <a className="portfolio-link" href="https://abrahamkaunda-create.github.io/#top">← Portfolio home</a>
          <a href="#lab">Lab</a><a href="#policy">Policy</a><a href="#architecture">Architecture</a><a href="#limits">Limits</a>
          <button className="theme-button" type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? "◐" : "◑"}</button>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span /> Browser-based governance simulation</p>
            <h1>Give an agent tools.<br /><em>Keep control.</em></h1>
            <p className="hero-lead">A personal lab exploring how assigned roles, policy decisions, human approval and an audit record can constrain actions proposed by a simulated AI agent.</p>
            <div className="hero-actions"><a className="button primary" href="#lab">Run a scenario ↓</a><a className="button secondary" href="#architecture">See how it works</a></div>
          </div>
          <div className="hero-system" aria-label="Control-flow overview">
            <div className="system-head"><span>CONTROL PLANE / LOCAL</span><strong>4 synthetic scenarios</strong></div>
            <div className="signal-path">
              {['Role','Proposal','Policy','Approval','Tool','Audit'].map((label,index) => <div key={label}><i>{String(index + 1).padStart(2,'0')}</i><span>{label}</span></div>)}
            </div>
            <div className="hero-decision"><span>POLICY RESULT</span><strong>Approval required</strong><small>ACL-REVIEW-001 · account recovery</small></div>
            <p>No model, network or organisational system is connected.</p>
          </div>
        </section>

        <section className="plain-language">
          <p>01 / PURPOSE</p>
          <h2>The interesting part is not what the simulated agent says. It is what the system allows it to do.</h2>
          <div><p>The lab makes each decision inspectable: who requested an action, which rule applied, whether a person approved it and what was recorded afterwards.</p><dl><div><dt>Roles</dt><dd>3 permission profiles</dd></div><div><dt>Tools</dt><dd>5 constrained actions</dd></div><div><dt>Policy cases</dt><dd>15 role/action combinations</dd></div></dl></div>
        </section>

        <section className="lab-section" id="lab">
          <div className="section-heading"><p>02 / INTERACTIVE LAB</p><h2>Choose a scenario.<br />Watch the control path.</h2></div>
          <div className="scenario-tabs" role="tablist" aria-label="Synthetic scenarios">
            {scenarios.map(item => <button key={item.id} type="button" role="tab" aria-selected={item.id === scenario.id} onClick={() => chooseScenario(item.id)}><span>{item.shortName}</span><strong>{item.name}</strong><small>{item.summary}</small></button>)}
          </div>

          <div className="lab-console">
            <aside className="proposal-panel">
              <div className="panel-label">SIMULATED REQUEST</div>
              <p className="scenario-kind">{scenario.kind.replace('-', ' ')}</p>
              <h3>{scenario.prompt}</h3>
              <dl>
                <div><dt>Agent identity</dt><dd>{activeProposal.agentId}</dd></div>
                <div><dt>Requested tool</dt><dd><code>{activeProposal.tool}</code></dd></div>
                <div><dt>Target</dt><dd>{activeProposal.target}</dd></div>
                <div><dt>Instruction source</dt><dd>{activeProposal.source}</dd></div>
              </dl>
              <label htmlFor="role-select">Evaluate as role</label>
              <select id="role-select" value={activeRole} onChange={event => { setActiveRole(event.target.value as Role); resetScenario(); }}>
                {roles.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
              </select>
              <div className="console-actions">
                <button className="button primary" type="button" onClick={runScenario} disabled={phase === "evaluating" || phase === "awaiting-approval"}>Evaluate proposal</button>
                <button className="text-button" type="button" onClick={resetScenario}>Reset replay</button>
              </div>
            </aside>

            <div className="control-panel" aria-live="polite">
              <div className="pipeline">
                {[
                  ['Role','Assigned simulation role'],
                  ['Policy', decision ? `${outcomeLabels[decision.outcome]} · ${decision.reasonCode}` : 'Waiting for proposal'],
                  ['Approval', phase === 'awaiting-approval' ? 'Human decision required' : phase === 'complete' ? 'Satisfied or not required' : phase === 'rejected' ? 'Rejected by reviewer' : 'Not requested'],
                  ['Simulated tool', phase === 'complete' ? 'Synthetic execution complete' : phase === 'denied' || phase === 'rejected' ? 'Not executed' : 'Not called'],
                  ['Verification', phase === 'complete' ? 'Expected state confirmed' : 'No result to verify'],
                ].map(([title,detail],index) => <div className={`pipeline-node is-${pipelineState(index)}`} key={title}><span>{String(index + 1).padStart(2,'0')}</span><div><strong>{title}</strong><small>{detail}</small></div><i aria-hidden="true" /></div>)}
              </div>

              <div className={`decision-card outcome-${decision?.outcome ?? 'idle'}`}>
                <p>{decision ? `${outcomeLabels[decision.outcome].toUpperCase()} / ${decision.reasonCode}` : 'POLICY ENGINE READY'}</p>
                <h3>{decision?.explanation ?? 'Run the proposal to see the exact policy decision.'}</h3>
                <small>{decision ? `Policy ${decision.policyVersion} evaluated ${activeRole} → ${activeProposal.tool}.` : 'The simulated agent cannot authorise its own action.'}</small>
                {phase === "awaiting-approval" && <div className="approval-actions"><button type="button" onClick={approveAction}>Approve once</button><button type="button" onClick={rejectAction}>Reject request</button></div>}
              </div>
            </div>
          </div>
        </section>

        <section className="audit-section">
          <div className="section-heading compact"><p>03 / AUDIT RECORD</p><h2>Every step leaves a visible record.</h2></div>
          <div className="audit-toolbar">
            <div className={`integrity-chip is-${integrity}`}><i /> <span>{integrity === 'valid' ? 'Hash chain verified' : integrity === 'broken' ? 'Stored chain changed' : integrity === 'checking' ? 'Checking chain' : 'No audit events yet'}</span></div>
            <p>{storageState.message}</p>
            <div><button type="button" onClick={exportAudit} disabled={!events.length}>Export JSON</button><button type="button" onClick={resetAudit} disabled={!events.length}>Clear local history</button></div>
          </div>
          <div className="audit-timeline" aria-live="polite">
            {!events.length && <div className="audit-empty">Run a scenario to create the first browser-local audit event.</div>}
            {[...events].reverse().map(event => <article key={event.id} className={`audit-event status-${event.status}`}><div className="audit-marker" /><div><span>{event.type} · {new Date(event.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span><h3>{event.title}</h3><p>{event.detail}</p><code>{shortHash(event.hash)} ← {shortHash(event.previousHash)}</code></div></article>)}
          </div>
          <aside className="honesty-note"><strong>Tamper-evidence demonstration</strong><p>Each event is hashed using SHA-256 and linked to the preceding event. This can reveal simple changes to stored history, but it is not immutable: someone controlling the browser can alter the code or recalculate the chain.</p></aside>
        </section>

        <section className="policy-section" id="policy">
          <div className="section-heading"><p>04 / POLICY MATRIX</p><h2>Different roles.<br />Different boundaries.</h2></div>
          <div className="policy-table-wrap" tabIndex={0} aria-label="Scrollable policy matrix">
            <table><thead><tr><th scope="col">Role</th>{tools.map(tool => <th scope="col" key={tool.id}>{tool.label}</th>)}</tr></thead><tbody>{roles.map(role => <tr key={role.id}><th scope="row"><strong>{role.label}</strong><small>{role.description}</small></th>{tools.map(tool => { const rule = policyMatrix[role.id][tool.id]; return <td key={tool.id}><span className={`matrix-outcome is-${rule.outcome}`}>{outcomeLabels[rule.outcome]}</span><code>{rule.reasonCode}</code></td>; })}</tr>)}</tbody></table>
          </div>
          <div className="legend"><span><i className="allow" /> Executes within scope</span><span><i className="approval" /> Requires a person</span><span><i className="deny" /> Cannot execute</span></div>
        </section>

        <section className="architecture-section" id="architecture">
          <div className="section-heading compact"><p>05 / ARCHITECTURE</p><h2>The policy engine—not the simulated agent—owns the decision.</h2></div>
          <div className="architecture-diagram" aria-label="Agent Control Lab architecture">
            <div className="architecture-lane"><span>UNTRUSTED</span><div><strong>Visitor prompt</strong><small>Synthetic instruction</small></div><b>→</b><div><strong>Agent simulator</strong><small>Structured proposal</small></div></div>
            <div className="architecture-gate"><span>SIMULATED AUTHORISATION BOUNDARY</span><div><strong>Role assignment</strong><small>Defined permissions</small></div><b>→</b><div><strong>Policy engine</strong><small>Matrix + reason code</small></div><b>→</b><div><strong>Approval gate</strong><small>When required</small></div></div>
            <div className="architecture-lane trusted"><span>RESTRICTED SIMULATION</span><div><strong>Tool adapter</strong><small>Fictional target</small></div><b>→</b><div><strong>Verification</strong><small>Expected state</small></div><b>→</b><div><strong>Audit chain</strong><small>Browser storage</small></div></div>
          </div>
        </section>

        <section className="limits-section" id="limits">
          <div className="section-heading"><p>06 / SECURITY ASSUMPTIONS & LIMITS</p><h2>Built to explain the controls and their boundaries.</h2></div>
          <div className="limits-grid">
            <article><span>01</span><h3>Injection-style instruction</h3><p>An untrusted instruction can influence a proposal, but it does not change the permissions assigned to the simulated agent.</p></article>
            <article><span>02</span><h3>Privilege-escalation request</h3><p>The policy engine denies administrator-creation and bulk-export proposals when the assigned role lacks permission.</p></article>
            <article><span>03</span><h3>Client-side boundary</h3><p>The rules can be inspected or modified. They model an authorisation boundary within the demonstration but are not a secure server-side enforcement point.</p></article>
            <article><span>04</span><h3>Local audit only</h3><p><code>localStorage</code> is device-local and neither durable nor access-controlled. The app falls back to temporary memory when it is unavailable.</p></article>
            <article><span>05</span><h3>Simulated agent</h3><p>Structured JSON fixtures simulate proposed actions. No LLM, external API, personal data or organisational system is connected.</p></article>
            <article><span>06</span><h3>No production claim</h3><p>The lab is a documented learning project. Its four scenarios and five tools are intentionally small and cannot represent a complete governance platform.</p></article>
          </div>
        </section>
      </main>

      <footer><div><p>Agent Control Lab</p><h2>Small enough to inspect.<br />Detailed enough to question.</h2></div><a href="#top">Return to top ↑</a><p>Built as a browser-based learning simulation by Abraham Kaunda.</p></footer>
    </div>
  );
}

export default App;
