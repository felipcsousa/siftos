import { randomBytes } from "node:crypto";
import { mkdirSync, openSync, renameSync, rmSync, writeFileSync, closeSync, fsyncSync } from "node:fs";
import path from "node:path";

/**
 * Atomic persistence (NFR-010, PRD §26): write to a temp file in the same
 * directory, fsync, then rename over the target. A crash never leaves a
 * partially written PDR at the destination.
 */
export function writeFileAtomic(dir: string, fileName: string, content: string): string {
  mkdirSync(dir, { recursive: true });
  const tmp = path.join(
    dir,
    `.${fileName}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`,
  );
  const target = path.join(dir, fileName);

  try {
    const fd = openSync(tmp, "w", 0o644);
    try {
      writeFileSync(fd, content, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, target);
  } catch (err) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      /* best effort cleanup */
    }
    throw err;
  }
  return target;
}
