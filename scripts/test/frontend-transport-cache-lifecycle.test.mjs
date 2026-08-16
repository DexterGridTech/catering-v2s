import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const operationsTransport = read("apps/frontend/operations-admin/src/app/api/OperationsTransport.ts");
const platformTransport = read("apps/frontend/platform-admin/src/app/api/PlatformTransport.ts");
const operationsApp = read("apps/frontend/operations-admin/src/app/OperationsApp.tsx");
const platformApp = read("apps/frontend/platform-admin/src/app/PlatformApp.tsx");
const catalogGenerator = read("scripts/generate/catalog-inventory-p3-frontend.mjs");
const catalogRtk = read("apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts");
const catalogContract = JSON.parse(read("contracts/catalog/catalog-inventory-edge-contract.json"));

test("command transports release RTK query and mutation lifecycle state", () => {
  for (const source of [operationsTransport, platformTransport]) {
    assert.match(source, /initiate\(request, [\s\S]*?\{subscribe: false\} : \{track: false\}\)/);
    assert.match(source, /finally \{[\s\S]*pending\.unsubscribe\?\.\(\);[\s\S]*pending\.reset\?\.\(\);[\s\S]*\}/);
    assert.doesNotMatch(source, /initiate\(request\)\s+as never/);
  }
});

test("catalog-inventory RTK generation keeps one global wire LIST tag per endpoint", () => {
  const getCount = catalogContract.operations.filter((operation) => operation.method === "GET").length;
  const mutationCount = catalogContract.operations.length - getCount;
  assert.match(catalogGenerator, /providesTags/);
  assert.match(catalogGenerator, /invalidatesTags/);
  assert.equal((catalogRtk.match(/providesTags:/g) ?? []).length, getCount);
  assert.equal((catalogRtk.match(/invalidatesTags:/g) ?? []).length, mutationCount);
  assert.equal((catalogRtk.match(/id: "LIST"/g) ?? []).length, catalogContract.operations.length);
});

test("current-page refresh invalidates active queries without remounting page state", () => {
  assert.match(operationsTransport, /refreshOperationsCurrentPage[\s\S]*invalidateTags\(\[\{type: 'wire', id: 'LIST'\}\]\)/);
  assert.match(platformTransport, /refreshPlatformCurrentPage[\s\S]*invalidateTags\(\[\{type: 'wire', id: 'LIST'\}\]\)/);
  assert.match(operationsApp, /onClick=\{refreshOperationsCurrentPage\}/);
  assert.match(platformApp, /onClick=\{refreshPlatformCurrentPage\}/);
  assert.doesNotMatch(operationsApp, /pageReload|setPageReload/);
  assert.doesNotMatch(platformApp, /pageReload|setPageReload/);
});
