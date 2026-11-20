/** The `code` of a Node.js system error, such as `ENOENT`, or undefined for any other thrown value. */
export function errorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
	return typeof error.code === "string" ? error.code : undefined;
}

/** Whether a parsed JSON value is an object rather than an array or a primitive. */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
