#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const command = process.argv[2];
const root = process.cwd();
const args = process.argv.slice(3);

function value(name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function run(executable, childArgs) {
  const result = spawnSync(executable, childArgs, { cwd: root, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 2);
}

if (command === "agent-context") {
  process.stdout.write([
    "STATUS=PASS",
    "CONTEXT_MODE=DETERMINISTIC_ONLY",
    "ENTRY=AGENTS.md",
    "ENTRY=PLATFORM-BLUEPRINT.md",
    "ENTRY=project-memory/index.md",
    "ENTRY=scripts/README.md",
    ""
  ].join("\n"));
} else if (command === "recall-memory") {
  run("node", [resolve(root, "tools/project-memory/cli.mjs"), "query", "--root", root, ...args]);
} else if (command === "recall-code") {
  const query = value("--query");
  if (!query) {
    process.stderr.write("CODE_RECALL=FAIL\nREASON=--query exact fixed string is required\n");
    process.exit(2);
  }
  run("rg", ["--fixed-strings", "--line-number", "--hidden", "--glob", "!.git/**", "--glob", "!.runtime/**", "--", query, "."]);
} else if (command === "recall-failure") {
  const query = value("--query");
  if (!query) {
    process.stderr.write("FAILURE_RECALL=FAIL\nREASON=--query exact failure signal is required\n");
    process.exit(2);
  }
  const memory = spawnSync("node", [
    resolve(root, "tools/project-memory/cli.mjs"), "query", "--root", root,
    "--task-kind", "diagnostics",
    "--domain", "backend",
    "--consumer-face", "backend",
    "--owner", "backend",
    "--impact", "evidence",
    "--trigger", "failure"
  ], { cwd: root, encoding: "utf8" });
  if (memory.status !== 0) {
    if (memory.stdout) process.stdout.write(memory.stdout);
    if (memory.stderr) process.stderr.write(memory.stderr);
    process.exit(memory.status ?? 2);
  }
  process.stdout.write("FAILURE_MEMORY_BEGIN\n");
  process.stdout.write(memory.stdout);
  process.stdout.write("FAILURE_MEMORY_END\nCODE_MATCHES_BEGIN\n");
  const code = spawnSync("rg", ["--fixed-strings", "--line-number", "--hidden", "--glob", "!.git/**", "--glob", "!.runtime/**", "--", query, "."], { cwd: root, encoding: "utf8" });
  if (code.stdout) process.stdout.write(code.stdout);
  if (code.stderr) process.stderr.write(code.stderr);
  process.stdout.write("CODE_MATCHES_END\n");
  // No exact code match is an honest empty result, not a context failure.
  process.exit(code.status === 0 || code.status === 1 ? 0 : (code.status ?? 2));
} else if (command === "working-set") {
  process.stdout.write([
    "WORKING_SET=PASS",
    "PATH=AGENTS.md",
    "PATH=PLATFORM-BLUEPRINT.md",
    "PATH=project-memory/index.md",
    "PATH=scripts/README.md",
    ""
  ].join("\n"));
} else {
  process.stderr.write("AGENT_CONTEXT=FAIL\nREASON=unknown command\n");
  process.exit(2);
}
