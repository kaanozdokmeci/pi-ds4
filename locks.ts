// Cross-process locks for long-running work such as model downloads.
//
// A lock is a directory with an owner.json file. Unlike the short lifecycle
// lock in index.ts, these locks are held for hours, so a lock whose owner
// process is still alive is never treated as stale.

import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type LockOwner = {
	pid: number;
	processStart: string;
	label: string;
	createdAt: number;
};

export type OwnerProbe = {
	isAlive(pid: number): boolean;
	processStart(pid: number): Promise<string | undefined>;
};

// The owner file is written right after the lock directory is created. A lock
// without a readable owner older than this is left over from a crash.
export const OWNERLESS_LOCK_GRACE_MS = 60_000;

export type LockAttempt =
	| { acquired: true; release(): Promise<void> }
	| { acquired: false; owner: Partial<LockOwner> | undefined };

export async function lockOwnerIsGone(
	owner: Partial<LockOwner> | undefined,
	lockAgeMs: number,
	probe: OwnerProbe,
): Promise<boolean> {
	if (typeof owner?.pid !== "number") return lockAgeMs > OWNERLESS_LOCK_GRACE_MS;
	if (!probe.isAlive(owner.pid)) return true;
	// A reused pid belongs to a different process start time.
	if (owner.processStart && owner.processStart !== "unknown") {
		const current = await probe.processStart(owner.pid);
		if (current && current !== owner.processStart) return true;
	}
	return false;
}

async function readOwner(lockDir: string): Promise<Partial<LockOwner> | undefined> {
	try {
		const parsed = JSON.parse(await readFile(join(lockDir, "owner.json"), "utf8"));
		return parsed && typeof parsed === "object" ? (parsed as Partial<LockOwner>) : undefined;
	} catch {
		return undefined;
	}
}

async function lockAgeMs(lockDir: string): Promise<number> {
	const info = await stat(lockDir).catch(() => undefined);
	return info ? Date.now() - info.mtimeMs : Number.POSITIVE_INFINITY;
}

// Takes the lock without waiting. When another live process holds it, the
// result names that owner so callers can report who is doing the work.
export async function tryAcquireLock(lockDir: string, owner: LockOwner, probe: OwnerProbe): Promise<LockAttempt> {
	await mkdir(dirname(lockDir), { recursive: true });
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			await mkdir(lockDir);
		} catch (error: any) {
			if (error?.code !== "EEXIST") throw error;
			const current = await readOwner(lockDir);
			if (await lockOwnerIsGone(current, await lockAgeMs(lockDir), probe)) {
				await rm(lockDir, { recursive: true, force: true });
				continue;
			}
			return { acquired: false, owner: current };
		}
		const tmp = join(lockDir, `owner.json.${process.pid}.tmp`);
		await writeFile(tmp, `${JSON.stringify(owner, null, 2)}\n`, "utf8");
		await rename(tmp, join(lockDir, "owner.json"));
		return {
			acquired: true,
			release: () => rm(lockDir, { recursive: true, force: true }),
		};
	}
	return { acquired: false, owner: await readOwner(lockDir) };
}
