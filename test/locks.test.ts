import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { OWNERLESS_LOCK_GRACE_MS, lockOwnerIsGone, tryAcquireLock, type LockOwner, type OwnerProbe } from "../locks.ts";

const START = "Tue Nov  3 16:00:00 2026";

function probe(alive: Record<number, string>): OwnerProbe {
	return {
		isAlive: (pid) => pid in alive,
		processStart: async (pid) => alive[pid],
	};
}

function owner(pid: number, label = "ds4f-q2"): LockOwner {
	return { pid, processStart: START, label, createdAt: Date.now() };
}

async function age(dir: string, ms: number): Promise<void> {
	const when = new Date(Date.now() - ms);
	await utimes(dir, when, when);
}

describe("lockOwnerIsGone", () => {
	it("keeps a lock whose owner is alive, however old", async () => {
		assert.equal(await lockOwnerIsGone(owner(10), 24 * 60 * 60_000, probe({ 10: START })), false);
	});

	it("reclaims a lock whose owner exited or whose pid was reused", async () => {
		assert.equal(await lockOwnerIsGone(owner(10), 0, probe({})), true);
		assert.equal(await lockOwnerIsGone(owner(10), 0, probe({ 10: "Wed Nov  4 09:00:00 2026" })), true);
	});

	it("gives an ownerless lock a grace period", async () => {
		assert.equal(await lockOwnerIsGone(undefined, 1_000, probe({})), false);
		assert.equal(await lockOwnerIsGone(undefined, OWNERLESS_LOCK_GRACE_MS + 1, probe({})), true);
	});
});

describe("tryAcquireLock", () => {
	let root: string;
	before(async () => {
		root = await mkdtemp(join(tmpdir(), "pi-ds4-locks-"));
	});
	after(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("lets one owner hold a target and reports it to the next caller", async () => {
		const dir = join(root, "downloads", "ds4f-q2");
		const first = await tryAcquireLock(dir, owner(10), probe({ 10: START, 11: START }));
		assert.equal(first.acquired, true);
		const second = await tryAcquireLock(dir, owner(11), probe({ 10: START, 11: START }));
		assert.equal(second.acquired, false);
		assert.equal(second.acquired ? undefined : second.owner?.pid, 10);
		if (first.acquired) await first.release();
		await assert.rejects(stat(dir));
	});

	it("does not take over a live owner's lock after a long download", async () => {
		const dir = join(root, "downloads", "glm53-q2");
		const first = await tryAcquireLock(dir, owner(10, "glm53-q2"), probe({ 10: START }));
		assert.equal(first.acquired, true);
		await age(dir, 6 * 60 * 60_000);
		const second = await tryAcquireLock(dir, owner(11, "glm53-q2"), probe({ 10: START, 11: START }));
		assert.equal(second.acquired, false);
		if (first.acquired) await first.release();
	});

	it("takes over a lock left by a process that exited", async () => {
		const dir = join(root, "downloads", "qwen38-q4k");
		await tryAcquireLock(dir, owner(10, "qwen38-q4k"), probe({ 10: START }));
		const next = await tryAcquireLock(dir, owner(11, "qwen38-q4k"), probe({ 11: START }));
		assert.equal(next.acquired, true);
		if (next.acquired) await next.release();
	});

	it("takes over an old lock directory without an owner file", async () => {
		const dir = join(root, "downloads", "ds41f-q2");
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, "owner.json"), "not json", "utf8");
		await age(dir, OWNERLESS_LOCK_GRACE_MS + 5_000);
		const next = await tryAcquireLock(dir, owner(11, "ds41f-q2"), probe({ 11: START }));
		assert.equal(next.acquired, true);
		if (next.acquired) await next.release();
	});

	it("holds independent targets at the same time", async () => {
		const a = await tryAcquireLock(join(root, "downloads", "a"), owner(10, "a"), probe({ 10: START }));
		const b = await tryAcquireLock(join(root, "downloads", "b"), owner(10, "b"), probe({ 10: START }));
		assert.equal(a.acquired && b.acquired, true);
		if (a.acquired) await a.release();
		if (b.acquired) await b.release();
	});
});
