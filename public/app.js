const examples = {
  blocked: ["src/generated/api-client.ts"],
  review: ["api/openapi.yaml"],
  allowed: ["api/openapi.yaml", "src/generated/api-client.ts"],
};

const decisionIcons = {
  BLOCK: "ph-prohibit",
  REVIEW: "ph-warning",
  ALLOW: "ph-check-circle",
};

const nodeIcons = {
  source_spec: "ph-file-text",
  generator_config: "ph-sliders-horizontal",
  generator_command: "ph-terminal-window",
  generated_file: "ph-file-code",
  test: "ph-test-tube",
  repository: "ph-folder-open",
  file: "ph-code",
};

const elements = {
  enginePill: document.querySelector("#engine-pill"),
  engineLabel: document.querySelector("#engine-label"),
  metrics: document.querySelector("#metrics"),
  changedFiles: document.querySelector("#changed-files"),
  analyze: document.querySelector("#analyze"),
  reindex: document.querySelector("#reindex"),
  decisionCard: document.querySelector("#decision-card"),
  decisionIcon: document.querySelector("#decision-icon"),
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
  setupRevealMotion();
  try {
    const [status, generated] = await Promise.all([api("/api/status"), api("/api/generated")]);
    renderStatus(status);
    renderGeneratedFiles(generated.files);
    await analyze();
  } catch (error) {
    elements.engineLabel.textContent = `Unavailable · ${error.message}`;
    renderError(error);
  }
}

function renderStatus(status) {
  elements.enginePill.classList.toggle("live", status.hydraConnected);
  elements.engineLabel.textContent = status.hydraConnected ? "HydraDB · live" : "Deterministic fallback · local";
  const values = [status.stats.files, status.stats.generatedFiles, status.stats.relationships];
  elements.metrics.querySelectorAll("dd").forEach((element, index) => {
    element.textContent = String(values[index] ?? "—");
  });
}

function renderGeneratedFiles(files) {
  const previous = elements.lineageFile.value;
  elements.lineageFile.innerHTML = files
    .map((file) => `<option value="${escapeHtml(file)}">${escapeHtml(file)}</option>`)
    .join("");
  if (files.includes(previous)) elements.lineageFile.value = previous;
}

async function analyze() {
  setLoading(elements.decisionCard, true);
  try {
    const changedFiles = elements.changedFiles.value
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
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
  const state = result.decision.toLowerCase();
  elements.decisionCard.dataset.state = state;
  elements.decisionWord.className = `decision-word ${state}`;
  elements.decisionWord.textContent = result.decision;
  elements.decisionIcon.className = `ph ${decisionIcons[result.decision] ?? "ph-git-diff"}`;
  elements.decisionEngine.textContent = `${result.engine} evidence`;

  const summaries = {
    BLOCK: "Wrong file. Change the source and regenerate this artifact.",
    REVIEW: "The source changed, but its generated output is missing.",
    ALLOW: "Source and generated output move together. Run the checks.",
  };
  elements.decisionSummary.textContent = summaries[result.decision];
  elements.reasonList.innerHTML = result.reasons
    .map(
      (reason) =>
        `<div class="reason"><i class="ph ph-arrow-right" aria-hidden="true"></i><span>${escapeHtml(reason)}</span></div>`,
    )
    .join("");
}

function renderError(error) {
  elements.decisionCard.dataset.state = "block";
  elements.decisionIcon.className = "ph ph-warning";
  elements.decisionWord.className = "decision-word block";
  elements.decisionWord.textContent = "ERROR";
  elements.decisionSummary.textContent = error.message;
  elements.decisionEngine.textContent = "request failed";
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
    elements.graphPanel.innerHTML = `
      <div class="graph-empty">
        <i class="ph ph-warning" aria-hidden="true"></i>
        <p>${escapeHtml(error.message)}</p>
      </div>`;
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
  const steps = [
    { node: primarySource, edge: null },
    { node: command, edge: "FEEDS" },
    { node: output, edge: "GENERATES" },
    { node: consumer, edge: "IMPORTED BY" },
    { node: test, edge: "VERIFIED BY" },
  ].filter((step) => Boolean(step.node));

  if (steps.length === 0) {
    elements.graphPanel.innerHTML = `
      <div class="graph-empty">
        <i class="ph ph-file-x" aria-hidden="true"></i>
        <p>No graph evidence was returned for this artifact.</p>
      </div>`;
    return;
  }

  let html = '<div class="graph-flow">';
  steps.forEach((step, index) => {
    if (index > 0) {
      html += `
        <div class="graph-edge">
          <span><i class="ph ph-arrow-right" aria-hidden="true"></i>${escapeHtml(step.edge ?? "REACHES")}</span>
        </div>`;
    }
    const icon = nodeIcons[step.node.kind] ?? "ph-file";
    html += `
      <div class="graph-node ${escapeHtml(step.node.kind)}" style="--node-index:${index}">
        <span class="graph-node-icon"><i class="ph ${icon}" aria-hidden="true"></i></span>
        <small>${escapeHtml(prettyKind(step.node.kind))}</small>
        <strong>${escapeHtml(step.node.path || step.node.name)}</strong>
      </div>`;
  });
  html += "</div>";

  html += `
    <div class="graph-ledger">
      ${ledgerRow("Consumers", result.consumers.map((node) => node.path))}
      ${ledgerRow("Tests", result.tests.map((node) => node.path))}
      ${ledgerRow("Engine", [result.engine])}
    </div>
    <div class="graph-meta">
      ${result.paths.length} evidence paths · ${result.consumers.length} consumers · ${result.tests.length} tests
    </div>`;

  elements.graphPanel.innerHTML = html;
}

function ledgerRow(label, values) {
  const rendered = values.length > 0 ? values.map((value) => `<span>${escapeHtml(value)}</span>`).join("") : "<span>none</span>";
  return `<div class="ledger-row"><span>${escapeHtml(label)}</span><div class="ledger-items">${rendered}</div></div>`;
}

function prettyKind(kind) {
  return kind.replaceAll("_", " ");
}

function setLoading(element, loading) {
  element.classList.toggle("loading", loading);
}

function setupRevealMotion() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealElements = [...document.querySelectorAll(".reveal-on-scroll")];

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );

  revealElements.forEach((element) => observer.observe(element));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelectorAll(".scenario-tab").forEach((button) => {
  button.addEventListener("click", async () => {
    const example = button.dataset.example;
    if (!example || !examples[example]) return;
    document.querySelectorAll(".scenario-tab").forEach((candidate) => {
      candidate.classList.remove("active");
      candidate.setAttribute("aria-selected", "false");
    });
    button.classList.add("active");
    button.setAttribute("aria-selected", "true");
    elements.changedFiles.value = examples[example].join("\n");
    await analyze();
  });
});

elements.analyze.addEventListener("click", analyze);
elements.trace.addEventListener("click", trace);
elements.loadLineage.addEventListener("click", () => {
  document.querySelector("#lineage")?.scrollIntoView({ behavior: "smooth" });
  void trace();
});
elements.reindex.addEventListener("click", async () => {
  elements.reindex.classList.add("is-spinning");
  try {
    const status = await api("/api/reindex", { method: "POST" });
    renderStatus(status);
    const generated = await api("/api/generated");
    renderGeneratedFiles(generated.files);
    await analyze();
  } finally {
    elements.reindex.classList.remove("is-spinning");
  }
});

void boot();
