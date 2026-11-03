import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
	ADDONS,
	ADDONS_BY_KEY,
	DOWNLOADABLE_MODELS,
	GIB,
	addonAvailableOnPlatform,
	artifactSizes,
	contextTokensFor,
	downloadScriptMentionsTarget,
	expectedModelFiles,
	expectedTotalBytes,
	modelForKey,
	powerPercentFor,
	ramRequirementText,
	serverStartLabel,
	shellVariable,
	speculativeArgs,
	speculativeModeFor,
	ssdStreamingFor,
	thinkingLevelMapFor,
	type ModelKey,
	type ServerStartPlan,
} from "../catalog.ts";

const RAM_128_GIB = 128 * GIB;
const RAM_512_GIB = 512 * GIB;
const DEFAULT_CONTEXT = 393_216;

function context(key: ModelKey, options: { configured?: number; explicit?: boolean; streaming?: boolean } = {}) {
	return contextTokensFor(modelForKey(key), {
		configured: options.configured ?? DEFAULT_CONTEXT,
		explicit: options.explicit ?? false,
		streaming: options.streaming ?? false,
	});
}

function speculative(key: ModelKey, options: { enabled?: boolean; streaming?: boolean; addons?: string[] } = {}) {
	return speculativeModeFor(modelForKey(key), {
		enabled: options.enabled ?? true,
		streaming: options.streaming ?? false,
		installedAddons: new Set(options.addons ?? []),
	});
}

describe("catalogue", () => {
	it("uses unique model keys and resolvable add-on references", () => {
		assert.equal(new Set(DOWNLOADABLE_MODELS.map((model) => model.key)).size, DOWNLOADABLE_MODELS.length);
		assert.equal(new Set(ADDONS.map((addon) => addon.key)).size, ADDONS.length);
		for (const model of DOWNLOADABLE_MODELS) {
			if (model.visionEncoder) assert.equal(ADDONS_BY_KEY.get(model.visionEncoder)?.kind, "vision", model.key);
			if (model.speculative?.kind === "dspark") {
				assert.equal(ADDONS_BY_KEY.get(model.speculative.addon)?.kind, "dspark", model.key);
			}
		}
	});

	it("pairs DeepSeek V4 Flash checkpoints with their own DSpark and vision files", () => {
		assert.deepEqual(modelForKey("dsv4-flash-q2").speculative, { kind: "dspark", addon: "dsv4-flash-dspark" });
		assert.deepEqual(modelForKey("dsv4-flash-vision-q2").speculative, {
			kind: "dspark",
			addon: "dsv4-flash-vision-dspark",
		});
		assert.equal(modelForKey("dsv4-flash-q2").visionEncoder, undefined);
		assert.equal(modelForKey("dsv4-flash-vision-q2q4").visionEncoder, "dsv4-flash-vision");
	});

	it("only offers the DeepSeek V4.1 vision encoder on Metal", () => {
		const v41 = ADDONS_BY_KEY.get("dsv41-flash-vision")!;
		assert.equal(addonAvailableOnPlatform(v41, "darwin"), true);
		assert.equal(addonAvailableOnPlatform(v41, "linux"), false);
		assert.equal(addonAvailableOnPlatform(ADDONS_BY_KEY.get("glm53-flash-vision")!, "linux"), true);
	});
});

describe("ssdStreamingFor", () => {
	it("keeps models that fit in RAM resident on a 128 GiB machine", () => {
		for (const key of ["dsv4-flash-q2", "glm53-flash-q2", "qwen38-flash-q4"] as const) {
			assert.equal(ssdStreamingFor(modelForKey(key), "auto", RAM_128_GIB), false, key);
		}
	});

	it("streams models whose resident weights exceed RAM", () => {
		for (const key of ["dsv41-flash-q2", "glm53-flash-q4", "glm53-full-q2"] as const) {
			assert.equal(ssdStreamingFor(modelForKey(key), "auto", RAM_128_GIB), true, key);
			assert.equal(ssdStreamingFor(modelForKey(key), "auto", RAM_512_GIB), false, key);
		}
	});

	it("never streams Qwen3.8, which has no upstream streaming path", () => {
		assert.equal(ssdStreamingFor(modelForKey("qwen38-flash-q2"), "on", RAM_128_GIB), false);
		assert.equal(ssdStreamingFor(modelForKey("glm53-flash-q2"), "on", RAM_128_GIB), true);
	});
});

