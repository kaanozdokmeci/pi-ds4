// Model catalogue and per-model runtime rules for pi-ds4.
//
// This module is pure: it touches neither the filesystem nor Pi, so the rules
// that decide ds4-server arguments can be tested with `node --test`.

export const GIB = 1024 ** 3;
export const GB = 1000 ** 3;

// Weights are not the only resident allocation: context, runtime buffers and
// the OS need room too. Models whose weights exceed this share of system RAM
// are started with SSD streaming instead of full residency.
export const RESIDENT_RAM_FRACTION = 0.9;

export type ModelKey =
	| "dsv4-flash-q2"
	| "dsv4-flash-q2q4"
	| "dsv4-flash-q4"
	| "dsv4-flash-vision-q2"
	| "dsv4-flash-vision-q2q4"
	| "dsv41-flash-q2"
	| "dsv41-flash-q4"
	| "dsv4-pro-q2"
	| "glm53-flash-q2"
	| "glm53-flash-q4"
	| "glm53-full-q2"
	| "glm52-q4-xl"
	| "glm52-iq2xxs"
	| "glm52-q2"
	| "glm52-q4"
	| "qwen38-flash-q2"
	| "qwen38-flash-q4";

// The model family selects upstream behavior that differs between models:
// thinking-effort rendering, --power support, and speculative decoding.
export type ModelFamily = "dsv4" | "dsv41" | "glm52" | "glm53" | "qwen38";

// ds4 speculative decoding. "mtp" uses the draft block embedded in the main
// GGUF (--mtp). "dspark" needs a separate support GGUF, listed as an add-on,
// and only works while the main model is resident.
export type SpeculativeSupport = { kind: "mtp" } | { kind: "dspark"; addon: string };

export type DownloadableModel = {
	key: ModelKey;
	family: ModelFamily;
	target: string;
	fileVariable?: string;
	shardedBaseVariable?: string;
	shardCount?: number;
	name: string;
	menuLabel: string;
	// Hard context ceiling of the model itself. Configuration cannot exceed it.
	contextLimit?: number;
	// Default context ceiling for memory reasons. An explicit contextTokens
	// setting overrides it.
	defaultContextLimit?: number;
	maxTokens?: number;
	// Weights that have to stay in memory for a resident run. This is not the
	// download size: DeepSeek V4.1 keeps its Engram tables on disk and reads
	// rows as needed, so its GGUF is far larger than its resident footprint.
	residentBytes?: number;
	// Context ceiling applied when the model runs with SSD streaming, unless
	// contextTokens is configured explicitly. Streaming machines are memory
	// constrained and a huge context shrinks the routed-expert cache.
	streamingContextLimit?: number;
	// False when upstream has no SSD streaming path for the model.
	ssdStreamingSupported?: boolean;
	// Add-on key of the vision encoder. Images work once the encoder GGUF is
	// downloaded and ds4-server is started with --vision.
	visionEncoder?: string;
	speculative?: SpeculativeSupport;
	// Approximate download size, used for the progress bar when upstream does
	// not declare an exact size in download_model.sh's artifact_identity().
	downloadBytes?: number;
};

export type AddonKind = "vision" | "dspark";

// Optional GGUFs that extend an already downloaded language model. They never
// replace ./ds4flash.gguf.
export type Addon = {
	key: string;
	kind: AddonKind;
	target: string;
	fileVariable: string;
	name: string;
	menuLabel: string;
	// Upstream refuses to load the add-on on other backends.
	metalOnly?: boolean;
	downloadBytes?: number;
};

