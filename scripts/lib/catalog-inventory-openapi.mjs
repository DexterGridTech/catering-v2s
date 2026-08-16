import fs from "node:fs";
import path from "node:path";

const PLACEMENT_PATH = "contracts/catalog/catalog-inventory-edge-placement.json";
const OPENAPI_DIRECTORY = "contracts/openapi";

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

/**
 * Read the catalog-inventory OpenAPI source from its placement manifest and
 * shards. The large OpenAPI document is an output projection and must not be
 * used as the source by generators, validators, or consumers.
 */
export function readCatalogInventoryOpenApi(root = process.cwd()) {
  const placement = readJson(root, PLACEMENT_PATH);
  if (placement.kind !== "catalog-inventory-edge-placement" || !Array.isArray(placement.shards)) {
    throw new Error("CATALOG_INVENTORY_OPENAPI_PLACEMENT_INVALID");
  }

  const components = {schemas: {}};
  const paths = {};
  for (const shard of placement.shards) {
    const document = readJson(root, path.join(OPENAPI_DIRECTORY, shard));
    if (document.revision !== placement.revision) throw new Error(`CATALOG_INVENTORY_OPENAPI_SHARD_REVISION_DRIFT:${shard}`);
    if (document.kind === "catalog-inventory-openapi-shard") {
      for (const [name, schema] of Object.entries(document.schemas || {})) {
        if (Object.hasOwn(components.schemas, name)) {
          if (JSON.stringify(components.schemas[name]) !== JSON.stringify(schema)) throw new Error(`CATALOG_INVENTORY_OPENAPI_SCHEMA_DUPLICATE:${name}`);
          continue;
        }
        components.schemas[name] = schema;
      }
    } else if (document.kind === "catalog-inventory-openapi-path-shard") {
      for (const [route, methods] of Object.entries(document.paths || {})) {
        if (!Object.hasOwn(paths, route)) paths[route] = {};
        for (const [method, operation] of Object.entries(methods || {})) {
          if (Object.hasOwn(paths[route], method)
            && JSON.stringify(paths[route][method]) !== JSON.stringify(operation)) {
            throw new Error(`CATALOG_INVENTORY_OPENAPI_PATH_DUPLICATE:${route}:${method}`);
          }
          paths[route][method] = operation;
        }
      }
    } else {
      throw new Error(`CATALOG_INVENTORY_OPENAPI_SHARD_KIND_INVALID:${shard}`);
    }
  }

  return {
    openapi: "3.1.0",
    info: {title: "Catalog and Store Light Inventory", version: placement.revision},
    "x-v2s-status": "P1_DEFINITION_ONLY",
    "x-v2s-generated": true,
    "x-v2s-do-not-edit": true,
    "x-v2s-generated-from": "contracts/catalog/catalog-inventory-edge-placement.json and its declared JSON shards",
    "x-consumer-faces": ["operations-admin"],
    "x-shard-placement": placement.shards,
    paths,
    components,
  };
}
