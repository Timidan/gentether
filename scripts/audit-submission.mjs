import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const checks = [];

const check = (name, condition, detail) => {
  checks.push({name, ok: Boolean(condition), detail});
  if (!condition) failures.push(`${name}: ${detail}`);
};

const required = [
  "README.md",
  "LICENSE",
  "package.json",
  "public/index.html",
  "public/tokens.css",
  "public/styles.css",
  "public/graph.css",
  "public/app.js",
  ".hallmark/preflight.json",
  ".hallmark/log.json",
  "docs/HACKATHON.md",
  "docs/ARCHITECTURE.md",
  "docs/HYDRA_QUERIES.md",
  "video/GenTetherDemo.tsx",
  "video/Root.tsx",
  "video/data.ts",
  ".github/workflows/ci.yml",
  ".github/workflows/hydra-live.yml",
  ".github/workflows/render-demo.yml",
  "scripts/verify-hydra-live.sh",
  "scripts/check-deployment.mjs",
  "compose.vps.yml",
  ".env.deploy.example",
];
for (const file of required) check(`required:${file}`, existsSync(path.join(root, file)), `${file} must exist`);

const forbiddenDocs = [
  "docs/BUILD_REPORT.md",
  "docs/IDEATION.md",
  "docs/DEMO_SCRIPT.md",
  "docs/SUBMISSION_CHECKLIST.md",
];
for (const file of forbiddenDocs) check(`private-doc-removed:${file}`, !existsSync(path.join(root, file)), `${file} must not be committed`);

const allowedDocs = new Set(["ARCHITECTURE.md", "HACKATHON.md", "HYDRA_QUERIES.md"]);
const unexpectedDocs = readdirSync(path.join(root, "docs"), {withFileTypes: true})
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md") && !allowedDocs.has(entry.name))
  .map((entry) => entry.name);
check("public-doc-allowlist", unexpectedDocs.length === 0, `unexpected docs: ${unexpectedDocs.join(", ") || "none"}`);

const readme = readFileSync(path.join(root, "README.md"), "utf8");
for (const phrase of [
  "Track 02B",
  "Why HydraDB is load-bearing",
  "Product UI",
  "Run with HydraDB OSS",
  "Remotion demo video",
  "Phosphor Icons Web 2.1.2",
  "Attribution",
  "License",
]) {
  check(`readme:${phrase}`, readme.includes(phrase), `README must contain “${phrase}”`);
}

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
check("license:package", packageJson.license === "MIT", "package.json must declare MIT");
check("remotion:package", packageJson.devDependencies?.remotion === "4.0.506", "Remotion must be pinned to 4.0.506");
check("remotion:cli", packageJson.devDependencies?.["@remotion/cli"] === "4.0.506", "@remotion/cli must match Remotion");
check("phosphor:package", packageJson.dependencies?.["@phosphor-icons/web"] === "2.1.2", "@phosphor-icons/web must be pinned to 2.1.2");
check("script:render", typeof packageJson.scripts?.["video:render"] === "string", "video:render must exist");
check("script:live-hydra", typeof packageJson.scripts?.["verify:hydra"] === "string", "verify:hydra must exist");

const uiHtml = readFileSync(path.join(root, "public/index.html"), "utf8");
const uiTokens = readFileSync(path.join(root, "public/tokens.css"), "utf8");
const uiCss = readFileSync(path.join(root, "public/styles.css"), "utf8");
const uiGraphCss = readFileSync(path.join(root, "public/graph.css"), "utf8");
const uiStyleSheets = `${uiCss}\n${uiGraphCss}`;
const uiJs = readFileSync(path.join(root, "public/app.js"), "utf8");
const serverSource = readFileSync(path.join(root, "src/server.ts"), "utf8");
const vpsCompose = readFileSync(path.join(root, "compose.vps.yml"), "utf8");
const gitignore = readFileSync(path.join(root, ".gitignore"), "utf8");
const hydraServiceBlock = vpsCompose.match(/  hydradb:\n([\s\S]*?)\n  gentether:/)?.[1] ?? "";

check(
  "deploy:env-ignore",
  gitignore.includes(".env.*") && gitignore.includes("!.env.example") && gitignore.includes("!.env.deploy.example"),
  "local deployment environments must be ignored while committed examples remain allowed",
);
check(
  "deploy:private-hydra",
  hydraServiceBlock.includes("expose:") && !/^\s+ports:/m.test(hydraServiceBlock),
  "HydraDB may be exposed to the Docker network but must not publish host ports",
);
check(
  "deploy:fail-closed",
  vpsCompose.includes('REQUIRE_HYDRA: "true"') && vpsCompose.includes("HYDRA_SYNC_ATTEMPTS"),
  "the VPS application must require HydraDB and use bounded startup retries",
);
check(
  "deploy:configurable-bind",
  serverSource.includes('process.env.HOST') && serverSource.includes('|| "0.0.0.0"'),
  "the HTTP bind host must be configurable and container-reachable by default",
);