export const ADDONS: Addon[] = [
	{
		key: "dsv41-flash-vision",
		kind: "vision",
		target: "ds41f-vision",
		fileVariable: "DS41_VISION_FILE",
		name: "DeepSeek V4.1 Flash vision encoder",
		menuLabel: "DeepSeek V4.1 Flash / vision encoder \u2014 about 0.9 GiB; adds image input on Metal",
		metalOnly: true,
	},
	{
		key: "dsv4-flash-vision",
		kind: "vision",
		target: "ds4f-vision-encoder",
		fileVariable: "DS4F_VISION_ENCODER_FILE",
		name: "DeepSeek V4 Flash Vision Experimental encoder",
		menuLabel:
			"DeepSeek V4 Flash Vision Experimental / vision encoder \u2014 about 0.9 GiB; included with the Vision Experimental models",
		downloadBytes: 0.9 * GIB,
	},
	{
		key: "glm53-flash-vision",
		kind: "vision",
		target: "glm53-vision",
		fileVariable: "GLM53_VISION_FILE",
		name: "GLM 5.3 Flash vision encoder",
		menuLabel: "GLM 5.3 Flash / vision encoder \u2014 about 1.1 GB; adds image input",
		downloadBytes: 1.1 * GB,
	},
	{
		key: "qwen38-flash-vision",
		kind: "vision",
		target: "qwen38-vision",
		fileVariable: "QWEN38_VISION_FILE",
		name: "Qwen3.8 Flash Next vision encoder",
		menuLabel: "Qwen3.8 Flash Next / vision encoder \u2014 about 0.6 GB; adds image input",
		downloadBytes: 0.6 * GB,
	},
	{
		key: "dsv4-flash-dspark",
		kind: "dspark",
		target: "ds4f-dspark",
		fileVariable: "DS4F_DSPARK_FILE",
		name: "DeepSeek V4 Flash DSpark support",
		menuLabel:
			"DeepSeek V4 Flash / DSpark speculative decoding \u2014 about 6 GB; used with speculativeDecoding",
		downloadBytes: 6 * GB,
	},
	{
		key: "dsv4-flash-vision-dspark",
		kind: "dspark",
		target: "ds4f-vision-dspark",
		fileVariable: "DS4F_VISION_DSPARK_FILE",
		name: "DeepSeek V4 Flash Vision Experimental DSpark support",
		menuLabel:
			"DeepSeek V4 Flash Vision Experimental / DSpark speculative decoding \u2014 about 5.6 GiB; used with speculativeDecoding",
		downloadBytes: 5.6 * GIB,
	},
];

const FLASH_0731_DSPARK: SpeculativeSupport = { kind: "dspark", addon: "dsv4-flash-dspark" };
const FLASH_VISION_DSPARK: SpeculativeSupport = { kind: "dspark", addon: "dsv4-flash-vision-dspark" };
const EMBEDDED_MTP: SpeculativeSupport = { kind: "mtp" };

