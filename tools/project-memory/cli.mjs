#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dimensions = ["taskKinds", "domains", "consumerFaces", "owners", "impacts", "triggers"];
const routeFlags = {
  taskKinds: "--task-kind",
  domains: "--domain",
  consumerFaces: "--consumer-face",
  owners: "--owner",
  impacts: "--impact",
  triggers: "--trigger"
};

function fail(message) {
  process.stderr.write(`PROJECT_MEMORY=FAIL\nREASON=${message}\n`);
  process.exit(2);
}

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}

function parseFrontmatter(text, path) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) fail(`missing frontmatter: ${path}`);
  const result = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 1) fail(`invalid frontmatter line: ${path}`);
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    if (raw.startsWith("[")) {
      try {
        result[key] = JSON.parse(raw);
      } catch {
        fail(`invalid frontmatter array: ${path}:${key}`);
      }
    } else {
      result[key] = raw;
    }
  }
  return { attributes: result, body: text.slice(match[0].length) };
}

function same(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function validateVocabulary(vocabulary) {
  if (![1, 2].includes(vocabulary?.schemaVersion) || !vocabulary.dimensions) fail("invalid routing vocabulary envelope");
  for (const dimension of dimensions) {
    const values = vocabulary.dimensions[dimension];
    if (!Array.isArray(values) || values.length === 0 || new Set(values).size !== values.length || !values.includes("all")) {
      fail(`invalid routing vocabulary dimension: ${dimension}`);
    }
  }
  const aliases = vocabulary.aliases || {};
  for (const [dimension, mappings] of Object.entries(aliases)) {
    if (!dimensions.includes(dimension) || !mappings || typeof mappings !== "object" || Array.isArray(mappings)) {
      fail(`invalid routing vocabulary aliases: ${dimension}`);
    }
    for (const [alias, target] of Object.entries(mappings)) {
      if (alias.trim() !== alias || alias.length === 0 || typeof target !== "string"
        || target === "all" || !vocabulary.dimensions[dimension].includes(target)) {
        fail(`invalid routing vocabulary alias: ${dimension}:${alias}`);
      }
    }
  }
}

function canonicalRouteValue(vocabulary, dimension, value) {
  return vocabulary.aliases?.[dimension]?.[value] || value;
}

function loadValidated(root) {
  const inventoryPath = resolve(root, "project-memory/required-inventory.json");
  const inventoryBytes = readFileSync(inventoryPath);
  const inventory = JSON.parse(inventoryBytes);
  if (inventory.schemaVersion !== 1 || inventory.kind !== "project-memory-required-inventory" || !Array.isArray(inventory.entries)) {
    fail("invalid required inventory envelope");
  }
  const vocabulary = JSON.parse(readFileSync(resolve(root, "project-memory/routing-vocabulary.json"), "utf8"));
  validateVocabulary(vocabulary);
  const activeFiles = [];
  for (const entry of inventory.entries) {
    const absolute = resolve(root, entry.path);
    if (!existsSync(absolute)) fail(`missing required memory: ${entry.path}`);
    const bytes = readFileSync(absolute);
    const parsed = parseFrontmatter(bytes.toString("utf8"), entry.path);
    const attributes = parsed.attributes;
    if (attributes.id !== entry.id || attributes.status !== "active" || attributes.layer !== entry.layer) {
      fail(`identity drift: ${entry.path}`);
    }
    const route = Object.fromEntries(dimensions.map((dimension) => [dimension, attributes[dimension]]));
    if (!same(route, entry.route)) fail(`route drift: ${entry.path}`);
    if (!same(attributes.assertions, entry.requiredAssertions)) fail(`required assertion drift: ${entry.path}`);
    if (!same(attributes.sourceRefs, entry.sourceRefs)) fail(`sourceRefs drift: ${entry.path}`);
    const deduplicatedSources = [...new Set(entry.assertionSources.map((source) => source.path))].sort();
    if (!same(deduplicatedSources, entry.sourceRefs)) fail(`sourceRefs are not the sorted owning source set: ${entry.path}`);
    for (const dimension of dimensions) {
      if (!Array.isArray(route[dimension]) || route[dimension].length === 0) fail(`empty route: ${entry.path}:${dimension}`);
      for (const value of route[dimension]) {
        if (!vocabulary.dimensions[dimension].includes(value)) fail(`unknown route value: ${entry.path}:${dimension}:${value}`);
      }
    }
    for (const source of entry.assertionSources) {
      if (!entry.requiredAssertions.includes(source.assertionKey)) fail(`unowned assertion source: ${entry.path}:${source.assertionKey}`);
      const sourcePath = resolve(root, source.path);
      if (!existsSync(sourcePath)) fail(`missing owning source: ${source.path}`);
      const sourceText = readFileSync(sourcePath, "utf8");
      if (!sourceText.split("\n").includes(source.anchor)) {
        fail(`missing literal owning heading: ${source.path}:${source.anchor}`);
      }
    }
    if (entry.layer === "kernel" && Buffer.byteLength(parsed.body, "utf8") > 4096) {
      fail(`kernel body exceeds 4096 bytes: ${entry.path}`);
    }
    activeFiles.push({
      id: entry.id,
      path: entry.path,
      layer: entry.layer,
      route,
      assertions: entry.requiredAssertions,
      assertionSources: entry.assertionSources,
      sourceRefs: entry.sourceRefs
    });
  }

  return activeFiles;
}

function renderMarkdown(index) {
  const lines = [
    "# Project Memory Index",
    "",
    "Generated deterministically by `scripts/memory/build-index`. Do not edit.",
    "",
    "## Always-read kernel"
  ];
  for (const entry of index.entries.filter((candidate) => candidate.layer === "kernel")) {
    lines.push(`- [${entry.id}](../${entry.path})`);
  }
  lines.push("", "## Routed memory");
  for (const entry of index.entries.filter((candidate) => candidate.layer === "routed")) {
    lines.push(`- [${entry.id}](../${entry.path})`);
  }
  lines.push("");
  return lines.join("\n");
}

function build(root, checkOnly) {
  const entries = loadValidated(root);
  const index = {
    schemaVersion: 1,
    kind: "project-memory-index",
    entries
  };
  const json = `${JSON.stringify(index, null, 2)}\n`;
  const markdown = renderMarkdown(index);
  const jsonPath = resolve(root, "project-memory/index.json");
  const markdownPath = resolve(root, "project-memory/index.md");
  if (checkOnly) {
    if (!existsSync(jsonPath) || readFileSync(jsonPath, "utf8") !== json) fail("project-memory/index.json is stale");
    if (!existsSync(markdownPath) || readFileSync(markdownPath, "utf8") !== markdown) fail("project-memory/index.md is stale");
  } else {
    const changed = !existsSync(jsonPath) || !existsSync(markdownPath)
      || readFileSync(jsonPath, "utf8") !== json || readFileSync(markdownPath, "utf8") !== markdown;
    if (changed) {
      writeFileSync(jsonPath, json);
      writeFileSync(markdownPath, markdown);
    }
  }
  const kernelCount = entries.filter((entry) => entry.layer === "kernel").length;
  process.stdout.write(`PROJECT_MEMORY=PASS\nENTRIES=${entries.length}\nKERNEL=${kernelCount}\nROUTED=${entries.length - kernelCount}\n`);
}

function query(root) {
  const entries = loadValidated(root);
  const requested = {};
  const vocabulary = JSON.parse(readFileSync(resolve(root, "project-memory/routing-vocabulary.json"), "utf8"));
  validateVocabulary(vocabulary);
  for (const dimension of dimensions) {
    const rawValue = argValue(routeFlags[dimension]);
    const value = canonicalRouteValue(vocabulary, dimension, rawValue);
    if (!value) fail(`missing route dimension: ${routeFlags[dimension]}`);
    if (!vocabulary.dimensions[dimension].includes(value) || value === "all") fail(`unknown or non-specific route: ${dimension}:${value}`);
    requested[dimension] = value;
  }
  const matched = entries.filter((entry) =>
    entry.layer === "kernel" ||
    dimensions.every((dimension) => entry.route[dimension].includes("all") || entry.route[dimension].includes(requested[dimension]))
  );
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, route: requested, refs: matched }, null, 2)}\n`);
}

const command = process.argv[2];
const root = resolve(argValue("--root", process.cwd()));
if (command === "build") build(root, process.argv.includes("--check"));
else if (command === "query") query(root);
else fail("usage: cli.mjs build [--check] [--root PATH] | query <six route flags> [--root PATH]");
