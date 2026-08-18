const examples = {
  blocked: ["src/generated/api-client.ts"],
  review: ["api/openapi.yaml"],
  allowed: ["api/openapi.yaml", "src/generated/api-client.ts"],
};

const elements = {
  enginePill: document.querySelector("#engine-pill"),
  engineLabel: document.querySelector("#engine-label"),
  metrics: document.querySelector("#metrics"),
  changedFiles: document.querySelector("#changed-files"),
  analyze: document.querySelector("#analyze"),
  reindex: document.querySelector("#reindex"),
  decisionCard: document.querySelector("#decision-card"),
  decisionWord: document.querySelector("#decision-word"),
  decisionSummary: document.querySelector("#decision-summary"),
  decisionEngine: document.querySelector("#decision-engine"),
  reasonList: document.querySelector("#reason-list"),
  lineageFile: document.querySelector("#lineage-file"),
  trace: document.querySelector("#trace"),
  loadLineage: document.querySelector("#load-lineage"),
  graphPanel: document.querySelector("#graph-panel"),
};

async function api(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : JSON.stringify(body.error));
  return body;
}

async function boot() {
  try {
    const [status, generated] = await Promise.all([api("/api/status"), api("/api/generated")]);
    renderStatus(status);
    elements.lineageFile.innerHTML = generated.files
      .map((file) => `<option value="${escapeHtml(file)}">${escapeHtml(file)}</option>`)
      .join("");
    await analyze();
  } catch (error) {
    elements.engineLabel.textContent = `Unavailable · ${error.message}`;
  }
}

function renderStatus(status) {
  elements.enginePill.classList.toggle("live", status.hydraConnected);
  elements.engineLabel.textContent = status.hydraConnected ? "HydraDB · live" : "Deterministic fallback · local";
  const values = [status.stats.files, status.stats.generatedFiles, status.stats.relationships];
  elements.metrics.querySelectorAll("strong").forEach((element, index) => {
    element.textContent = String(values[index] ?? "—");
  });
}

async function analyze() {
  setLoading(elements.decisionCard, true);
  try {
    const changedFiles = elements.changedFiles.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    const result = await api("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changedFiles }),
    });
    renderDecision(result);
  } catch (error) {
    renderError(error);
  } finally {
    setLoading(elements.decisionCard, false);
  }
}

function renderDecision(result) {
  const decision = result.decision.toLowerCase();
  elements.decisionWord.className = `decision-word ${decision}`;
  elements.decisionWord.textContent = result.decision;
  elements.decisionEngine.textContent = `${result.engine} evidence`;
  const summaries = {
    BLOCK: "The patch targets a derived artifact without changing its authoritative source.",
    REVIEW: "The provenance chain is incomplete or regenerated outputs are missing.",
    ALLOW: "The proposed patch is structurally consistent with the generation graph.",
  };
  elements.decisionSummary.textContent = summaries[result.decision];
  elements.reasonList.innerHTML = result.reasons
    .map((reason) => `<div class="reason">${escapeHtml(reason)}</div>`)
    .join("");
}

function renderError(error) {
  elements.decisionWord.className = "decision-word block";
  elements.decisionWord.textContent = "ERROR";
  elements.decisionSummary.textContent = error.message;
  elements.reasonList.innerHTML = "";
}

async function trace() {
  const file = elements.lineageFile.value;
  if (!file) return;
  setLoading(elements.graphPanel, true);
  try {
    const result = await api(`/api/lineage?file=${encodeURIComponent(file)}`);
    renderLineage(result);
  } catch (error) {
    elements.graphPanel.innerHTML = `<div class="graph-empty"><span class="graph-empty-mark">!</span><p>${escapeHtml(error.message)}</p></div>`;
  } finally {
    setLoading(elements.graphPanel, false);
  }
}

function renderLineage(result) {
  const primarySource = result.sources[0];
  const command = result.commands[0];
  const output = result.generatedOutputs.find((node) => node.path === result.target.path) ?? result.target;
  const consumer = result.consumers[0];
  const test = result.tests[0];
  const chain = [primarySource, command, output, consumer, test].filter(Boolean);
  const labels = ["FEEDS", "GENERATES", "IMPORTED BY", "VERIFIED BY"];
  let html = '<div class="graph-flow">';
  chain.forEach((node, index) => {
    html += `<div class="graph-node ${escapeHtml(node.kind)}"><small>${escapeHtml(prettyKind(node.kind))}</small><strong>${escapeHtml(node.path || node.name)}</strong></div>`;
    if (index < chain.length - 1) html += `<div class="graph-edge"><span>${labels[index] ?? "REACHES"}</span></div>`;
  });
  html += "</div>";
  html += `<div class="graph-meta">${result.paths.length} evidence paths · ${result.consumers.length} consumers · ${result.tests.length} tests · engine: ${escapeHtml(result.engine)}</div>`;
  elements.graphPanel.innerHTML = html;
}

function prettyKind(kind) {
  return kind.replaceAll("_", " ");
}

function setLoading(element, loading) {
  element.classList.toggle("loading", loading);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelectorAll(".demo-tab").forEach((button) => {
  button.addEventListener("click", async () => {
    document.querySelectorAll(".demo-tab").forEach((candidate) => candidate.classList.remove("active"));
    button.classList.add("active");
    elements.changedFiles.value = examples[button.dataset.example].join("\n");
    await analyze();
  });
});

elements.analyze.addEventListener("click", analyze);
elements.trace.addEventListener("click", trace);
elements.loadLineage.addEventListener("click", () => {
  document.querySelector("#lineage").scrollIntoView({ behavior: "smooth" });
  trace();
});
elements.reindex.addEventListener("click", async () => {
  elements.reindex.classList.add("loading");
  try {
    renderStatus(await api("/api/reindex", { method: "POST" }));
    await analyze();
  } finally {
    elements.reindex.classList.remove("loading");
  }
});

boot();