export const DOWNLOADABLE_MODELS: DownloadableModel[] = [
	{
		key: "dsv4-flash-q2",
		family: "dsv4",
		target: "ds4f-q2",
		fileVariable: "DS4F_Q2_FILE",
		name: "DeepSeek V4 Flash · Q2 imatrix",
		menuLabel: "DeepSeek V4 Flash / Q2 imatrix — about 81 GB; ≥96 GB RAM",
		speculative: FLASH_0731_DSPARK,
		downloadBytes: 81 * GB,
	},
	{
		key: "dsv4-flash-q2q4",
		family: "dsv4",
		target: "ds4f-q2-q4",
		fileVariable: "DS4F_Q2_Q4_FILE",
		name: "DeepSeek V4 Flash · Q2/Q4 imatrix",
		menuLabel: "DeepSeek V4 Flash / Q2-Q4 imatrix — about 98 GB; ≥128 GB RAM",
		speculative: FLASH_0731_DSPARK,
		downloadBytes: 98 * GB,
	},
	{
		key: "dsv4-flash-q4",
		family: "dsv4",
		target: "ds4f-q4",
		fileVariable: "DS4F_Q4_FILE",
		name: "DeepSeek V4 Flash · Q4 imatrix",
		menuLabel: "DeepSeek V4 Flash / Q4 imatrix — about 153 GB; ≥256 GB RAM",
		speculative: FLASH_0731_DSPARK,
		downloadBytes: 153 * GB,
	},
	{
		key: "dsv4-flash-vision-q2",
		family: "dsv4",
		target: "ds4f-vision-q2",
		fileVariable: "DS4F_VISION_Q2_FILE",
		name: "DeepSeek V4 Flash Vision Experimental · Q2",
		menuLabel: "DeepSeek V4 Flash Vision Experimental / Q2 — about 81 GiB plus encoder; ≥96 GB RAM",
		visionEncoder: "dsv4-flash-vision",
		speculative: FLASH_VISION_DSPARK,
		downloadBytes: 81 * GIB,
	},
	{
		key: "dsv4-flash-vision-q2q4",
		family: "dsv4",
		target: "ds4f-vision-q2-q4",
		fileVariable: "DS4F_VISION_Q2_Q4_FILE",
		name: "DeepSeek V4 Flash Vision Experimental · Q2/Q4",
		menuLabel: "DeepSeek V4 Flash Vision Experimental / Q2-Q4 — about 91 GiB plus encoder; ≥128 GB RAM",
		visionEncoder: "dsv4-flash-vision",
		speculative: FLASH_VISION_DSPARK,
		downloadBytes: 91 * GIB,
	},
	{
		key: "dsv41-flash-q2",
		family: "dsv41",
		target: "ds41f-q2",
		fileVariable: "DS41_Q2_FILE",
		name: "DeepSeek V4.1 Flash · Q2",
		menuLabel: "DeepSeek V4.1 Flash / Q2 — 341 GiB on disk, 152 GiB resident; ≥192 GB RAM or SSD streaming",
		residentBytes: 152 * GIB,
		streamingContextLimit: 131_072,
		visionEncoder: "dsv41-flash-vision",
	},
	{
		key: "dsv41-flash-q4",
		family: "dsv41",
		target: "ds41f-q4",
		fileVariable: "DS41_Q4_FILE",
		name: "DeepSeek V4.1 Flash · Q4",
		menuLabel: "DeepSeek V4.1 Flash / Q4 — 483 GiB on disk, 294 GiB resident; ≥512 GB RAM or SSD streaming",
		residentBytes: 294 * GIB,
		streamingContextLimit: 131_072,
		visionEncoder: "dsv41-flash-vision",
	},
	{
		key: "dsv4-pro-q2",
		family: "dsv4",
		target: "pro-q2-imatrix",
		fileVariable: "PRO_Q2_IMATRIX_FILE",
		name: "DeepSeek V4 Pro · Q2 imatrix",
		menuLabel: "DeepSeek V4 Pro / Q2 imatrix — about 430 GB; ≥512 GB RAM",
		downloadBytes: 430 * GB,
	},
	{
		key: "glm53-flash-q2",
		family: "glm53",
		target: "glm53-q2",
		fileVariable: "GLM53_Q2_FILE",
		name: "GLM 5.3 Flash · Q2",
		menuLabel: "GLM 5.3 Flash / Q2 — about 90 GiB; ≥128 GB RAM",
		// Upstream calls Q2 close to a 128 GB machine's budget and starts it
		// with a modest context; the GLM memory guard refuses oversized ones.
		defaultContextLimit: 131_072,
		residentBytes: 90 * GIB,
		streamingContextLimit: 65_536,
		visionEncoder: "glm53-flash-vision",
		speculative: EMBEDDED_MTP,
		downloadBytes: 90 * GIB,
	},
	{
		key: "glm53-flash-q4",
		family: "glm53",
		target: "glm53-q4",
		fileVariable: "GLM53_Q4_FILE",
		name: "GLM 5.3 Flash · Q4",
		menuLabel: "GLM 5.3 Flash / Q4 — about 178 GiB; ≥256 GB RAM or SSD streaming",
		residentBytes: 178 * GIB,
		streamingContextLimit: 65_536,
		visionEncoder: "glm53-flash-vision",
		speculative: EMBEDDED_MTP,
		downloadBytes: 178 * GIB,
	},
	{
		key: "glm53-full-q2",
		family: "glm53",
		target: "glm53-full-q2",
		fileVariable: "GLM53_FULL_Q2_FILE",
		name: "GLM 5.3 · Q2",
		menuLabel: "GLM 5.3 / IQ2 XXS — about 197 GiB; ≥256 GB RAM or SSD streaming",
		residentBytes: 197 * GIB,
		streamingContextLimit: 65_536,
		downloadBytes: 197 * GIB,
	},
	{
		key: "glm52-q4-xl",
		family: "glm52",
		target: "glm-unsloth-q4",
		shardedBaseVariable: "GLM_UNSLOTH_Q4_LOCAL_BASE",
		shardCount: 11,
		name: "GLM 5.2 · Unsloth Q4 XL",
		menuLabel: "GLM 5.2 / Unsloth Q4 XL — 11 shards; ≥512 GB RAM",
		contextLimit: 202_752,
		maxTokens: 164_000,
	},
	{
		key: "glm52-iq2xxs",
		family: "glm52",
		target: "glm-antirez-iq2xxs",
		fileVariable: "GLM_ANTIREZ_IQ2XXS_FILE",
		name: "GLM 5.2 · IQ2 XXS",
		menuLabel: "GLM 5.2 / IQ2 XXS — about 188 GiB; ≥256 GB RAM",
		downloadBytes: 188 * GIB,
		contextLimit: 202_752,
		maxTokens: 164_000,
	},
	{
		key: "glm52-q2",
		family: "glm52",
		target: "glm-antirez-q2",
		fileVariable: "GLM_ANTIREZ_Q2_FILE",
		name: "GLM 5.2 · Q2",
		menuLabel: "GLM 5.2 / Q2 — about 262 GB; ≥384 GB RAM",
		downloadBytes: 262 * GB,
		contextLimit: 202_752,
		maxTokens: 164_000,
	},
	{
		key: "glm52-q4",
		family: "glm52",
		target: "glm-antirez-q4",
		fileVariable: "GLM_ANTIREZ_Q4_FILE",
		name: "GLM 5.2 · Q4",
		menuLabel: "GLM 5.2 / Q4 — about 434 GB; ≥512 GB RAM",
		downloadBytes: 434 * GB,
		contextLimit: 202_752,
		maxTokens: 164_000,
	},
	{
		key: "qwen38-flash-q2",
		family: "qwen38",
		target: "qwen38-q2",
		fileVariable: "QWEN38_Q2_FILE",
		name: "Qwen3.8 Flash Next · Q2",
		menuLabel: "Qwen3.8 Flash Next / Q2 — 137 GiB on disk, 42 GiB resident; ≥64 GB RAM",
		// Native context. Longer contexts need DS4_QWEN4_YARN_FACTOR upstream.
		contextLimit: 262_144,
		ssdStreamingSupported: false,
		visionEncoder: "qwen38-flash-vision",
		speculative: EMBEDDED_MTP,
	},
	{
		key: "qwen38-flash-q4",
		family: "qwen38",
		target: "qwen38-q4k",
		fileVariable: "QWEN38_Q4_FILE",
		name: "Qwen3.8 Flash Next · Q4",
		menuLabel: "Qwen3.8 Flash Next / Q4 — 165 GiB on disk, 70 GiB resident; ≥128 GB RAM",
		contextLimit: 262_144,
		ssdStreamingSupported: false,
		visionEncoder: "qwen38-flash-vision",
		speculative: EMBEDDED_MTP,
	},
];

