export default {
	files: [
		"src/**/*.spec.ts",
		"test/**/*.ts"
	],
	sources: [
		"src/**/*.ts",
		"test/**/*.ts",
		"tsconfig.json"
	],
	compileEnhancements: false,
	extensions: [
		"ts"
	],
	require: [
		"ts-node/register"
	]
};
