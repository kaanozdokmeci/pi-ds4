import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	type DownloadProgress,
	downloadProgressText,
	downloadRowText,
	downloadsSummaryText,
	formatBytes,
	renderProgressBar,
} from "../progress.ts";

const GIB = 1024 ** 3;

describe("downloadProgressText", () => {
	it("shows a bar, the total and the time left while below the expected size", () => {
		assert.equal(
			downloadProgressText(40 * GIB, 80 * GIB, 100 * 1024 ** 2),
			"[████████░░░░░░░░]  50% 40.0 GiB / 80.0 GiB, 100 MiB/s, 6:50 left",
		);
	});

	it("drops the bar and total once a download outgrows its expected size", () => {
		assert.equal(downloadProgressText(80.4 * GIB, 75.4 * GIB, 107 * 1024 ** 2), "80.4 GiB, 107 MiB/s");
	});

	it("shows only the received bytes without an expected size or rate", () => {
		assert.equal(downloadProgressText(512, undefined, 0), "512 B");
	});
});

describe("formatting helpers", () => {
	it("formats binary sizes and clamps the bar", () => {
		assert.equal(formatBytes(86_720_111_488), "80.8 GiB");
		assert.equal(renderProgressBar(1.5), "[████████████████] 100%");
		assert.equal(renderProgressBar(0.999), "[███████████████░]  99%");
	});
});

function download(overrides: Partial<DownloadProgress>): DownloadProgress {
	return { target: "q2", name: "Q2", kind: "model", bytes: 0, bytesPerSecond: 0, ...overrides };
}

describe("downloadsSummaryText", () => {
	it("is empty without downloads", () => {
		assert.equal(downloadsSummaryText([]), undefined);
	});

	it("counts models and floors the combined percentage", () => {
		assert.equal(
			downloadsSummaryText([
				download({ bytes: 30 * GIB, totalBytes: 80 * GIB }),
				download({ target: "vision", bytes: 10 * GIB, totalBytes: 20 * GIB }),
			]),
			"ds4: downloading 2 models, 40% done",
		);
		assert.equal(
			downloadsSummaryText([download({ bytes: 0.999 * GIB, totalBytes: GIB })]),
			"ds4: downloading 1 model, 99% done",
		);
	});

	it("says downloads once an add-on is in the set", () => {
		assert.equal(
			downloadsSummaryText([
				download({ bytes: 0, totalBytes: GIB }),
				download({ target: "vision-encoder", kind: "addon", bytes: 0, totalBytes: GIB }),
			]),
			"ds4: downloading 2 downloads, 0% done",
		);
	});

	it("omits the percentage when any expected size is unknown or stale", () => {
		assert.equal(
			downloadsSummaryText([download({ bytes: GIB, totalBytes: 2 * GIB }), download({ bytes: GIB })]),
			"ds4: downloading 2 models",
		);
		assert.equal(
			downloadsSummaryText([download({ bytes: 3 * GIB, totalBytes: 2 * GIB })]),
			"ds4: downloading 1 model",
		);
	});
});

describe("downloadRowText", () => {
	it("prefers the phase, then byte progress, then a starting note", () => {
		assert.equal(downloadRowText(download({ phase: "verifying checksum", bytes: GIB })), "verifying checksum");
		assert.equal(
			downloadRowText(download({ bytes: 40 * GIB, totalBytes: 80 * GIB, bytesPerSecond: 100 * 1024 ** 2 })),
			"[████████░░░░░░░░]  50% 40.0 GiB / 80.0 GiB, 100 MiB/s, 6:50 left",
		);
		assert.equal(downloadRowText(download({})), "starting");
	});
});
