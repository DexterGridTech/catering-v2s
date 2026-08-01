#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function fail(code, detail = "") { const error = new Error(`${code}${detail ? `:${detail}` : ""}`); error.code = code; throw error; }
function yamlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? yamlFiles(absolute) : /\.ya?ml$/.test(entry.name) ? [absolute] : [];
  });
}
function pointer(document, fragment) {
  if (!fragment || fragment === "#") return document;
  if (!fragment.startsWith("#/")) throw new Error("POINTER_FRAGMENT_UNSUPPORTED");
  let current = document;
  for (const segment of fragment.slice(2).split("/").map((value) => decodeURIComponent(value).replaceAll("~1", "/").replaceAll("~0", "~"))) {
    if (!current || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}
function scan(contractRoot) {
  const documents = new Map(yamlFiles(contractRoot).map((file) => {
    try { return [file, JSON.parse(fs.readFileSync(file, "utf8"))]; }
    catch { fail("R5_STRICT_OPENAPI_JSON_DOCUMENT_INVALID", path.relative(contractRoot, file)); }
  }));
  const result = { documents: documents.size, totalReferences: 0, missingFile: 0, missingPointer: 0, other: 0, unresolved: 0, findings: [] };
  const report = (kind, file, at, ref) => {
    result[kind] += 1;
    result.findings.push({ kind, file: path.relative(contractRoot, file), at, ref });
  };
  const visit = (value, file, at) => {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, file, `${at}/${index}`));
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string") {
      result.totalReferences += 1;
      const [rawFile, rawFragment = ""] = value.$ref.split("#", 2);
      const target = rawFile ? path.resolve(path.dirname(file), rawFile) : file;
      if (!documents.has(target)) report("missingFile", file, at, value.$ref);
      else {
        try { if (pointer(documents.get(target), `#${rawFragment}`) === undefined) report("missingPointer", file, at, value.$ref); }
        catch { report("other", file, at, value.$ref); }
      }
    }
    Object.entries(value).forEach(([key, item]) => visit(item, file, `${at}/${key}`));
  };
  for (const [file, document] of documents) visit(document, file, "");
  result.unresolved = result.missingFile + result.missingPointer + result.other;
  return result;
}
function print(result) { process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); }
function selfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-openapi-resolver-"));
  try {
    const component = path.join(scratch, "components.yaml");
    const edge = path.join(scratch, "edge.yaml");
    fs.writeFileSync(component, `${JSON.stringify({components:{schemas:{Value:{type:"string"}}}})}\n`);
    fs.writeFileSync(edge, `${JSON.stringify({openapi:"3.1.0",components:{schemas:{Use:{$ref:"./components.yaml#/components/schemas/Value"}}}})}\n`);
    if (scan(scratch).unresolved !== 0) fail("R5_STRICT_OPENAPI_SELF_TEST_CLEAN_INVALID");
    fs.writeFileSync(edge, `${JSON.stringify({openapi:"3.1.0",components:{schemas:{Use:{$ref:"./components.yaml#/components/schemas/Missing"}}}})}\n`);
    const red = scan(scratch);
    if (red.unresolved !== 1 || red.missingPointer !== 1) fail("R5_STRICT_OPENAPI_SELF_TEST_RED_NOT_DETECTED");
    process.stdout.write("R5_STRICT_OPENAPI_RESOLVER_SELF_TEST=PASS\nRED=missingPointer\n");
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}

try {
  if (process.argv.includes("--self-test")) selfTest();
  else {
    const result = scan(path.join(root, "contracts/openapi"));
    if (process.argv.includes("--report")) print(result);
    else if (result.unresolved !== 0) { process.stderr.write(`R5_STRICT_OPENAPI_UNRESOLVED=${result.unresolved}\nMISSING_FILE=${result.missingFile}\nMISSING_POINTER=${result.missingPointer}\nOTHER=${result.other}\n`); process.exitCode = 1; }
    else process.stdout.write(`R5_STRICT_OPENAPI_RESOLVER=PASS\nREFERENCES=${result.totalReferences}\n`);
  }
} catch (error) { process.stderr.write(`${error.code || "R5_STRICT_OPENAPI_RESOLVER_FAIL"}: ${error.message}\n`); process.exitCode = 1; }
