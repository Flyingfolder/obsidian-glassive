/**
 * Bumps the version in manifest.json and adds a matching entry to versions.json.
 *
 * Usage:
 *   npm version 1.0.1        # updates manifest.json + versions.json and stages them
 */

import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

if (!targetVersion) {
	console.error("No version found. Run this through `npm version <x.y.z>`.");
	process.exit(1);
}

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// update versions.json with target version and minAppVersion from manifest.json
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));

console.log(`Bumped manifest.json and versions.json to ${targetVersion}`);