export const MODELS_BY_KEY = new Map(DOWNLOADABLE_MODELS.map((model) => [model.key, model]));
export const ADDONS_BY_KEY = new Map(ADDONS.map((addon) => [addon.key, addon]));

export function modelForKey(modelKey: ModelKey): DownloadableModel {
	const model = MODELS_BY_KEY.get(modelKey);
	if (!model) throw new Error(`Unknown ds4 model: ${modelKey}`);
	return model;
}

export function modelKeyForModelId(modelId: string | undefined): ModelKey | undefined {
	return modelId && MODELS_BY_KEY.has(modelId as ModelKey) ? (modelId as ModelKey) : undefined;
}

export function addonForKey(key: string | undefined): Addon | undefined {
	return key ? ADDONS_BY_KEY.get(key) : undefined;
}

export function addonAvailableOnPlatform(addon: Addon, platform: string): boolean {
	return !addon.metalOnly || platform === "darwin";
}

export type SsdStreamingMode = "auto" | "on" | "off";

export function ssdStreamingFor(model: DownloadableModel, mode: SsdStreamingMode, totalMemoryBytes: number): boolean {
	if (model.ssdStreamingSupported === false) return false;
	if (mode !== "auto") return mode === "on";
	// Auto mode only decides for models with a known resident footprint. The
	// others keep the historical behavior of a plain resident run.
	return !!model.residentBytes && model.residentBytes > totalMemoryBytes * RESIDENT_RAM_FRACTION;
}

export type ContextSettings = { configured: number; explicit: boolean; streaming: boolean };

export function contextTokensFor(model: DownloadableModel, settings: ContextSettings): number {
	let limit = Math.min(settings.configured, model.contextLimit ?? settings.configured);
	// An explicit contextTokens setting wins over the memory-driven defaults,
	// but never over the model's own context limit.
	if (!settings.explicit) {
		if (model.defaultContextLimit) limit = Math.min(limit, model.defaultContextLimit);
		if (settings.streaming && model.streamingContextLimit) limit = Math.min(limit, model.streamingContextLimit);
	}
	return limit;
}

