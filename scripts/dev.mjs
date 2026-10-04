#!/usr/bin/env node
/**
 * Live preview: watches the SCSS sources and writes theme.css straight into a
 * vault's theme folder, so Obsidian picks up every save.
 *
 *   npm run dev -- --init "/path/to/MyVault"   # first time; the path is saved to .vault-path
 *   npm run dev                                # afterwards
 *
 * Output goes to <vault>/.obsidian/themes/<manifest name>/. That folder is build
 * output only: edit the sources in this repo, never the copy in the vault.
 */

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CONFIG_FILE = ".vault-path";

const args = process.argv.slice(2);
const initIndex = args.indexOf("--init");

let vault;
if (initIndex !== -1 && args[initIndex + 1]) {
	vault = resolve(args[initIndex + 1]);
	writeFileSync(CONFIG_FILE, vault + "\n");
} else if (existsSync(CONFIG_FILE)) {
	vault = readFileSync(CONFIG_FILE, "utf8").trim();
} else {
	console.error('\nNo vault configured. Run:\n  npm run dev -- --init "/path/to/MyVault"\n');
	process.exit(1);
}

if (!existsSync(join(vault, ".obsidian"))) {
	console.error(`\n${vault} is not an Obsidian vault (no .obsidian folder).\n`);
	process.exit(1);
}

const { name } = JSON.parse(readFileSync("manifest.json", "utf8"));
const themeDir = join(vault, ".obsidian", "themes", name);
mkdirSync(themeDir, { recursive: true });
copyFileSync("manifest.json", join(themeDir, "manifest.json"));

console.log(`Watching main1/ → ${join(themeDir, "theme.css")}`);

const sass = spawn(
	join("node_modules", ".bin", "sass"),
	["--watch", "--no-source-map", "main1.scss", join(themeDir, "theme.css")],
	{ stdio: "inherit" }
);
sass.on("exit", (code) => process.exit(code ?? 0));
