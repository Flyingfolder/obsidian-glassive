#!/usr/bin/env node
/**
 * Fixes the stylelint problems that Sass puts into compiled CSS.
 *
 *   node scripts/format-css.mjs theme.css
 *
 * Only the rules listed in build-fixed-rules.mjs are applied here; every
 * other rule is left for a human to review.
 */

import stylelint from "stylelint";
import { isBuildFixedRule } from "./build-fixed-rules.mjs";

const files = process.argv.slice(2);
if (!files.length) {
	console.error("Usage: node scripts/format-css.mjs <file.css>...");
	process.exit(1);
}

for (const file of files) {
	const { rules } = await stylelint.resolveConfig(file);
	const buildRules = Object.fromEntries(Object.entries(rules).filter(([name]) => isBuildFixedRule(name)));
	await stylelint.lint({ files: file, fix: true, config: { rules: buildRules } });
}
