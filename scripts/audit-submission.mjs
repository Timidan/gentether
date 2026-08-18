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
  "public/styles.css",
  "public/app.js",
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
  "Run with HydraDB OSS",
  "Remotion demo video",
  "Attribution",
  "License",
]) {
  check(`readme:${phrase}`, readme.includes(phrase), `README must contain “${phrase}”`);
}

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
check("license:package", packageJson.license === "MIT", "package.json must declare MIT");
check("remotion:package", packageJson.devDependencies?.remotion === "4.0.506", "Remotion must be pinned to 4.0.506");
check("remotion:cli", packageJson.devDependencies?.["@remotion/cli"] === "4.0.506", "@remotion/cli must match Remotion");
check("script:render", typeof packageJson.scripts?.["video:render"] === "string", "video:render must exist");
check("script:live-hydra", typeof packageJson.scripts?.["verify:hydra"] === "string", "verify:hydra must exist");

const uiHtml = readFileSync(path.join(root, "public/index.html"), "utf8");
const uiCss = readFileSync(path.join(root, "public/styles.css"), "utf8");
const uiJs = readFileSync(path.join(root, "public/app.js"), "utf8");
check(
  "ui:phosphor-icons",
  uiHtml.includes("@phosphor-icons/web@2.1.2"),
  "Phosphor Icons must be pinned to @phosphor-icons/web@2.1.2",
);
check(
  "ui:no-css-gradients",
  !/(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\s*\(/i.test(uiCss),
  "the product UI must use flat surfaces rather than CSS gradients",
);
check(
  "ui:no-status-dots",
  !/(engine-dot|tab-dot|pulsing-dot|pulse-indicator)/i.test(`${uiHtml}\n${uiCss}\n${uiJs}`),
  "status and tab states must use meaningful icons instead of decorative dots",
);
check("ui:no-pill-overuse", !/border-radius:\s*999px/i.test(uiCss), "the UI must not rely on pill-shaped controls");
check(
  "ui:cinematic-scroll",
  uiJs.includes("IntersectionObserver") && uiJs.includes("data-parallax") && uiJs.includes("scroll-progress"),
  "scroll reveal, parallax, and document progress behavior must be present",
);
check(
  "ui:reduced-motion",
  uiCss.includes("@media (prefers-reduced-motion: reduce)"),
  "cinematic motion must include a reduced-motion path",
);
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
