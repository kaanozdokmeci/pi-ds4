import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { downloadProgressText, formatBytes, renderProgressBar } from "../progress.ts";

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
