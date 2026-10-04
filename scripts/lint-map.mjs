#!/usr/bin/env node
/**
 * Lints the compiled theme and reports every problem at its SCSS source.
 *
 *   npm run lint:map
 *
 * Compiles main1.scss the same way `npm run build` does (Sass + autoprefixer),
 * but in memory and with a source map, so theme.css is not touched. Problems
 * from the blank-line rules are only counted: `npm run build` fixes them.
 */

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import autoprefixer from "autoprefixer";
import postcss from "postcss";
import * as sass from "sass";
import { SourceMapConsumer } from "source-map-js";
import stylelint from "stylelint";

const FORMAT_RULE = /-empty-line-before$/;
const ENTRY = "main1.scss";
const OUTPUT = resolve("theme.css");

const compiled = sass.compile(ENTRY, { style: "expanded", sourceMap: true });
const prefixed = await postcss([autoprefixer]).process(compiled.css, {
	from: OUTPUT,
	to: OUTPUT,
	map: { prev: compiled.sourceMap, inline: false, annotation: false, sourcesContent: false },
});

const consumer = new SourceMapConsumer(prefixed.map.toJSON());
const cssLines = prefixed.css.split("\n");

const [result] = (await stylelint.lint({ code: prefixed.css, codeFilename: OUTPUT })).results;

/** Finds the nearest source mapping at or before a theme.css position (1-based line, 0-based column). */
function nearestMapping(line, column) {
	for (const bias of [SourceMapConsumer.GREATEST_LOWER_BOUND, SourceMapConsumer.LEAST_UPPER_BOUND]) {
		const pos = consumer.originalPositionFor({ line, column, bias });
		if (pos.source) return pos;
	}
	for (let l = line - 1; l > 0; l--) {
		const pos = consumer.originalPositionFor({ line: l, column: cssLines[l - 1].length, bias: SourceMapConsumer.GREATEST_LOWER_BOUND });
		if (pos.source) return pos;
	}
	return null;
}

const sources = new Map();
function sourceLines(source) {
	if (!sources.has(source)) sources.set(source, readFileSync(fileURLToPath(source), "utf8").split("\n"));
	return sources.get(source);
}

/** Text between two 1-based-line / 0-based-column positions. */
function textBetween(lines, fromLine, fromColumn, toLine, toColumn) {
	if (fromLine === toLine) return lines[fromLine - 1].slice(fromColumn, toColumn);
	return [lines[fromLine - 1].slice(fromColumn), ...lines.slice(fromLine, toLine - 1), lines[toLine - 1].slice(0, toColumn)].join("\n");
}

/** Text from a position to the end of the declaration that starts there. */
function declarationText(lines, line, column) {
	const text = textBetween(lines, line, column, Math.min(line + 60, lines.length), Infinity);
	let depth = 0;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === "(" || (ch === "{" && text[i - 1] === "#")) depth++;
		else if (ch === ")" || (ch === "}" && depth)) depth--;
		else if (!depth && (ch === ";" || ch === "{" || ch === "}")) return text.slice(0, i);
	}
	return text;
}

const TOKEN = /^(?:[\w-]+\((?:[^()]|\([^()]*\))*\)|[^\s,;{}()]+)/;
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Moves a declaration-start mapping to the flagged token inside the declaration,
 * by matching the n-th occurrence of the token in theme.css to the n-th in the SCSS.
 * Fails when Sass rewrote the token (e.g. `rgb(0, 0, 0, 15%)` → `rgba(0, 0, 0, 0.15)`).
 */
function refineInDeclaration(pos, gen, line, column) {
	if (!/^[-\w]+\s*:/.test(cssLines[gen.line - 1].slice(gen.column))) return null;
	const token = TOKEN.exec(cssLines[line - 1].slice(column))?.[0];
	if (!token) return null;
	const pattern = new RegExp(`(?<![\\w.-])${escapeRegExp(token).replace(/\s+/g, "\\s*").replace(/,/g, "\\s*,\\s*")}(?![\\w-])`, "g");
	const before = textBetween(cssLines, gen.line, gen.column, line, column).match(pattern)?.length ?? 0;
	const lines = sourceLines(pos.source);
	const matches = [...declarationText(lines, pos.line, pos.column).matchAll(pattern)];
	const match = matches[before];
	if (!match) return null;
	const preceding = textBetween(lines, pos.line, pos.column, Math.min(pos.line + 60, lines.length), Infinity).slice(0, match.index).split("\n");
	const offsetLine = preceding.length - 1;
	return { line: pos.line + offsetLine, column: (offsetLine ? 0 : pos.column) + preceding.at(-1).length };
}

/** Returns the SCSS position of a theme.css position; `exact` is false when only the enclosing declaration or rule was found. */
function toSource(line, column) {
	const pos = nearestMapping(line, column - 1);
	if (!pos) return null;
	const gen = consumer.generatedPositionFor({ source: pos.source, line: pos.line, column: pos.column });
	if (gen.line === line && gen.column === column - 1) return { ...pos, exact: true };
	const refined = gen.line && refineInDeclaration(pos, gen, line, column - 1);
	return refined ? { ...pos, ...refined, exact: true } : { ...pos, exact: false };
}

function sourcePath(source) {
	const file = source.startsWith("file:") ? fileURLToPath(source) : resolve(source);
	return relative(process.cwd(), file);
}

const formatCounts = {};
const bySource = new Map();
for (const w of result.warnings) {
	if (FORMAT_RULE.test(w.rule)) {
		formatCounts[w.rule] = (formatCounts[w.rule] ?? 0) + 1;
		continue;
	}
	const pos = toSource(w.line, w.column);
	const file = pos ? sourcePath(pos.source) : "theme.css (no source mapping)";
	const location = pos ? `${file}:${pos.line}:${pos.column + 1}` : `theme.css:${w.line}:${w.column}`;
	if (!bySource.has(file)) bySource.set(file, new Map());
	const entries = bySource.get(file);
	const key = `${location}\0${w.rule}\0${w.text}`;
	if (entries.has(key)) entries.get(key).count++;
	else entries.set(key, { ...w, location, sortLine: pos?.line ?? w.line, approx: pos && !pos.exact, count: 1 });
}

const severityMark = { error: "✖", warning: "⚠" };
let errors = 0;
let warnings = 0;
for (const [file, entries] of [...bySource].sort(([a], [b]) => a.localeCompare(b))) {
	console.log(`\n${file}`);
	for (const w of [...entries.values()].sort((a, b) => a.sortLine - b.sortLine)) {
		w.severity === "error" ? (errors += w.count) : (warnings += w.count);
		const text = w.text.replace(` (${w.rule})`, "");
		console.log(`  ${severityMark[w.severity]} ${w.location}${w.approx ? " ~" : ""}  ${text}  [${w.rule}]${w.count > 1 ? ` ×${w.count}` : ""}`);
	}
}

const formatTotal = Object.values(formatCounts).reduce((a, b) => a + b, 0);
console.log(`\n${errors} errors, ${warnings} warnings in SCSS sources.`);
if (formatTotal) console.log(`${formatTotal} blank-line problems are fixed by \`npm run build\` (${Object.entries(formatCounts).map(([r, n]) => `${r}: ${n}`).join(", ")}).`);
if ([...bySource.values()].some((entries) => [...entries.values()].some((w) => w.approx))) console.log("~ marks problems located only to the start of the enclosing declaration or rule: the flagged text is inside it, or in a parent selector.");

process.exitCode = errors ? 1 : 0;
