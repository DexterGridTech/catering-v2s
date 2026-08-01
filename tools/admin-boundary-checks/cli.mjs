#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const apps = ["platform-admin", "operations-admin"];

function fail(code, detail = "") {
  const error = new Error(`${code}${detail ? `:${detail}` : ""}`);
  error.code = code;
  throw error;
}
function relative(app, suffix) { return `apps/frontend/${app}/${suffix}`; }
function absolute(base, target) { return path.join(base, target); }
function read(base, target) { return fs.readFileSync(absolute(base, target), "utf8"); }
function exists(base, target) { return fs.existsSync(absolute(base, target)); }

function validate(base) {
  for (const app of apps) {
    for (const target of [relative(app, "index.html"), relative(app, "src/main.tsx"), relative(app, "src/app")]) {
      if (!exists(base, target)) fail("R5_FRONTEND_FILE_MISSING", target);
    }
    for (const retired of [relative(app, "src/main.js"), relative(app, "scripts/build-static.mjs")]) {
      if (exists(base, retired)) fail("R5_FRONTEND_LEGACY_BUILD_FALLBACK_PRESENT", retired);
    }
    if (!/src\/main\.tsx/.test(read(base, relative(app, "index.html")))) fail("R5_FRONTEND_VITE_ENTRY_MISSING", app);
  }
  const platform = read(base, relative("platform-admin", "src/app/PlatformApp.tsx"));
  const operations = read(base, relative("operations-admin", "src/app/OperationsApp.tsx"));
  if (!/platformClient/.test(platform) || !/operationsClient/.test(operations)) fail("R5_FRONTEND_GENERATED_CLIENT_BOUNDARY_MISSING");
  if (/operations-admin\/src/.test(platform) || /platform-admin\/src/.test(operations)) fail("R5_FRONTEND_CROSS_APP_IMPORT");
  process.stdout.write("R5_ADMIN_BOUNDARIES=PASS; apps=2; legacy-fallback=0\n");
}

function selfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-admin-boundary-"));
  try {
    fs.cpSync(root, scratch, {recursive: true, filter: (source) => !source.includes("/node_modules") && !source.includes("/build") && !source.includes("/dist") && !source.includes("/.git")});
    const target = relative("operations-admin", "src/main.js");
    fs.writeFileSync(absolute(scratch, target), "fetch('/api/operations/legacy');\n");
    try {
      validate(scratch);
      fail("R5_FRONTEND_LEGACY_BUILD_FALLBACK_RED_NOT_DETECTED");
    } catch (error) {
      if (error.code !== "R5_FRONTEND_LEGACY_BUILD_FALLBACK_PRESENT") throw error;
    }
    process.stdout.write("R5_ADMIN_BOUNDARIES_SELF_TEST=PASS\n");
  } finally {
    fs.rmSync(scratch, {recursive: true, force: true});
  }
}

try {
  if (process.argv.includes("--self-test")) selfTest();
  else validate(root);
} catch (error) {
  process.stderr.write(`${error.code || "R5_ADMIN_BOUNDARIES_FAIL"}:${error.message}\n`);
  process.exitCode = 1;
}
