#!/usr/bin/env node
/**
 * Fixes the blank-line rules of the stylelint config in compiled CSS.
 *
 *   node scripts/format-css.mjs theme.css
 *
 * Sass decides the blank lines of its output, so these rules cannot be
 * satisfied from the SCSS sources. Only the *-empty-line-before rules are
 * applied here; every other rule is left for a human to review.
 */

import stylelint from "stylelint";

const FORMAT_RULE = /-empty-line-before$/;

const files = process.argv.slice(2);
if (!files.length) {
	console.error("Usage: node scripts/format-css.mjs <file.css>...");
	process.exit(1);
}

for (const file of files) {
	const { rules } = await stylelint.resolveConfig(file);
	const formatRules = Object.fromEntries(Object.entries(rules).filter(([name]) => FORMAT_RULE.test(name)));
	await stylelint.lint({ files: file, fix: true, config: { rules: formatRules } });
}
