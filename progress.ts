// Pure formatting for download progress in the Pi status line and pop-up.

export const PROGRESS_BAR_WIDTH = 16;

export function formatBytes(bytes: number): string {
	const units = ["B", "KiB", "MiB", "GiB", "TiB"];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
	return `${value.toFixed(digits)} ${units[unit]}`;
}

export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
	const total = Math.round(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const secs = total % 60;
	const pad = (value: number) => String(value).padStart(2, "0");
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function renderProgressBar(fraction: number): string {
	const clamped = Math.max(0, Math.min(1, fraction));
	// Floor so a full bar only shows at completion, matching the percentage.
	const filled = Math.floor(clamped * PROGRESS_BAR_WIDTH);
	const bar = `${"\u2588".repeat(filled)}${"\u2591".repeat(PROGRESS_BAR_WIDTH - filled)}`;
	return `[${bar}] ${String(Math.floor(clamped * 100)).padStart(3)}%`;
}

// Describes bytes received so far. A download that grows past its expected
// size means the expected size is stale, for example after upstream reissued
// the file; it is then shown without a bar or ETA rather than as a full bar.
export function downloadProgressText(
	bytes: number,
	totalBytes: number | undefined,
	bytesPerSecond: number,
): string {
	const total = totalBytes && bytes <= totalBytes ? totalBytes : undefined;
	const details = [total ? `${formatBytes(bytes)} / ${formatBytes(total)}` : formatBytes(bytes)];
	if (bytesPerSecond > 0) details.push(`${formatBytes(bytesPerSecond)}/s`);
	if (total && bytesPerSecond > 0 && bytes < total) {
		details.push(`${formatDuration((total - bytes) / bytesPerSecond)} left`);
	}
	const bar = total ? `${renderProgressBar(bytes / total)} ` : "";
	return `${bar}${details.join(", ")}`;
}

// One download started from /ds4. The monitor updates bytes and rate while
// the file grows; phase describes a step without byte progress, such as
// preparing the checkout or the script verifying a finished file.
export type DownloadProgress = {
	target: string;
	name: string;
	kind: "model" | "addon";
	bytes: number;
	totalBytes?: number;
	bytesPerSecond: number;
	phase?: string;
};

function hasKnownTotal(download: DownloadProgress): download is DownloadProgress & { totalBytes: number } {
	return !!download.totalBytes && download.bytes <= download.totalBytes;
}

// Summarizes every running download in one status line. The percentage is
// left out unless every download has a trustworthy expected size, because a
// partial sum would overstate how far along the set is.
export function downloadsSummaryText(downloads: readonly DownloadProgress[]): string | undefined {
	const count = downloads.length;
	if (count === 0) return undefined;
	const noun = downloads.every((download) => download.kind === "model") ? "model" : "download";
	const summary = `ds4: downloading ${count} ${noun}${count === 1 ? "" : "s"}`;
	if (!downloads.every(hasKnownTotal)) return summary;
	let bytes = 0;
	let totalBytes = 0;
	for (const download of downloads) {
		bytes += download.bytes;
		totalBytes += download.totalBytes;
	}
	return `${summary}, ${Math.floor((bytes / totalBytes) * 100)}% done`;
}

export function downloadRowText(download: DownloadProgress): string {
	if (download.phase) return download.phase;
	if (download.bytes <= 0) return "starting";
	return downloadProgressText(download.bytes, download.totalBytes, download.bytesPerSecond);
}