check(
  "ui:phosphor-icons",
  uiHtml.includes("/vendor/phosphor/src/regular/style.css") && serverSource.includes("@phosphor-icons"),
  "Phosphor Icons must be served locally from the pinned package",
);
check("hallmark:stamp", uiCss.includes("Hallmark · genre:") && uiCss.includes("macrostructure: Workbench"), "CSS must carry the Hallmark macrostructure stamp");
check("hallmark:critique", /Hallmark · pre-emit critique: P[3-5] H[3-5] E[3-5] S[3-5] R[3-5] V[3-5]/.test(uiCss), "all six critique scores must be at least 3");
check("hallmark:tokens", uiTokens.includes("oklch(") && uiTokens.includes("--font-display") && uiTokens.includes("--space-4xl"), "tokens.css must contain OKLCH, typography, and spacing tokens");
check("hallmark:locked-colors", !/(#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\()/i.test(uiStyleSheets), "component styles must reference named colour tokens instead of literal colours");
const hardCodedFontFamilies = [...uiStyleSheets.matchAll(/font-family:\s*([^;]+);/gi)]
  .map((match) => match[1]?.trim() ?? "")
  .filter((value) => value.length > 0 && !value.startsWith("var("));
check(
  "hallmark:locked-fonts",
  hardCodedFontFamilies.length === 0,
  `hard-coded font declarations: ${hardCodedFontFamilies.join(", ") || "none"}`,
);
check("hallmark:no-italic-heads", !/h[1-6][^{]*\{[^}]*font-style:\s*italic/is.test(uiStyleSheets), "display headings must remain roman");
check("hallmark:root-clip", /html,\s*\nbody\s*\{[^}]*overflow-x:\s*clip/is.test(uiCss), "html and body must use overflow-x: clip");
check("hallmark:no-root-hidden", !/overflow-x:\s*hidden/i.test(uiStyleSheets), "overflow-x: hidden is forbidden because it breaks sticky descendants");
check("hallmark:display-wrap", /h1,\s*\nh2,\s*\nh3[\s\S]*overflow-wrap:\s*anywhere/i.test(uiCss), "display headings must wrap long words safely");
check("hallmark:mobile-320", uiCss.includes("25.875rem") && uiCss.includes("48rem"), "responsive rules must cover 320–414 and 768 pixel widths");
check("hallmark:clickable-one-line", uiCss.includes("white-space: nowrap") && uiCss.includes(".scenario-tab"), "primary clickable labels must stay on one line");
check("hallmark:reveal-once", uiJs.includes("IntersectionObserver") && uiJs.includes("observer.unobserve"), "scroll motion must reveal once through IntersectionObserver");
check("hallmark:no-scroll-listener", !/addEventListener\(["']scroll["']/i.test(uiJs), "scroll event listeners are forbidden");
check("hallmark:no-parallax", !/(data-parallax|parallax-y|requestScrollUpdate)/i.test(`${uiHtml}\n${uiStyleSheets}\n${uiJs}`), "parallax and scroll-scrubbed motion are forbidden");
check("hallmark:reduced-motion", uiCss.includes("@media (prefers-reduced-motion: reduce)"), "motion must include a reduced-motion path");
check("hallmark:no-fullscreen-sentence", !/min-height:\s*(?:100vh|100svh)/i.test(uiStyleSheets), "do not use a full-screen hero with one centred sentence");
check("hallmark:no-ad-hoc-z", !/z-index:\s*(?:999|9999|99999)/i.test(uiStyleSheets), "z-index must use the named scale");
check(
  "ui:no-css-gradients",
  !/(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\s*\(/i.test(uiStyleSheets),
  "the product UI must use flat surfaces rather than CSS gradients",
);
check(
  "ui:no-status-dots",
  !/(engine-dot|tab-dot|pulsing-dot|pulse-indicator)/i.test(`${uiHtml}\n${uiStyleSheets}\n${uiJs}`),
  "status and tab states must use meaningful icons instead of decorative dots",
);
check("ui:no-pill-overuse", !/border-radius:\s*999px/i.test(uiStyleSheets), "the UI must not rely on pill-shaped controls");

try {
  execFileSync(process.execPath, ["--check", "public/app.js"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  checks.push({name: "ui:javascript-syntax", ok: true, detail: "public/app.js parses successfully"});
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  failures.push(`ui:javascript-syntax: ${detail}`);
  checks.push({name: "ui:javascript-syntax", ok: false, detail});
}

const videoData = readFileSync(path.join(root, "video/data.ts"), "utf8");
const fpsMatch = videoData.match(/export const FPS = (\d+)/);
const frameMatches = [...videoData.matchAll(/durationInFrames:\s*(\d+)/g)];
const fps = Number(fpsMatch?.[1] ?? 0);
const totalFrames = frameMatches.reduce((sum, match) => sum + Number(match[1]), 0);
const durationSeconds = fps > 0 ? totalFrames / fps : Infinity;
check("video:fps", fps > 0, "video FPS must be parseable");
check("video:scenes", frameMatches.length >= 4, "video must contain multiple demo scenes");
check("video:duration", durationSeconds <= 180, `composition is ${durationSeconds.toFixed(1)} seconds; maximum is 180`);

let earliestCommit = "unavailable";
try {
  earliestCommit = execFileSync("git", ["log", "--reverse", "--format=%aI"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .trim()
    .split(/\r?\n/)[0] ?? "";
  if (earliestCommit) {
    check(
      "commit-window",
      Date.parse(earliestCommit) >= Date.parse("2026-08-12T00:00:00Z"),
      `earliest participant-authored commit is ${earliestCommit}`,
    );
  }
} catch {
  checks.push({name: "commit-window", ok: null, detail: "git history unavailable outside a clone"});
}

const report = {
  verdict: failures.length === 0 ? "repository-audit-passed" : "repository-audit-failed",
  checkedAt: new Date().toISOString(),
  videoDurationSeconds: Number.isFinite(durationSeconds) ? Number(durationSeconds.toFixed(1)) : null,
  earliestCommit,
  checks,
  failures,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
