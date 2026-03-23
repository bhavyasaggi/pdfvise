export async function resolve(specifier, context, nextResolve) {
	const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
	const hasExtension = /\.[a-zA-Z0-9]+$/.test(specifier);
	if (isRelative && !hasExtension) {
		return nextResolve(`${specifier}.ts`, context);
	}
	return nextResolve(specifier, context);
}
