#!/usr/bin/env node
/**
 * Copies the built `theme.css` into an Obsidian vault so you can preview changes
 * while developing, without publishing a release.
 *
 * Two supported workflows:
 *
 *   # 1. Preview as a theme (recommended — what users will actually get)
 *   npm run build
 *   npm run sync -- --init "/path/to/MyVault/.obsidian/themes/Glassive"
 *   # then: Obsidian → Settings → Appearance → Themes → Glassive
 *
 *   # 2. Preview as a CSS snippet (keeps loading only this file)
 *   npm run sync -- --init "/path/to/MyVault/.obsidian/snippets" --name main1.css
 *
 * The target is stored in `.sync-target` (git-ignored, machine-specific), so
 * later you can just run:
 *
 *   npm run build && npm run sync
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CONFIG_FILE = ".sync-target";
const SOURCE = "theme.css";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
	const i = args.indexOf(name);
	return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

let target = flag("--init") ?? flag("--dir");
let name = flag("--name", null);

if (target) {
	const config = { target: resolve(target), name: name ?? "theme.css" };
	writeFileSync(CONFIG_FILE, JSON.stringify(config, null, "\t") + "\n");
	console.log(`Saved sync target to ${CONFIG_FILE}:\n  ${config.target}/${config.name}`);
} else if (existsSync(CONFIG_FILE)) {
	const config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
	target = config.target;
	name = name ?? config.name;
} else {
	console.error(
		[
			"",
			"No sync target configured.",
			"",
			"Run one of:",
			'  npm run sync -- --init "/path/to/MyVault/.obsidian/themes/Glassive"',
			'  npm run sync -- --init "/path/to/MyVault/.obsidian/snippets" --name main1.css',
			"",
		].join("\n")
	);
	process.exit(1);
}

name = name ?? "theme.css";

if (!existsSync(SOURCE)) {
	console.error(`\n${SOURCE} not found. Run \`npm run build\` first.\n`);
	process.exit(1);
}

mkdirSync(target, { recursive: true });
const destination = join(target, name);
copyFileSync(SOURCE, destination);
console.log(`Synced ${SOURCE} → ${destination}`);
