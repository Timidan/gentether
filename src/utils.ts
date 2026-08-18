import { createHash } from "node:crypto";
import path from "node:path";

export function stableId(value: string): number {
  // HydraDB requires non-negative integer ids. Thirteen hex digits stay within
  // JavaScript's exact-integer range while remaining deterministic.
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 13);
  return Number.parseInt(hex, 16);
}

export function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

export function normalizeRepoPath(value: string): string {
  return toPosix(value).replace(/^\.\//, "").replace(/^\/+/, "");
}

export function uniqueBy<T>(items: T[], key: (item: T) => string | number): T[] {
  const seen = new Set<string | number>();
  return items.filter((item) => {
    const candidate = key(item);
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
}

export function escapeMarkdown(value: string): string {
  return value.replaceAll("`", "\\`");
}

export function severity(decision: "ALLOW" | "REVIEW" | "BLOCK"): number {
  return decision === "BLOCK" ? 3 : decision === "REVIEW" ? 2 : 1;
}
