// Cross-process locks for long-running work such as model downloads.
//
// A lock is a directory with an owner.json file. Unlike the short lifecycle
// lock in index.ts, these locks are held for hours, so a lock whose owner
// process is still alive is never treated as stale.

import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { errorCode, isJsonObject } from "./guards.ts";

export type LockOwner = {
	pid: number;
	processStart: string;
	label: string;
	createdAt: number;
};

export type OwnerProbe = {
	isAlive: (pid: number) => boolean;
	processStart: (pid: number) => Promise<string | undefined>;
};

// The owner file is written right after the lock directory is created. A lock
// without a readable owner older than this is left over from a crash.
export const OWNERLESS_LOCK_GRACE_MS = 60_000;

export type LockAttempt =
	| { acquired: true; release: () => Promise<void> }
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

function ownerFromJson(value: unknown): Partial<LockOwner> | undefined {
	if (!isJsonObject(value)) return undefined;
	const owner: Partial<LockOwner> = {};
	if (typeof value["pid"] === "number") owner.pid = value["pid"];
	if (typeof value["processStart"] === "string") owner.processStart = value["processStart"];
	if (typeof value["label"] === "string") owner.label = value["label"];
	if (typeof value["createdAt"] === "number") owner.createdAt = value["createdAt"];
	return owner;
}

async function readOwner(lockDir: string): Promise<Partial<LockOwner> | undefined> {
	try {
		return ownerFromJson(JSON.parse(await readFile(join(lockDir, "owner.json"), "utf8")));
		// oxlint-disable-next-line preserve-caught-error -- A missing or malformed owner file means the owner is unknown.
	} catch {
		return undefined;
	}
}

async function lockAgeMs(lockDir: string): Promise<number> {
	// oxlint-disable-next-line 2h2d/require-promise-rejection-parameter -- A lock directory that cannot be read counts as infinitely old.
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
		} catch (error) {
			if (errorCode(error) !== "EEXIST") throw error;
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