describe("contextTokensFor", () => {
	it("caps Qwen3.8 at its native context even when configured explicitly", () => {
		assert.equal(context("qwen38-flash-q4"), 262_144);
		assert.equal(context("qwen38-flash-q4", { explicit: true }), 262_144);
		assert.equal(context("qwen38-flash-q4", { configured: 65_536, explicit: true }), 65_536);
	});

	it("starts GLM 5.3 Flash Q2 with a modest context unless configured explicitly", () => {
		assert.equal(context("glm53-flash-q2"), 131_072);
		assert.equal(context("glm53-flash-q2", { explicit: true }), DEFAULT_CONTEXT);
	});

	it("applies the streaming context limit only to unconfigured streaming runs", () => {
		assert.equal(context("glm53-flash-q4", { streaming: true }), 65_536);
		assert.equal(context("glm53-flash-q4", { streaming: false }), DEFAULT_CONTEXT);
		assert.equal(context("glm53-flash-q4", { streaming: true, explicit: true }), DEFAULT_CONTEXT);
		assert.equal(context("dsv41-flash-q2", { streaming: true }), 131_072);
	});

	it("keeps the GLM 5.2 limit and the configured default elsewhere", () => {
		assert.equal(context("glm52-q2"), 202_752);
		assert.equal(context("dsv4-flash-q2"), DEFAULT_CONTEXT);
	});
});

describe("powerPercentFor", () => {
	it("honors the configured power only for the DeepSeek V4 graph", () => {
		assert.equal(powerPercentFor(modelForKey("dsv4-flash-q2"), 70), 70);
		assert.equal(powerPercentFor(modelForKey("dsv4-flash-vision-q2"), 70), 70);
		assert.equal(powerPercentFor(modelForKey("dsv4-pro-q2"), 70), 70);
		for (const key of ["dsv41-flash-q2", "glm52-q2", "glm53-flash-q2", "glm53-full-q2", "qwen38-flash-q2"] as const) {
			assert.equal(powerPercentFor(modelForKey(key), 70), 100, key);
		}
	});
});

describe("speculative decoding", () => {
	it("is off unless enabled", () => {
		assert.equal(speculative("glm53-flash-q2", { enabled: false }), undefined);
		assert.deepEqual(speculativeArgs(undefined, undefined), []);
	});

	it("uses embedded MTP for GLM 5.3 Flash and Qwen3.8", () => {
		for (const key of ["glm53-flash-q2", "glm53-flash-q4", "qwen38-flash-q2", "qwen38-flash-q4"] as const) {
			assert.deepEqual(speculativeArgs(speculative(key), undefined), ["--mtp"], key);
		}
		assert.deepEqual(speculativeArgs(speculative("glm53-flash-q4", { streaming: true }), undefined), ["--mtp"]);
	});

	it("uses DSpark only with a downloaded support file and a resident model", () => {
		const path = "/models/DeepSeek-V4-Flash-DSpark-support-0731.gguf";
		const mode = speculative("dsv4-flash-q2", { addons: ["dsv4-flash-dspark"] });
		assert.deepEqual(speculativeArgs(mode, path), ["--dspark", "--mtp-model", path]);
		assert.equal(speculative("dsv4-flash-q2"), undefined);
		assert.equal(speculative("dsv4-flash-q2", { addons: ["dsv4-flash-dspark"], streaming: true }), undefined);
		assert.equal(speculative("dsv4-flash-vision-q2", { addons: ["dsv4-flash-dspark"] }), undefined);
	});

	it("leaves models without a downloadable draft untouched", () => {
		for (const key of ["dsv41-flash-q2", "glm52-q2", "glm53-full-q2", "dsv4-pro-q2"] as const) {
			assert.equal(speculative(key, { addons: ADDONS.map((addon) => addon.key) }), undefined, key);
		}
	});
});

