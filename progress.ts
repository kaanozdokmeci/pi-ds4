// Pure formatting for download progress in the Pi status line.

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