// Upstream only throttles the DeepSeek V4 graph. DeepSeek V4.1 and GLM refuse
// to load below 100, and the Qwen graph ignores the setting.
export function powerPercentFor(model: DownloadableModel, configured: number): number {
	return model.family === "dsv4" ? configured : 100;
}

// Which speculative decoding mode ds4-server is started with, if any.
export function speculativeModeFor(
	model: DownloadableModel,
	options: { enabled: boolean; streaming: boolean; installedAddons: ReadonlySet<string> },
): SpeculativeSupport | undefined {
	const support = model.speculative;
	if (!options.enabled || !support) return undefined;
	if (support.kind === "mtp") return support;
	// External DSpark support requires a resident main model.
	if (options.streaming || !options.installedAddons.has(support.addon)) return undefined;
	return support;
}

export function speculativeArgs(mode: SpeculativeSupport | undefined, dsparkPath: string | undefined): string[] {
	if (!mode) return [];
	if (mode.kind === "mtp") return ["--mtp"];
	return dsparkPath ? ["--dspark", "--mtp-model", dsparkPath] : [];
}

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type ThinkingLevelMap = Record<ThinkingLevel, string | null>;

// Values are sent as reasoning_effort. ds4-server maps high and xhigh to
// normal thinking and max to maximum thinking. DeepSeek V4.1 also accepts a
// numeric effort from 1 to 100 (high is 75). Qwen renders low and medium
// differently from high; DeepSeek V4 and GLM do not.
const THINKING_LEVEL_MAPS: Record<ModelFamily, ThinkingLevelMap> = {
	dsv4: { off: "none", minimal: null, low: null, medium: null, high: "high", xhigh: null, max: "max" },
	dsv41: { off: "none", minimal: null, low: "25", medium: "50", high: "high", xhigh: null, max: "max" },
	glm52: { off: "none", minimal: null, low: null, medium: null, high: "high", xhigh: null, max: "max" },
	glm53: { off: "none", minimal: null, low: null, medium: null, high: "high", xhigh: null, max: "max" },
	qwen38: { off: "none", minimal: null, low: "low", medium: "medium", high: "high", xhigh: null, max: null },
};

export function thinkingLevelMapFor(model: DownloadableModel): ThinkingLevelMap {
	return { ...THINKING_LEVEL_MAPS[model.family] };
}

// ---------------------------------------------------------------------------
// download_model.sh parsing
// ---------------------------------------------------------------------------

export function downloadScriptMentionsTarget(script: string, target: string): boolean {
	return (
		script.includes(`${target})`) ||
		script.includes(`${target}|`) ||
		script.includes(`|${target}`) ||
		script.includes(`./download_model.sh ${target}`)
	);
}

export function shellVariable(script: string, name: string): string | undefined {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return script.match(new RegExp(`^${escaped}=["']([^"']+)["']\\s*$`, "m"))?.[1];
}

export function expectedModelFiles(script: string, model: DownloadableModel): string[] {
	if (model.fileVariable) {
		const fileName = shellVariable(script, model.fileVariable);
		return fileName ? [fileName] : [];
	}
	if (model.shardedBaseVariable && model.shardCount) {
		const base = shellVariable(script, model.shardedBaseVariable);
		if (!base) return [];
		return Array.from(
			{ length: model.shardCount },
			(_unused, index) => `${base}-${String(index + 1).padStart(5, "0")}-of-${String(model.shardCount).padStart(5, "0")}.gguf`,
		);
	}
	return [];
}

// Exact artifact sizes live in download_model.sh's artifact_identity(), keyed by
// the same shell variables that name the files. Reading them keeps the progress
// bar correct when upstream reissues a model.
export function artifactSizes(script: string): Map<string, number> {
	const sizes = new Map<string, number>();
	const pattern = /"\$([A-Za-z_][A-Za-z0-9_]*)((?:\.[A-Za-z0-9_]+)*)"\)\s*\n\s*expected_bytes=(\d+)/g;
	for (const match of script.matchAll(pattern)) {
		const base = shellVariable(script, match[1]);
		const bytes = Number(match[3]);
		if (base && Number.isFinite(bytes)) sizes.set(`${base}${match[2]}`, bytes);
	}
	return sizes;
}

export function expectedTotalBytes(script: string, fileNames: string[], fallback?: number): number | undefined {
	const sizes = artifactSizes(script);
	let total = 0;
	for (const name of fileNames) {
		const bytes = sizes.get(name);
		if (!bytes) return fallback;
		total += bytes;
	}
	return total || fallback;
}