describe("thinkingLevelMapFor", () => {
	it("sends numeric efforts to DeepSeek V4.1", () => {
		const map = thinkingLevelMapFor(modelForKey("dsv41-flash-q2"));
		assert.equal(map.off, "none");
		assert.equal(map.low, "25");
		assert.equal(map.medium, "50");
		assert.equal(map.high, "high");
		assert.equal(map.max, "max");
	});

	it("sends Qwen3.8 its distinct low and medium levels", () => {
		const map = thinkingLevelMapFor(modelForKey("qwen38-flash-q2"));
		assert.equal(map.low, "low");
		assert.equal(map.medium, "medium");
		assert.equal(map.max, null);
	});

	it("keeps DeepSeek V4 and GLM to high and max", () => {
		for (const key of ["dsv4-flash-q2", "glm53-flash-q2", "glm52-q2"] as const) {
			const map = thinkingLevelMapFor(modelForKey(key));
			assert.equal(map.low, null, key);
			assert.equal(map.high, "high", key);
			assert.equal(map.max, "max", key);
		}
	});
});

describe("download_model.sh parsing", () => {
	const script = [
		'DS41_Q4_FILE="DeepSeek-V4.1-Flash-Q4.gguf"',
		'GLM_UNSLOTH_Q4_LOCAL_BASE="GLM-5.2-UD-Q4_K_XL"',
		'QWEN38_Q2_FILE="Qwen3.8-Flash-Next-Q2.gguf"',
		"case \"$MODEL\" in",
		"    qwen38-q2|qwen38-iq2)",
		"    ds41f-q4)",
		"esac",
		"artifact_identity() {",
		'        "$QWEN38_Q2_FILE")',
		"            expected_bytes=147207127040",
		'        "$DS41_Q4_FILE.part1")',
		"            expected_bytes=480000000000",
		"}",
	].join("\n");

	it("resolves file variables, shards and declared sizes", () => {
		assert.equal(shellVariable(script, "QWEN38_Q2_FILE"), "Qwen3.8-Flash-Next-Q2.gguf");
		assert.deepEqual(expectedModelFiles(script, modelForKey("qwen38-flash-q2")), ["Qwen3.8-Flash-Next-Q2.gguf"]);
		const shards = expectedModelFiles(script, modelForKey("glm52-q4-xl"));
		assert.equal(shards.length, 11);
		assert.equal(shards[10], "GLM-5.2-UD-Q4_K_XL-00011-of-00011.gguf");
		assert.equal(artifactSizes(script).get("DeepSeek-V4.1-Flash-Q4.gguf.part1"), 480_000_000_000);
		assert.equal(expectedTotalBytes(script, ["Qwen3.8-Flash-Next-Q2.gguf"]), 147_207_127_040);
		assert.equal(expectedTotalBytes(script, ["missing.gguf"], 42), 42);
	});

	it("detects download targets including aliases", () => {
		assert.equal(downloadScriptMentionsTarget(script, "qwen38-q2"), true);
		assert.equal(downloadScriptMentionsTarget(script, "qwen38-iq2"), true);
		assert.equal(downloadScriptMentionsTarget(script, "glm53-q2"), false);
	});
});

// Checks the catalogue against a real antirez/ds4 checkout. Point
// DS4_DOWNLOAD_SCRIPT at its download_model.sh, or install pi-ds4 so the
// managed checkout exists under ~/.pi/ds4/support.
const upstreamScriptPath =
	process.env.DS4_DOWNLOAD_SCRIPT ?? join(homedir(), ".pi", "ds4", "support", "download_model.sh");
const upstreamScript = existsSync(upstreamScriptPath) ? readFileSync(upstreamScriptPath, "utf8") : undefined;

describe("upstream download_model.sh", { skip: upstreamScript ? false : `no script at ${upstreamScriptPath}` }, () => {
	it("provides every model target and file name", () => {
		for (const model of DOWNLOADABLE_MODELS) {
			assert.equal(downloadScriptMentionsTarget(upstreamScript!, model.target), true, model.target);
			assert.notDeepEqual(expectedModelFiles(upstreamScript!, model), [], model.key);
		}
	});

	it("has an exact size for every single-file download", () => {
		const declared = artifactSizes(upstreamScript!);
		for (const item of [...DOWNLOADABLE_MODELS, ...ADDONS]) {
			if ("shardCount" in item && item.shardCount) continue;
			const files = "fileVariable" in item && item.fileVariable ? [shellVariable(upstreamScript!, item.fileVariable)!] : [];
			const known = files.every((file) => declared.has(file));
			assert.ok(known || (item.downloadBytes ?? 0) > 0, item.key);
		}
	});

	it("provides every add-on target and file name", () => {
		for (const addon of ADDONS) {
			assert.equal(downloadScriptMentionsTarget(upstreamScript!, addon.target), true, addon.target);
			assert.ok(shellVariable(upstreamScript!, addon.fileVariable), addon.key);
		}
	});
});

describe("serverStartLabel", () => {
	const plan = (overrides: Partial<ServerStartPlan> = {}): ServerStartPlan => ({
		streaming: false,
		contextTokens: 1024 ** 2,
		vision: false,
		powerPercent: 100,
		totalMemoryBytes: RAM_128_GIB,
		...overrides,
	});

	it("gives every model a unique name and a RAM requirement", () => {
		assert.equal(new Set(DOWNLOADABLE_MODELS.map((model) => model.name)).size, DOWNLOADABLE_MODELS.length);
		for (const model of DOWNLOADABLE_MODELS) {
			assert.match(ramRequirementText(model), /^≥\d+ GB RAM( or SSD streaming)?$/, model.key);
		}
	});

	it("shows the requirement and a resident start with its features", () => {
		assert.equal(
			serverStartLabel(
				modelForKey("dsv4-flash-q2"),
				plan({ vision: true, speculative: { kind: "dspark", addon: "dsv4-flash-dspark" }, powerPercent: 50 }),
			),
			"DeepSeek V4 Flash · Q2 imatrix — needs ≥96 GB RAM; starts resident, 1M context, vision, DSpark speculative decoding, 50% power",
		);
	});

	it("shows an SSD streaming start for a model larger than RAM", () => {
		assert.equal(
			serverStartLabel(modelForKey("dsv41-flash-q2"), plan({ streaming: true, contextTokens: 131_072 })),
			"DeepSeek V4.1 Flash · Q2 — needs ≥192 GB RAM or SSD streaming; starts with SSD streaming, 128K context",
		);
	});

	it("marks models without SSD streaming and warns when RAM is short", () => {
		assert.equal(
			serverStartLabel(modelForKey("qwen38-flash-q2"), plan({ contextTokens: 262_144, speculative: { kind: "mtp" } })),
			"Qwen3.8 Flash Next · Q2 — needs ≥64 GB RAM, no SSD streaming; starts resident, 256K context, MTP speculative decoding",
		);
		assert.equal(
			serverStartLabel(modelForKey("glm52-q4"), plan({ contextTokens: 202_752 })),
			"GLM 5.2 · Q4 — needs ≥512 GB RAM; starts resident, 198K context — needs more RAM than this machine's 128 GB",
		);
		assert.doesNotMatch(serverStartLabel(modelForKey("dsv4-flash-q2q4"), plan()), /more RAM/);
	});
});
