import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const backendAcceptanceRunnerPath = path.join(root, 'scripts/test/backend-acceptance');
const acceptanceRoot = path.join(
  root,
  'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance',
);
const suitePath = path.join(acceptanceRoot, 'BackendAcceptanceTest.java');
const tdsProcessPath = path.join(acceptanceRoot, 'TdsAcceptanceProcess.java');
const repositoryPathsPath = path.join(acceptanceRoot, 'AcceptanceRepositoryPaths.java');
const repositoryPathsTestPath = path.join(acceptanceRoot, 'AcceptanceRepositoryPathsTest.java');
const terminalContractScenariosPath = path.join(acceptanceRoot, 'TerminalConnectionContractScenarios.java');
const metricsConfigurationPath = path.join(acceptanceRoot, 'BackendAcceptanceMetricsConfiguration.java');
const registrationGateBrokerPath = path.join(acceptanceRoot, 'TdsRegistrationGateBroker.java');
const tdsWebSocketHandlerPath = path.join(
  root,
  'apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketHandler.java',
);
const tdsSessionActorsPath = path.join(
  root,
  'apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java',
);
const tdsWebSocketConnectionPath = path.join(
  root,
  'apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketConnection.java',
);
const terminalRouteRegistryPath = path.join(
  root,
  'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json',
);
const terminalActivationPathsPath = path.join(root, 'contracts/openapi/paths/terminal/activation.paths.json');
const operationsStoreTerminalPathsPath = path.join(
  root,
  'contracts/openapi/paths/operations-admin/store-terminals.paths.json',
);
const terminalBindingSchemasPath = path.join(root, 'contracts/openapi-source/terminal-binding.schemas.json');
const workspaceAdministrationServicePath = path.join(
  root,
  'apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/WorkspaceAdministrationService.java',
);
const terminalBindingOwnerApiPath = path.join(
  root,
  'apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/api/TerminalBindingOwnerApi.java',
);
const terminalCredentialVerificationApiPath = path.join(
  root,
  'apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/api/TerminalCredentialVerificationApi.java',
);
const activateTerminalOperationPath = path.join(
  root,
  'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/ActivateTerminalOperation.java',
);
const terminalWireClientPath = path.join(root, 'scripts/test/terminal-ws-wire-client.mjs');
const requestCompletionInterceptorPath = path.join(
  root,
  'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/RequestCompletionDiagnosticInterceptor.java',
);
const requestCompletionRecorderPath = path.join(
  root,
  'apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/diagnostic/Slf4jSecurityDiagnosticRecorder.java',
);
const businessBuildPath = path.join(root, 'apps/backend/catering-business-server/build.gradle.kts');
const businessDataConfigurationPath = path.join(
  root,
  'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/configuration/BusinessDataConfiguration.java',
);
const backendRoot = path.join(root, 'apps/backend');

export function assertNoTerminalDataServerDependencyInBusinessApp(source) {
  const dependencyDeclaration =
    /^\s*(?:api|implementation|compileOnly|runtimeOnly|testImplementation|testCompileOnly|testRuntimeOnly)\s*\(\s*project\(\s*["']:\s*apps\s*:\s*backend\s*:\s*terminal-data-server["']/m;
  assert.doesNotMatch(source, dependencyDeclaration, 'BACKEND_ACCEPTANCE_TDS_ON_BUSINESS_TEST_RUNTIME_CLASSPATH');
}

function assertAcceptanceContainersStartBeforeDynamicProperties(source) {
  const methodStart = source.indexOf('@DynamicPropertySource\n    static void applicationProperties');
  const methodEnd = source.indexOf('private static Map<String, Supplier<?>> acceptancePropertySuppliers()', methodStart);
  assert.notEqual(methodStart, -1, 'BACKEND_ACCEPTANCE_DYNAMIC_PROPERTY_SOURCE_MISSING');
  assert.notEqual(methodEnd, -1, 'BACKEND_ACCEPTANCE_PROPERTY_SUPPLIER_BOUNDARY_MISSING');
  const method = source.slice(methodStart, methodEnd);
  const supplierRegistration = method.indexOf('acceptancePropertySuppliers()');
  const postgresStart = method.indexOf('if (!POSTGRES.isRunning()) POSTGRES.start();');
  const minioStart = method.indexOf('if (!MINIO.isRunning()) MINIO.start();');
  assert.ok(
    postgresStart >= 0 && postgresStart < supplierRegistration,
    'BACKEND_ACCEPTANCE_POSTGRES_CONTAINER_START_ORDER_INVALID',
  );
  assert.ok(minioStart >= 0 && minioStart < supplierRegistration, 'BACKEND_ACCEPTANCE_MINIO_CONTAINER_START_ORDER_INVALID');
}

function productionJavaSources(directory, sources = []) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!['.gradle', 'build', 'node_modules'].includes(entry.name)) productionJavaSources(filePath, sources);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.java') && filePath.includes(`${path.sep}src${path.sep}main${path.sep}java${path.sep}`)) {
      sources.push({path: filePath, source: readFileSync(filePath, 'utf8')});
    }
  }
  return sources;
}

function finalTransactionalSpringBeans(sources) {
  return sources.flatMap(({path: filePath, source}) => {
    const masked = maskJavaTrivia(source);
    const type = masked.match(/^(?:public\s+)?final\s+class\s+(\w+)\b/m);
    if (!type || !/@Transactional\b/.test(masked)) return [];
    const annotationLines = masked
      .slice(0, type.index)
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(-10)
      .join('\n');
    if (!/@(?:Component|Service|Repository|Controller|RestController)\b/.test(annotationLines)) return [];
    return [{path: filePath, className: type[1]}];
  });
}

function assertTransactionalSpringBeansRemainProxyable(sources) {
  const offenders = finalTransactionalSpringBeans(sources);
  assert.deepEqual(
    offenders,
    [],
    `BACKEND_TRANSACTIONAL_SPRING_COMPONENT_NOT_PROXYABLE:${offenders.map(({path: filePath, className}) => `${filePath}:${className}`).join(',')}`,
  );
}

function assertSecondBusinessContextIsIsolatedFromAcceptanceTestConfiguration(source, metricsConfiguration) {
  const builderStart = source.indexOf('secondBusinessContext = new SpringApplicationBuilder(');
  assert.notEqual(builderStart, -1, 'BACKEND_ACCEPTANCE_SECOND_CONTEXT_BUILDER_MISSING');
  const builderEnd = source.indexOf('.run();', builderStart);
  assert.notEqual(builderEnd, -1, 'BACKEND_ACCEPTANCE_SECOND_CONTEXT_BUILDER_INCOMPLETE');
  const builder = source.slice(builderStart, builderEnd);
  assert.match(
    builder,
    /\.profiles\("backend-acceptance-secondary"\)/,
    'BACKEND_ACCEPTANCE_SECOND_CONTEXT_PROFILE_MISSING',
  );
  assert.match(
    metricsConfiguration,
    /@Profile\("!backend-acceptance-secondary"\)\s+public class BackendAcceptanceMetricsConfiguration/,
    'BACKEND_ACCEPTANCE_SECOND_CONTEXT_TEST_CONFIGURATION_LEAK',
  );
  assert.doesNotMatch(
    builder,
    /BackendAcceptanceMetricsConfiguration|BackendAcceptanceDatabaseMetricsSink|installMeasurementSink/,
    'BACKEND_ACCEPTANCE_SECOND_CONTEXT_REPLACED_METRICS_SINK',
  );
}

function assertCustomFlywayBeanHonorsStandardEnablement(suiteSource, configurationSource) {
  const builderStart = suiteSource.indexOf('secondBusinessContext = new SpringApplicationBuilder(');
  assert.notEqual(builderStart, -1, 'BACKEND_ACCEPTANCE_SECOND_CONTEXT_BUILDER_MISSING');
  const builderEnd = suiteSource.indexOf('.run();', builderStart);
  assert.notEqual(builderEnd, -1, 'BACKEND_ACCEPTANCE_SECOND_CONTEXT_BUILDER_INCOMPLETE');
  assert.match(
    suiteSource.slice(0, builderStart),
    /properties\.put\("spring\.flyway\.enabled", false\);/,
    'BACKEND_ACCEPTANCE_SECOND_CONTEXT_FLYWAY_DISABLE_MISSING',
  );
  assert.match(
    configurationSource,
    /@ConditionalOnProperty\(name = "spring\.flyway\.enabled", havingValue = "true", matchIfMissing = true\)\s+@Bean\(initMethod = "migrate"\)\s+public Flyway businessFlyway\(/,
    'BACKEND_CUSTOM_FLYWAY_BEAN_IGNORES_STANDARD_ENABLEMENT',
  );
  assert.match(
    suiteSource.slice(builderStart),
    /getBeansOfType\(org\.flywaydb\.core\.Flyway\.class\)\s*\.isEmpty\(\)\s*,\s*"BACKEND_ACCEPTANCE_SECOND_CONTEXT_RAN_FLYWAY"/,
    'BACKEND_ACCEPTANCE_SECOND_CONTEXT_FLYWAY_ABSENCE_ASSERTION_MISSING',
  );
}

function assertAcceptanceRepositoryInputsUseExplicitRoot(buildSource, pathsSource, pathsTestSource, processSource, scenariosSource) {
  assert.match(
    buildSource,
    /systemProperty\("v2s\.acceptance\.repository-root",\s*rootProject\.projectDir\.absolutePath\)/,
    'BACKEND_ACCEPTANCE_REPOSITORY_ROOT_SYSTEM_PROPERTY_MISSING',
  );
  assert.match(
    pathsSource,
    /Path\.of\(configuredRoot\)\.toRealPath\(\)/,
    'BACKEND_ACCEPTANCE_REPOSITORY_ROOT_NOT_EXPLICIT',
  );
  assert.match(
    pathsSource,
    /repositoryRoot\.resolve\(suppliedPath\)\.normalize\(\)/,
    'BACKEND_ACCEPTANCE_REPOSITORY_INPUT_NOT_RESOLVED_FROM_ROOT',
  );
  assert.match(
    pathsSource,
    /candidate\.startsWith\(repositoryRoot\)/,
    'BACKEND_ACCEPTANCE_REPOSITORY_INPUT_LEXICAL_ESCAPE_NOT_REJECTED',
  );
  assert.match(
    pathsSource,
    /Path resolved = candidate\.toRealPath\(\);[\s\S]*?resolved\.startsWith\(repositoryRoot\)/,
    'BACKEND_ACCEPTANCE_REPOSITORY_INPUT_SYMLINK_ESCAPE_NOT_REJECTED',
  );
  assert.match(
    processSource,
    /AcceptanceRepositoryPaths\.resolveRegularFile\(\s*"scripts\/env\/tds-dev-capacity\.json"/,
    'TDS_CAPACITY_CONFIG_NOT_RESOLVED_THROUGH_REPOSITORY_INPUT_GUARD',
  );
  assert.match(
    scenariosSource,
    /private static Path terminalWireClientScript\(\) throws IOException \{\s*return AcceptanceRepositoryPaths\.resolveRegularFile\(\s*"scripts\/test\/terminal-ws-wire-client\.mjs"/,
    'TERMINAL_WIRE_CLIENT_SCRIPT_NOT_RESOLVED_THROUGH_REPOSITORY_INPUT_GUARD',
  );
  assert.match(
    pathsTestSource,
    /resolvesExplicitRootInputsAndRejectsTraversalAndSymlinkEscape/,
    'BACKEND_ACCEPTANCE_REPOSITORY_INPUT_BEHAVIOR_TEST_MISSING',
  );
  assert.doesNotMatch(
    scenariosSource,
    /Path\.of\(System\.getProperty\("user\.dir"\),\s*"scripts\/test\/terminal-ws-wire-client\.mjs"\)/,
    'TERMINAL_WIRE_CLIENT_MUST_NOT_USE_GRADLE_SUBPROJECT_WORKING_DIRECTORY',
  );
  assert.equal(
    (scenariosSource.match(/Path script = terminalWireClientScript\(\);/g) ?? []).length,
    4,
    'TERMINAL_WIRE_CLIENT_REPOSITORY_PATH_CALLSITE_DENOMINATOR_MISMATCH',
  );
}

function assertSecondWebServerContextUsesReturnedContext(source) {
  const builderStart = source.indexOf('secondBusinessContext = new SpringApplicationBuilder(');
  assert.notEqual(builderStart, -1, 'BACKEND_ACCEPTANCE_SECOND_CONTEXT_BUILDER_MISSING');
  const portRead = source.indexOf('secondBusinessPort =', builderStart);
  assert.notEqual(portRead, -1, 'BACKEND_ACCEPTANCE_SECOND_CONTEXT_PORT_READ_MISSING');
  const startup = source.slice(builderStart, portRead);
  assert.match(
    startup,
    /secondBusinessContext\s+instanceof\s+WebServerApplicationContext/,
    'BACKEND_ACCEPTANCE_SECOND_CONTEXT_NOT_TYPE_CHECKED',
  );
  assert.match(
    startup,
    /WebServerApplicationContext\s+secondWebContext\s*=\s*\(WebServerApplicationContext\)\s*secondBusinessContext\s*;/,
    'BACKEND_ACCEPTANCE_WEB_SERVER_CONTEXT_MUST_USE_RETURNED_CONTEXT',
  );
  assert.doesNotMatch(
    startup,
    /secondBusinessContext\.getBean\(WebServerApplicationContext\.class\)/,
    'BACKEND_ACCEPTANCE_APPLICATION_CONTEXT_IS_NOT_A_BEAN',
  );
}

function maskJavaTrivia(source) {
  const chars = source.split('');
  const blank = (start, end) => {
    for (let index = start; index < end; index += 1) {
      if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
    }
  };
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('//', index)) {
      const newline = source.indexOf('\n', index + 2);
      const end = newline === -1 ? source.length : newline;
      blank(index, end);
      index = end;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const endMarker = source.indexOf('*/', index + 2);
      const end = endMarker === -1 ? source.length : endMarker + 2;
      blank(index, end);
      index = end;
      continue;
    }
    if (source.startsWith('"""', index)) {
      const start = index;
      index += 3;
      while (index < source.length && !(source.startsWith('"""', index) && source[index - 1] !== '\\')) {
        index += 1;
      }
      index += source.startsWith('"""', index) ? 3 : 0;
      blank(start, index);
      continue;
    }
    if (source[index] === '"' || source[index] === "'") {
      const start = index;
      const quote = source[index];
      index += 1;
      while (index < source.length) {
        if (source[index] === '\\') {
          index += 2;
          continue;
        }
        if (source[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      blank(start, index);
      continue;
    }
    index += 1;
  }
  return chars.join('');
}

function braceDepthAt(maskedSource, offset) {
  let depth = 0;
  for (let index = 0; index < offset; index += 1) {
    if (maskedSource[index] === '{') depth += 1;
    if (maskedSource[index] === '}') depth = Math.max(0, depth - 1);
  }
  return depth;
}

function classNameOf(source, file) {
  const masked = maskJavaTrivia(source);
  const pattern =
    /\b(?:(?:public|protected|private|abstract|static|final|sealed|non-sealed)\s+)*class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
  for (const match of masked.matchAll(pattern)) {
    if (braceDepthAt(masked, match.index) === 0) return match[1];
  }
  assert.fail('top-level class is missing: ' + file);
}

function acceptanceScenarioIds(source, masked) {
  const ids = [];
  for (const match of masked.matchAll(/@AcceptanceScenario\s*\(/g)) {
    const end = masked.indexOf(')', match.index);
    const annotation = source.slice(match.index, end === -1 ? source.length : end + 1);
    const id = annotation.match(/\bid\s*=\s*"([^"]+)"/);
    if (id) ids.push(id[1]);
  }
  return ids;
}

function hasExecutableConsumerReference(maskedBlock, className) {
  const escaped = escapeRegExp(className);
  return (
    new RegExp('\\bnew\\s+' + escaped + '\\s*\\(').test(maskedBlock) ||
    new RegExp('\\b' + escaped + '\\s*\\.\\s*[A-Za-z_$][A-Za-z0-9_$]*\\s*\\(').test(maskedBlock) ||
    new RegExp('\\b' + escaped + '\\s*::').test(maskedBlock)
  );
}

function explicitTestConsumers(suite, maskedSuite, className) {
  const consumers = [];
  const matches = [...maskedSuite.matchAll(/@Test\b/g)];
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index;
    const end = matches[index + 1]?.index ?? maskedSuite.length;
    const maskedBlock = maskedSuite.slice(start, end);
    const classPattern = new RegExp('\\b' + escapeRegExp(className) + '\\b');
    if (!classPattern.test(maskedBlock)) continue;
    if (!hasExecutableConsumerReference(maskedBlock, className)) continue;
    const docStart = suite.lastIndexOf('/**', start);
    const docEnd = docStart === -1 ? -1 : suite.indexOf('*/', docStart) + 2;
    const sourceStart =
      docStart >= 0 && docEnd >= 2 && docEnd <= start && /^[\s@]*$/.test(suite.slice(docEnd, start))
        ? docStart
        : start;
    consumers.push({
      start,
      end,
      source: suite.slice(sourceStart, end),
      conditional: /@(?:Enabled|Disabled)[A-Za-z0-9_]*/.test(maskedBlock),
    });
  }
  return consumers;
}

function assertConditionalConsumerIsDocumented(consumer, className) {
  if (!consumer.conditional) return;
  assert.match(
    consumer.source,
    /disabled by default|default[- ]disabled|absent or not true|not enabled by default/i,
    className + ' conditional consumer must document its default status',
  );
  assert.match(
    consumer.source,
    /explicit (?:enablement|enable)|requires setting|set .* to true|enable.*setting/i,
    className + ' conditional consumer must document explicit enablement',
  );
}

export function validateAcceptanceStructure(repositoryRoot = root) {
  const rootAcceptance = path.join(
    repositoryRoot,
    'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance',
  );
  const rootSuitePath = path.join(rootAcceptance, 'BackendAcceptanceTest.java');
  const catalogPath = path.join(rootAcceptance, 'BackendAcceptanceScenarioCatalog.java');
  const suite = readFileSync(rootSuitePath, 'utf8');
  const maskedSuite = maskJavaTrivia(suite);
  const catalog = maskJavaTrivia(readFileSync(catalogPath, 'utf8'));
  assert.match(maskedSuite, /BackendAcceptanceScenarioCatalog\.discover\(this\)/);

  const files = readdirSync(rootAcceptance)
    .filter(file => file.endsWith('Scenarios.java'))
    .sort();
  assert.ok(files.length > 0, 'acceptance scenario directory is empty');
  const ids = [];
  for (const file of files) {
    const source = readFileSync(path.join(rootAcceptance, file), 'utf8');
    const maskedSource = maskJavaTrivia(source);
    const className = classNameOf(source, file);
    const annotated = /@AcceptanceScenario\s*\(/.test(maskedSource);
    if (annotated) {
      assert.match(catalog, new RegExp(`\\bnew\\s+${escapeRegExp(className)}\\(host\\)`), `${file} is not registered`);
    } else {
      const consumers = explicitTestConsumers(suite, maskedSuite, className);
      assert.ok(consumers.length > 0, `${file} has no explicit @Test consumer`);
      for (const consumer of consumers) assertConditionalConsumerIsDocumented(consumer, className);
    }
    ids.push(...acceptanceScenarioIds(source, maskedSource));
  }
  assert.ok(ids.length > 0);
  assert.equal(new Set(ids).size, ids.length);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('backend acceptance discovers every real scenario file through a group or explicit host consumer', () => {
  validateAcceptanceStructure(root);
});

test('business application dependency declarations exclude the separately launched TDS project', () => {
  const buildSource = readFileSync(businessBuildPath, 'utf8');
  assertNoTerminalDataServerDependencyInBusinessApp(buildSource);
  const mutated = buildSource.replace(
    'testRuntimeOnly("org.junit.platform:junit-platform-launcher")',
    'testRuntimeOnly(project(":apps:backend:terminal-data-server"))\n    testRuntimeOnly("org.junit.platform:junit-platform-launcher")',
  );
  assert.notEqual(mutated, buildSource, 'classpath red fixture anchor must exist');
  assert.throws(
    () => assertNoTerminalDataServerDependencyInBusinessApp(mutated),
    /BACKEND_ACCEPTANCE_TDS_ON_BUSINESS_TEST_RUNTIME_CLASSPATH/,
  );
});

test('acceptance containers start before Spring resolves mapped-port dynamic properties', () => {
  const source = readFileSync(suitePath, 'utf8');
  assertAcceptanceContainersStartBeforeDynamicProperties(source);
  const postgresMutation = source.replace('if (!POSTGRES.isRunning()) POSTGRES.start();', '');
  assert.notEqual(postgresMutation, source, 'PostgreSQL start-order red fixture anchor must exist');
  assert.throws(
    () => assertAcceptanceContainersStartBeforeDynamicProperties(postgresMutation),
    /BACKEND_ACCEPTANCE_POSTGRES_CONTAINER_START_ORDER_INVALID/,
  );
  const minioMutation = source.replace('if (!MINIO.isRunning()) MINIO.start();', '');
  assert.notEqual(minioMutation, source, 'MinIO start-order red fixture anchor must exist');
  assert.throws(
    () => assertAcceptanceContainersStartBeforeDynamicProperties(minioMutation),
    /BACKEND_ACCEPTANCE_MINIO_CONTAINER_START_ORDER_INVALID/,
  );
});

test('transactional Spring components remain proxyable', () => {
  const sources = productionJavaSources(backendRoot);
  assertTransactionalSpringBeansRemainProxyable(sources);
  for (const {path: filePath, className} of [
    {
      path: path.join(root, 'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/ActivateTerminalOperation.java'),
      className: 'ActivateTerminalOperation',
    },
    {
      path: path.join(root, 'apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/application/CancelTerminalActivationOperation.java'),
      className: 'CancelTerminalActivationOperation',
    },
  ]) {
    const source = readFileSync(filePath, 'utf8');
    const mutation = source.replace(`public class ${className}`, `public final class ${className}`);
    assert.notEqual(mutation, source, `${className} proxyability red fixture anchor must exist`);
    const mutatedSources = sources.map(candidate =>
      candidate.path === filePath ? {...candidate, source: mutation} : candidate,
    );
    assert.throws(
      () => assertTransactionalSpringBeansRemainProxyable(mutatedSources),
      /BACKEND_TRANSACTIONAL_SPRING_COMPONENT_NOT_PROXYABLE/,
    );
  }
});

test('second business web server port is read from its returned context instance', () => {
  const source = readFileSync(suitePath, 'utf8');
  assertSecondWebServerContextUsesReturnedContext(source);
  const mutation = source.replace(
    'WebServerApplicationContext secondWebContext = (WebServerApplicationContext) secondBusinessContext;',
    'WebServerApplicationContext secondWebContext = secondBusinessContext.getBean(WebServerApplicationContext.class);',
  );
  assert.notEqual(mutation, source, 'second context lookup red fixture anchor must exist');
  assert.throws(
    () => assertSecondWebServerContextUsesReturnedContext(mutation),
    /BACKEND_ACCEPTANCE_WEB_SERVER_CONTEXT_MUST_USE_RETURNED_CONTEXT/,
  );
});

test('secondary business context excludes acceptance-only test configuration', () => {
  const source = readFileSync(suitePath, 'utf8');
  const metricsConfiguration = readFileSync(metricsConfigurationPath, 'utf8');
  assertSecondBusinessContextIsIsolatedFromAcceptanceTestConfiguration(source, metricsConfiguration);
  const mutated = source.replace(
    '.web(WebApplicationType.SERVLET)\n                .run();',
    '.web(WebApplicationType.SERVLET)\n                .sources(BackendAcceptanceMetricsConfiguration.class)\n                .run();',
  );
  assert.notEqual(mutated, source, 'second metrics sink red fixture anchor must exist');
  assert.throws(
    () => assertSecondBusinessContextIsIsolatedFromAcceptanceTestConfiguration(mutated, metricsConfiguration),
    /BACKEND_ACCEPTANCE_SECOND_CONTEXT_REPLACED_METRICS_SINK/,
  );
  const profileMutation = source.replace('.profiles("backend-acceptance-secondary")\n', '');
  assert.notEqual(profileMutation, source, 'secondary profile red fixture anchor must exist');
  assert.throws(
    () => assertSecondBusinessContextIsIsolatedFromAcceptanceTestConfiguration(profileMutation, metricsConfiguration),
    /BACKEND_ACCEPTANCE_SECOND_CONTEXT_PROFILE_MISSING/,
  );
  const configurationMutation = metricsConfiguration.replace('@Profile("!backend-acceptance-secondary")\n', '');
  assert.notEqual(configurationMutation, metricsConfiguration, 'test configuration profile red fixture anchor must exist');
  assert.throws(
    () => assertSecondBusinessContextIsIsolatedFromAcceptanceTestConfiguration(source, configurationMutation),
    /BACKEND_ACCEPTANCE_SECOND_CONTEXT_TEST_CONFIGURATION_LEAK/,
  );
});

test('custom Flyway bean honors the secondary context migration switch', () => {
  const suite = readFileSync(suitePath, 'utf8');
  const configuration = readFileSync(businessDataConfigurationPath, 'utf8');
  assertCustomFlywayBeanHonorsStandardEnablement(suite, configuration);
  const migrationSwitchMutation = suite.replace('properties.put("spring.flyway.enabled", false);\n', '');
  assert.notEqual(migrationSwitchMutation, suite, 'secondary Flyway switch red fixture anchor must exist');
  assert.throws(
    () => assertCustomFlywayBeanHonorsStandardEnablement(migrationSwitchMutation, configuration),
    /BACKEND_ACCEPTANCE_SECOND_CONTEXT_FLYWAY_DISABLE_MISSING/,
  );
  const beanConditionMutation = configuration.replace(
    '@ConditionalOnProperty(name = "spring.flyway.enabled", havingValue = "true", matchIfMissing = true)\n',
    '',
  );
  assert.notEqual(beanConditionMutation, configuration, 'custom Flyway condition red fixture anchor must exist');
  assert.throws(
    () => assertCustomFlywayBeanHonorsStandardEnablement(suite, beanConditionMutation),
    /BACKEND_CUSTOM_FLYWAY_BEAN_IGNORES_STANDARD_ENABLEMENT/,
  );
});

test('acceptance repository inputs resolve only beneath the explicit Gradle root', () => {
  const buildSource = readFileSync(businessBuildPath, 'utf8');
  const pathsSource = readFileSync(repositoryPathsPath, 'utf8');
  const pathsTestSource = readFileSync(repositoryPathsTestPath, 'utf8');
  const processSource = readFileSync(tdsProcessPath, 'utf8');
  const scenariosSource = readFileSync(terminalContractScenariosPath, 'utf8');
  assertAcceptanceRepositoryInputsUseExplicitRoot(buildSource, pathsSource, pathsTestSource, processSource, scenariosSource);

  const buildMutation = buildSource.replace(
    '    systemProperty("v2s.acceptance.repository-root", rootProject.projectDir.absolutePath)\n',
    '',
  );
  assert.notEqual(buildMutation, buildSource, 'repository-root system-property red fixture anchor must exist');
  assert.throws(
    () => assertAcceptanceRepositoryInputsUseExplicitRoot(buildMutation, pathsSource, pathsTestSource, processSource, scenariosSource),
    /BACKEND_ACCEPTANCE_REPOSITORY_ROOT_SYSTEM_PROPERTY_MISSING/,
  );

  const workingDirectoryMutation = pathsSource.replace(
    'Path.of(configuredRoot).toRealPath()',
    'Path.of(System.getProperty("user.dir")).toRealPath()',
  );
  assert.notEqual(workingDirectoryMutation, pathsSource, 'repository-root source red fixture anchor must exist');
  assert.throws(
    () => assertAcceptanceRepositoryInputsUseExplicitRoot(buildSource, workingDirectoryMutation, pathsTestSource, processSource, scenariosSource),
    /BACKEND_ACCEPTANCE_REPOSITORY_ROOT_NOT_EXPLICIT/,
  );

  const callerMutation = scenariosSource.replaceAll(
    'Path script = terminalWireClientScript();',
    'Path script = Path.of(System.getProperty("user.dir"), "scripts/test/terminal-ws-wire-client.mjs");',
  );
  assert.notEqual(callerMutation, scenariosSource, 'terminal client path red fixture anchor must exist');
  assert.throws(
    () => assertAcceptanceRepositoryInputsUseExplicitRoot(buildSource, pathsSource, pathsTestSource, processSource, callerMutation),
    /TERMINAL_WIRE_CLIENT_MUST_NOT_USE_GRADLE_SUBPROJECT_WORKING_DIRECTORY/,
  );

  const escapeMutation = pathsSource.replace(
    'if (!resolved.startsWith(repositoryRoot)) throw new IllegalStateException(escapeFailure);',
    '',
  );
  assert.notEqual(escapeMutation, pathsSource, 'repository path-boundary red fixture anchor must exist');
  assert.throws(
    () => assertAcceptanceRepositoryInputsUseExplicitRoot(buildSource, escapeMutation, pathsTestSource, processSource, scenariosSource),
    /BACKEND_ACCEPTANCE_REPOSITORY_INPUT_SYMLINK_ESCAPE_NOT_REJECTED/,
  );
});

test('registration-gate waits race client exit and retain credential-safe stage diagnostics', () => {
  const brokerSource = readFileSync(registrationGateBrokerPath, 'utf8');
  const scenariosSource = readFileSync(terminalContractScenariosPath, 'utf8');
  const handlerSource = readFileSync(tdsWebSocketHandlerPath, 'utf8');
  assert.match(
    brokerSource,
    /CompletableFuture\.anyOf\(observed,\s*competingCompletion\)/,
    'TDS_REGISTRATION_GATE_MUST_RACE_OBSERVATION_WITH_CLIENT_EXIT',
  );
  assert.match(
    brokerSource,
    /if \(observed\.isDone\(\) && !observed\.isCompletedExceptionally\(\)\) return observed\.getNow\(null\);/,
    'TDS_REGISTRATION_GATE_RESULT_MUST_BE_SELECTED_BY_FUTURE_IDENTITY',
  );
  assert.doesNotMatch(brokerSource, /completion instanceof String/);
  assert.match(brokerSource, /TDS_REGISTRATION_GATE_CLIENT_EXITED_BEFORE_OBSERVED/);
  assert.match(brokerSource, /TDS_REGISTRATION_GATE_OBSERVATION_DEADLINE_EXCEEDED/);
  assert.equal(
    (scenariosSource.match(/awaitRegistrationGateObservation\(/g) ?? []).length,
    6,
    'TDS_REGISTRATION_GATE_WAIT_CALLSITE_DENOMINATOR_MISMATCH',
  );
  assert.equal(
    (scenariosSource.match(/\.awaitObserved\(/g) ?? []).length,
    1,
    'TDS_REGISTRATION_GATE_BROKER_WAIT_MUST_BE_CENTRALIZED',
  );
  assert.match(
    scenariosSource,
    /return gate\.awaitObserved\(timeout,\s*wireClient\.onExit\(\)\)/,
    'TDS_REGISTRATION_GATE_CENTRAL_WAIT_MUST_RACE_CLIENT_EXIT',
  );
  for (const event of [
    'event=tds_ws_accepted connectionId={} sessionId={}',
    'event=tds_ws_first_frame_received',
    'event=tds_ws_authentication_frame_decoded',
    'event=tds_ws_session_attempt_begin_started',
    'event=tds_ws_authentication_failed',
    'event=tds_ws_authentication_rejected',
    'event=tds_ws_receive_failed',
    'event=tds_ws_session_attempt_begun',
    'event=tds_ws_credential_verification_started',
    'event=tds_ws_credential_verification_completed',
    'event=tds_ws_pre_registration_gate_entered',
    'event=tds_ws_pre_registration_gate_released',
    'event=tds_ws_session_registration_completed',
    'event=tds_ws_credential_verified',
    'event=tds_ws_handler_finished connectionId={}',
  ]) {
    assert.ok(handlerSource.includes(event), `TDS_AUTH_DIAGNOSTIC_STAGE_MISSING:${event}`);
  }
  const authStageOrder = [
    'event=tds_ws_first_frame_received',
    'event=tds_ws_authentication_frame_decoded',
    'event=tds_ws_session_attempt_begin_started',
    'event=tds_ws_session_attempt_begun',
    'event=tds_ws_credential_verification_started',
    'event=tds_ws_credential_verification_completed',
    'event=tds_ws_verification_recorded',
    'event=tds_ws_pre_registration_gate_entered',
    'event=tds_ws_pre_registration_gate_released',
    'event=tds_ws_session_registration_completed',
    'event=tds_ws_credential_verified',
  ].map(event => handlerSource.indexOf(event));
  assert.ok(
    authStageOrder.every((position, index) => position >= 0 && (index === 0 || position > authStageOrder[index - 1])),
    'TDS_AUTH_DIAGNOSTIC_STAGES_MUST_REMAIN_ORDERED',
  );
  const diagnosticLines = handlerSource
    .split('\n')
    .filter(line => line.includes('event=tds_ws_accepted')
      || line.includes('event=tds_ws_first_frame_received')
      || line.includes('event=tds_ws_authentication_frame_decoded')
      || line.includes('event=tds_ws_session_attempt_begin_started')
      || line.includes('event=tds_ws_authentication_failed')
      || line.includes('event=tds_ws_receive_failed')
      || line.includes('event=tds_ws_session_attempt_begun')
      || line.includes('event=tds_ws_credential_verification_started')
      || line.includes('event=tds_ws_credential_verification_completed')
      || line.includes('event=tds_ws_pre_registration_gate_entered')
      || line.includes('event=tds_ws_pre_registration_gate_released')
      || line.includes('event=tds_ws_session_registration_completed')
      || line.includes('event=tds_ws_handler_finished'))
    .join('\n');
  assert.doesNotMatch(
    diagnosticLines,
    /terminalCredential|payloadAsText|authenticate\.secret/i,
    'TDS_AUTH_DIAGNOSTICS_MUST_NOT_INCLUDE_CREDENTIAL_OR_FRAME_CONTENT',
  );
  assert.match(handlerSource, /diagnostic\.stage\(\)/, 'TDS_AUTH_DIAGNOSTIC_STAGE_MUST_BE_EMITTED');
  const receiveFailureStart = handlerSource.indexOf('event=tds_ws_receive_failed');
  const receiveFailureEnd = handlerSource.indexOf('\n                })\n                .doFinally', receiveFailureStart);
  assert.ok(
    receiveFailureStart >= 0 && receiveFailureEnd > receiveFailureStart,
    'TDS_RECEIVE_FAILURE_BRANCH_MISSING',
  );
  const receiveFailureBranch = handlerSource.slice(receiveFailureStart, receiveFailureEnd);
  assert.match(
    receiveFailureBranch,
    /rootFailureType=\{\} sqlState=\{\} disposition=TRANSPORT_TERMINATED/,
    'TDS_RECEIVE_FAILURE_MUST_RETAIN_SAFE_ROOT_DIAGNOSTICS_WITHOUT_APPLICATION_CLOSE',
  );
  assert.ok(receiveFailureBranch.includes('applicationClose=NONE'));
  assert.match(receiveFailureBranch, /diagnostic\.rootFailureType\(\)[\s\S]*?diagnostic\.sqlState\(\)/);
  assert.match(receiveFailureBranch, /return Mono\.empty\(\);/);
  assert.doesNotMatch(
    handlerSource,
    /close\(connection,\s*"NETWORK_ERROR"\)/,
    'TDS_MUST_NOT_EMIT_CLIENT_CLASSIFIED_NETWORK_ERROR',
  );
  assert.match(
    handlerSource,
    /event=tds_ws_authentication_rejected[\s\S]*?rootFailureType=\{\} sqlState=\{\} closeReason=\{\}[\s\S]*?diagnostic\.stage\(\)[\s\S]*?diagnostic\.rootFailureType\(\)[\s\S]*?diagnostic\.sqlState\(\)[\s\S]*?closeReason/,
    'TDS_AUTHENTICATION_REJECTION_MUST_LOG_STAGE_ROOT_AND_CLOSE_REASON',
  );
  assert.match(
    scenariosSource,
    /"event=tds_ws_authentication_failed"/,
    'TDS_GATE_FAILURE_SUMMARY_MUST_RETAIN_AUTHENTICATION_FAILURE_EVENT',
  );
  assert.match(
    scenariosSource,
    /awaitTdsScenarioLogAfterOffset\(\s*tds,\s*tdsLogOffset,\s*"event=tds_ws_handler_finished"/,
    'V_S14_MUST_READ_THE_RUN_SCOPED_TDS_LOG_SLICE_TO_HANDLER_COMPLETION',
  );
  assert.doesNotMatch(
    scenariosSource,
    /event=tds_ws_credential_verified terminalRef=/,
    'V_S14_MUST_MATCH_THE_ACTUAL_CREDENTIAL_VERIFIED_LOG_FIELDS',
  );
  assert.ok(
    handlerSource.includes('event=tds_ws_credential_verified connectionId={} sessionId={}'),
    'TDS_CREDENTIAL_VERIFIED_DIAGNOSTIC_FIELD_TEMPLATE_MISSING',
  );
});

test('TDS wire-control producer and Java result consumer reject missing or misspelled fields', () => {
  const wireClientSource = readFileSync(terminalWireClientPath, 'utf8');
  assert.match(
    wireClientSource,
    /Object\.keys\(request\)\.some\(field => !allowedControlFields\.has\(field\)\)/,
    'TDS_WIRE_CONTROL_MUST_REJECT_UNKNOWN_ROOT_FIELDS',
  );
  assert.match(
    wireClientSource,
    /const expectedFields = Object\.hasOwn\(expectedClose, 'reason'\) \? 'code,reason' : 'code';[\s\S]*?closeFields\.join\(','\) !== expectedFields/,
    'TDS_WIRE_CONTROL_CLOSE_EXPECTATION_MUST_BE_CLOSED',
  );
  assert.match(
    wireClientSource,
    /scenario === 'terminal\.connection\.frame\.raw-overflow'[\s\S]*?return \{code: 1009\};/,
    'TDS_WIRE_CONTROL_1009_EXPECTATION_MUST_NOT_REQUIRE_REASON_TEXT',
  );

  const scenariosSource = readFileSync(terminalContractScenariosPath, 'utf8');
  const helperStart = scenariosSource.indexOf('private static List<String> strings(JsonNode node) {');
  const helperEnd = scenariosSource.indexOf('\n    }', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, 'TDS_WIRE_RESULT_ARRAY_READER_MISSING');
  const helper = scenariosSource.slice(helperStart, helperEnd);
  assert.match(helper, /Assertions\.assertTrue\(node\.isArray\(\)/, 'TDS_WIRE_RESULT_ARRAY_MUST_BE_PRESENT');
  assert.match(helper, /Assertions\.assertTrue\(value\.isTextual\(\)/, 'TDS_WIRE_RESULT_ARRAY_VALUES_MUST_BE_TEXT');
  assert.doesNotMatch(helper, /if \(node\.isArray\(\)\)/, 'TDS_WIRE_RESULT_MUST_NOT_DEFAULT_MISSING_ARRAY_TO_EMPTY');
});

test('terminal activation and TDS routes agree on the workspace key grammar', () => {
  const javaPattern = '[A-Za-z0-9][A-Za-z0-9_-]{0,63}';
  const expectedSchema = {
    type: 'string',
    minLength: 1,
    maxLength: 64,
    pattern: `^${javaPattern}$`,
  };
  const findOperation = (paths, operationId) => {
    for (const pathItem of Object.values(paths)) {
      for (const operation of Object.values(pathItem)) {
        if (operation?.operationId === operationId) return operation;
      }
    }
    assert.fail(`TERMINAL_OPENAPI_OPERATION_MISSING:${operationId}`);
  };
  const operationSchemas = [
    [terminalActivationPathsPath, 'activateTerminal'],
    [terminalActivationPathsPath, 'cancelTerminalActivation'],
    [operationsStoreTerminalPathsPath, 'cancelOperationsStoreTerminalActivation'],
  ].map(([pathName, operationId]) => {
    const document = JSON.parse(readFileSync(pathName, 'utf8'));
    const parameter = findOperation(document.paths, operationId).parameters
      .find(candidate => candidate.name === 'groupWorkspaceKey' && candidate.in === 'path');
    assert.ok(parameter, `TERMINAL_OPENAPI_GROUP_WORKSPACE_KEY_MISSING:${operationId}`);
    return [operationId, parameter.schema];
  });
  for (const [operationId, schema] of operationSchemas) {
    assert.deepEqual(schema, expectedSchema, `TERMINAL_OPENAPI_GROUP_WORKSPACE_KEY_GRAMMAR_MISMATCH:${operationId}`);
  }

  const sourceSchemas = JSON.parse(readFileSync(terminalBindingSchemasPath, 'utf8'));
  assert.deepEqual(
    sourceSchemas.components.schemas.TerminalActivationResult.properties.groupWorkspaceKey,
    expectedSchema,
    'TERMINAL_ACTIVATION_RESULT_GROUP_WORKSPACE_KEY_GRAMMAR_MISMATCH',
  );

  for (const sourcePath of [
    workspaceAdministrationServicePath,
    terminalBindingOwnerApiPath,
    terminalCredentialVerificationApiPath,
    activateTerminalOperationPath,
    tdsWebSocketHandlerPath,
  ]) {
    assert.ok(
      readFileSync(sourcePath, 'utf8').includes(javaPattern),
      `TERMINAL_GROUP_WORKSPACE_KEY_RUNTIME_GRAMMAR_MISMATCH:${path.relative(root, sourcePath)}`,
    );
  }
  const wireClientSource = readFileSync(terminalWireClientPath, 'utf8');
  assert.ok(
    wireClientSource.includes(String.raw`\/tdp\/${javaPattern}\/ws`),
    'TERMINAL_WIRE_CLIENT_GROUP_WORKSPACE_KEY_GRAMMAR_MISMATCH',
  );
});

test('all generated groupWorkspaceKey path parameters match the workspace owner grammar', () => {
  const expectedSchema = {
    type: 'string',
    minLength: 1,
    maxLength: 64,
    pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$',
  };
  const pathRoot = path.join(root, 'contracts/openapi/paths');
  const jsonFiles = directory => readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return jsonFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : [];
  });
  let checked = 0;
  for (const pathDocumentPath of jsonFiles(pathRoot)) {
    const pathDocument = JSON.parse(readFileSync(pathDocumentPath, 'utf8'));
    for (const [route, pathItem] of Object.entries(pathDocument.paths || {})) {
      for (const operation of Object.values(pathItem)) {
        if (!operation || typeof operation !== 'object' || !operation.operationId) continue;
        for (const parameter of operation.parameters || []) {
          if (parameter.name !== 'groupWorkspaceKey' || parameter.in !== 'path') continue;
          checked++;
          assert.deepEqual(
            parameter.schema,
            expectedSchema,
            `GROUP_WORKSPACE_KEY_PATH_SCHEMA_MISMATCH:${path.relative(root, pathDocumentPath)}:${route}:${operation.operationId}`,
          );
        }
      }
    }
  }
  assert.ok(checked > 0, 'GROUP_WORKSPACE_KEY_PATH_PARAMETER_DENOMINATOR_EMPTY');
});

test('V-S12 restores PostgreSQL, terminates its exact listener and holds recovery for HTTP revocation', () => {
  const scenariosSource = readFileSync(terminalContractScenariosPath, 'utf8');
  const start = scenariosSource.indexOf('private static void v12DatabaseOutageScenario(');
  const end = scenariosSource.indexOf('\n    private static void assertPendingWriterQueueBounds(', start);
  assert.ok(start >= 0 && end > start, 'V_S12_SCENARIO_METHOD_NOT_FOUND');
  const scenario = scenariosSource.slice(start, end);
  const positions = [
    scenario.indexOf('host.pausePostgresContainer();'),
    scenario.indexOf('while (System.nanoTime() < outageDeadline)'),
    scenario.indexOf('assertPendingWriterQueueBounds('),
    scenario.indexOf('host.unpausePostgresContainer();'),
    scenario.indexOf('host.terminatePostgresBackend(oldBackendPid)'),
    scenario.indexOf('tds.awaitListenerDisconnectedAfter(oldBackendPid, tdsLogOffset,'),
    scenario.indexOf('awaitRegistrationGateObservation('),
    scenario.indexOf('business.performConnectionRevocation('),
    scenario.indexOf('recoveryGate.release(attemptId);'),
  ];
  assert.ok(positions.every(position => position >= 0), 'V_S12_RECOVERY_SEQUENCE_STEP_MISSING');
  assert.deepEqual(
    positions,
    [...positions].sort((left, right) => left - right),
    'V_S12_MUST_RESTORE_DATABASE_AND_TERMINATE_THE_EXACT_LISTENER_BEFORE_HELD_RECOVERY_AND_HTTP_REVOCATION',
  );
  for (const diagnostic of [
    'listenerBackendPid',
    'listenerTerminationAttempted',
    'listenerTerminationSignalAccepted',
    'listenerDisconnectObserved',
    'listenerRecoveryGateObserved',
  ]) {
    assert.ok(scenario.includes(diagnostic), `V_S12_SAFE_LISTENER_DIAGNOSTIC_MISSING:${diagnostic}`);
  }
});

test('V-S12 focused diagnostic selects exactly the 30-second outage scenario for its business operation', () => {
  const suite = readFileSync(suitePath, 'utf8');
  const factoryStart = suite.indexOf('Stream<DynamicTest> terminalConnectionDatabaseOutageContracts()');
  const factoryEnd = suite.indexOf('\n    @DynamicPropertySource', factoryStart);
  assert.ok(factoryStart >= 0 && factoryEnd > factoryStart, 'V_S12_DIAGNOSTIC_FACTORY_BOUNDARY_MISSING');
  const factory = suite.slice(factoryStart, factoryEnd);
  assert.match(factory, /V2S_BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC/);
  assert.match(factory, /BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC_OPERATION_MISMATCH/);
  assert.match(factory, /BACKEND_ACCEPTANCE_TDS_CONTRACT_SELECTION operation=%s diagnostic=V-S12-30s/);
  assert.match(factory, /v12DatabaseOutage30SecondDiagnostic\(this, tdsAcceptanceProcess\)/);
  assert.match(factory, /if \(!"all"\.equals\(selectedOperation\) && !v12Diagnostic\) return Stream\.empty\(\)/);

  const scenarios = readFileSync(terminalContractScenariosPath, 'utf8');
  const diagnosticStart = scenarios.indexOf('static Stream<DynamicTest> v12DatabaseOutage30SecondDiagnostic(');
  const diagnosticEnd = scenarios.indexOf('\n    private static DynamicTest v12DatabaseOutageTest', diagnosticStart);
  assert.ok(diagnosticStart >= 0 && diagnosticEnd > diagnosticStart, 'V_S12_30_SECOND_DIAGNOSTIC_METHOD_MISSING');
  const diagnostic = scenarios.slice(diagnosticStart, diagnosticEnd);
  assert.match(diagnostic, /Stream\.of\(v12DatabaseOutageTest\(host, tds, 30\)\)/);
  assert.doesNotMatch(diagnostic, /v12DatabaseOutageTest\(host, tds, 10\)/);
  assert.match(scenarios, /"terminal\.connection\.vs12\.database-outage-" \+ outageSeconds/);
});

test('terminal activation HTTP routes use payload-free owner and outcome diagnostics', () => {
  const registry = JSON.parse(readFileSync(terminalRouteRegistryPath, 'utf8'));
  const routes = new Map(registry.operations.map(operation => [operation.operationId, operation]));
  for (const [operationId, routePath] of [
    ['activateTerminal', '/api/terminal/group-workspaces/{groupWorkspaceKey}/activation'],
    [
      'cancelTerminalActivation',
      '/api/terminal/group-workspaces/{groupWorkspaceKey}/terminals/{terminalRef}/activation/cancel',
    ],
  ]) {
    const route = routes.get(operationId);
    assert.ok(route, `TERMINAL_HTTP_DIAGNOSTIC_ROUTE_MISSING:${operationId}`);
    assert.deepEqual(
      {
        operationId: route.operationId,
        method: route.method,
        path: route.path,
        consumerFaces: route.consumerFaces,
        owner: route.owner,
      },
      {
        operationId,
        method: 'POST',
        path: routePath,
        consumerFaces: ['terminal'],
        owner: 'terminal-binding',
      },
      `TERMINAL_HTTP_DIAGNOSTIC_ROUTE_REGISTRY_INVALID:${operationId}`,
    );
  }
  const interceptor = readFileSync(requestCompletionInterceptorPath, 'utf8');
  assert.match(interceptor, /definitions\.get\(method \+ " " \+ pattern\)/);
  assert.match(interceptor, /recorder\.recordCompletion\(event\)/);
  assert.match(interceptor, /if \(isPublicSecurity\(handler\) \|\| isManagedDiagnosticRequest\(request\)\) return true/);
  const recorder = readFileSync(requestCompletionRecorderPath, 'utf8');
  for (const field of [
    'operationId',
    'routeTemplate',
    'owner',
    'consumerFace',
    'outcome',
    'durationMillis',
    'status',
    'errorCode',
    'databaseOperationCount',
    'databaseDurationMillis',
  ]) {
    assert.ok(recorder.includes(`addKeyValue("${field}"`), `TERMINAL_HTTP_DIAGNOSTIC_FIELD_MISSING:${field}`);
  }
  assert.doesNotMatch(interceptor + recorder, /getInputStream\(|getReader\(|getParameterMap\(/);
});

test('V-S12 persists a safe TDS CONTRACT failure before outage cleanup', () => {
  const source = readFileSync(terminalContractScenariosPath, 'utf8');
  const start = source.indexOf('private static void v12DatabaseOutageScenario(');
  const end = source.indexOf('\n    private static void assertPendingWriterQueueBounds', start);
  assert.ok(start >= 0 && end > start, 'V_S12_DATABASE_OUTAGE_SCENARIO_BOUNDARY_MISSING');
  const scenario = source.slice(start, end);
  const catchPosition = scenario.indexOf('} catch (Exception | Error failure) {');
  const failureReceiptPosition = scenario.indexOf('Map.entry("contract", "FAIL")', catchPosition);
  const rethrowPosition = scenario.indexOf('throw failure;', catchPosition);
  assert.ok(catchPosition >= 0, 'V_S12_DATABASE_OUTAGE_FAILURE_HANDLER_MISSING');
  assert.ok(
    failureReceiptPosition > catchPosition && failureReceiptPosition < rethrowPosition,
    'V_S12_FAILURE_RECEIPT_MUST_PRECEDE_SCENARIO_RETHROW',
  );
  assert.ok(scenario.includes('TDS_VS12_DATABASE_OUTAGE_SCENARIO_FAILED'));
  assert.ok(scenario.includes('safeFailureType(failure)'));
  assert.ok(scenario.includes('safeRootFailureType(failure)'));
  assert.ok(scenario.includes('postgresPausedAtFailure'));
  assert.ok(scenario.includes('authenticationElapsedMillis'));
  assert.ok(scenario.includes('scenarioElapsedMillis'));
  assert.ok(scenario.includes('authenticationAttemptElapsedMillis'));
  assert.ok(scenario.includes('authenticationClientMarkerId'));
  assert.match(
    scenario,
    /authenticationElapsedMillis\s*=\s*TimeUnit\.NANOSECONDS\.toMillis\(System\.nanoTime\(\)\s*-\s*authenticationStartedNanos\)/,
    'V_S12_AUTHENTICATION_DURATION_MUST_BE_LATCHED_WHEN_AUTHENTICATION_COMPLETES',
  );
  assert.match(
    scenario,
    /Map\.entry\("authenticationAttemptElapsedMillis",\s*authenticationAttemptElapsedMillis\)/,
    'V_S12_FAILURE_RECEIPT_MUST_LABEL_IN_FLIGHT_AUTH_DURATION_SEPARATELY',
  );
  assert.match(
    scenario,
    /Map\.entry\("scenarioElapsedMillis",\s*scenarioElapsedMillis\)/,
    'V_S12_FAILURE_RECEIPT_MUST_LABEL_TOTAL_SCENARIO_DURATION',
  );
  for (const field of [
    'scenarioPhase',
    'probeMarkerId',
    'probeExitCode',
    'probePid',
    'probeCommandStage',
    'probePendingPingSequence',
    'probePongCount',
    'probeSignal',
  ]) {
    assert.ok(scenario.includes(`Map.entry("${field}"`), `V_S12_FAILURE_RECEIPT_FIELD_MISSING:${field}`);
  }
  assert.ok(scenario.includes('safeLatestWireClientStage(authLog)'));
  assert.ok(scenario.includes('safeWireSignalDiagnostic(probe == null ? null : probe.log)'));
  assert.ok(scenario.includes('safeTdsAuthenticationTrace(tds, tdsLogOffset)'));
  assert.ok(source.includes('TDS_AUTH_CONNECTION_ID'));
  assert.ok(source.includes('SAFE_TDS_AUTH_EVENTS.contains(event)'));
  assert.ok(source.includes('TDS_DIAGNOSTIC_FIELD'));
  assert.match(scenario, /finally\s*\{\s*Throwable cleanupFailure = null;\s*if \(postgresPaused\) cleanupFailure = attemptCleanup\(cleanupFailure, host::unpausePostgresContainer\)/);
  assert.doesNotMatch(scenario.slice(catchPosition, rethrowPosition), /failure\.getMessage\(\)/);
});

test('V-S12 TDS log correlator accepts the actual Reactor Netty connection id shape', () => {
  const source = readFileSync(terminalContractScenariosPath, 'utf8');
  const idPattern = source.match(
    /TDS_AUTH_CONNECTION_ID\s*=\s*Pattern\.compile\("event=tds_ws_\(\?:accepted\|first_frame_received\) connectionId="\s*\+\s*"([^"]+)"\);/,
  );
  assert.ok(idPattern, 'V_S12_TDS_CONNECTION_ID_PATTERN_MISSING');
  const connectionId = '00163efffe165b09-00388ad7-00000023-db2240a131a6328c-8b8f1bd0';
  const matcher = new RegExp(`event=tds_ws_(?:accepted|first_frame_received) connectionId=${idPattern[1]}`)
    .exec(`event=tds_ws_accepted connectionId=${connectionId}`);
  assert.equal(matcher?.[1], connectionId, 'V_S12_TDS_CONNECTION_ID_CORRELATION_MISMATCH');
  assert.doesNotMatch(
    `event=tds_ws_accepted connectionId=${'not-a-netty-id'}`,
    new RegExp(`event=tds_ws_(?:accepted|first_frame_received) connectionId=${idPattern[1]}`),
  );
});

test('persistent wire-probe commands preserve child results across process-exit races', () => {
  const source = readFileSync(terminalContractScenariosPath, 'utf8');
  const probeStart = source.indexOf('private static final class SessionProbe {');
  const probeEnd = source.indexOf('\n    private static JsonNode runWireClient', probeStart);
  assert.ok(probeStart >= 0 && probeEnd > probeStart, 'BACKEND_ACCEPTANCE_SESSION_PROBE_BOUNDARY_MISSING');
  const probe = source.slice(probeStart, probeEnd);
  assert.match(probe, /void ping\(int sequence\)[\s\S]*?sendControlCommand\("PING"/);
  assert.match(probe, /JsonNode finish\(Duration timeout\)[\s\S]*?sendControlCommand\("CLOSE"/);
  assert.match(probe, /JsonNode awaitClose\(int code, String reason, Duration timeout\)[\s\S]*?sendControlCommand\("AWAIT_CLOSE"/);
  assert.match(probe, /if \(!node\.isAlive\(\)\)[\s\S]*?CHILD_EXITED_BEFORE_WRITE/);
  assert.match(probe, /CHILD_EXITED_DURING_WRITE/);
  assert.ok(
    probe.includes('"stage=RESULT_BEFORE_ASSERT timestampUtc=%s runId=%s markerId=%s resultStage=%s "'),
    'BACKEND_ACCEPTANCE_SESSION_PROBE_RESULT_LOG_MISSING',
  );
  assert.ok(
    probe.includes('"clientPid=%d exitCode=%d stdoutShape=%s firstAssertion=%s signalDiagnostic=%s"'),
    'BACKEND_ACCEPTANCE_SESSION_PROBE_RESULT_FIELDS_MISSING',
  );
  assert.ok(probe.indexOf('stage=RESULT_BEFORE_ASSERT') < probe.indexOf(
    'Assertions.assertEquals(0, node.exitValue(), "TERMINAL_WIRE_SESSION_PROBE_EXIT_NONZERO")',
  ));
  assert.match(probe, /writeWireLifecycleLog\(\s*log,/);
  assert.match(probe, /SAFE_TDS_CLOSE_REASONS\.contains\(closeReason\)/);
});

test('one-shot wire-client failures log bounded safe process and signal diagnostics before asserting', () => {
  const source = readFileSync(terminalContractScenariosPath, 'utf8');
  const wireSource = readFileSync(new URL('./terminal-ws-wire-client.mjs', import.meta.url), 'utf8');
  const loggerStart = source.indexOf('private static void logWireClientResult(');
  const loggerEnd = source.indexOf('\n    private static String relevantLogLines', loggerStart);
  const cleanupStart = source.indexOf('private static void stopOwnedClient(Process node, Path stderrLog)');
  const cleanupEnd = source.indexOf('\n    private static void assertCancelledSession', cleanupStart);
  const awaitStart = source.indexOf('private static JsonNode awaitWireResult(');
  const awaitEnd = source.indexOf('\n    @FunctionalInterface', awaitStart);
  assert.ok(loggerStart >= 0 && loggerEnd > loggerStart, 'BACKEND_ACCEPTANCE_WIRE_RESULT_LOGGER_MISSING');
  assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart, 'BACKEND_ACCEPTANCE_WIRE_CLEANUP_LOGGER_MISSING');
  assert.ok(awaitStart >= 0 && awaitEnd > awaitStart, 'BACKEND_ACCEPTANCE_WIRE_RESULT_WAITER_MISSING');
  const logger = source.slice(loggerStart, loggerEnd);
  const cleanup = source.slice(cleanupStart, cleanupEnd);
  const waiter = source.slice(awaitStart, awaitEnd);
  for (const field of [
    'expectedScenario=%s',
    'actualScenario=%s',
    'markerId=%s',
    'clientPid=%d',
    'parentPid=%d',
    'exitCode=%s',
    'elapsedMillis=%d',
    'stdoutShape=%s',
    'resultStatus=%s',
    'closeCode=%s',
    'closeReason=%s',
    'failureCategory=%s',
    'sessionIdPresent=%s',
    'signalDiagnostic=%s',
  ]) {
    assert.ok(logger.includes(field), `BACKEND_ACCEPTANCE_WIRE_RESULT_FIELD_MISSING:${field}`);
  }
  const resultLog = waiter.indexOf('logWireClientResult(');
  const exitAssertion = waiter.indexOf('Assertions.assertEquals(0, node.exitValue(), "TERMINAL_WIRE_CLIENT_EXIT_NONZERO")');
  assert.ok(resultLog >= 0 && exitAssertion > resultLog, 'BACKEND_ACCEPTANCE_WIRE_RESULT_MUST_LOG_BEFORE_ASSERTION');
  assert.ok(
    /logWireClientResult\(node,\s*stderrLog,/.test(waiter),
    'BACKEND_ACCEPTANCE_WIRE_LOG_MUST_READ_CLIENT_STDERR',
  );
  assert.ok(/TERMINAL_WIRE_STAGE=PROCESS_SIGNAL signal=\(SIGTERM\)/.test(source), 'WIRE_SIGNAL_FORMAT_MISSING');
  assert.ok(
    /' markerId=' \+ diagnosticMarkerId/.test(wireSource),
    'WIRE_SIGNAL_MARKER_CORRELATION_MISSING',
  );
  assert.doesNotMatch(logger, /terminalCredential|deviceId|payload|sessionId=%s|raw|output=%s/i);
  assert.ok(
    /safeWireSignalDiagnostic\(stderrLog\)/.test(source),
    'BACKEND_ACCEPTANCE_WIRE_SIGNAL_SUMMARY_MISSING',
  );
  for (const field of [
    'stage=CLEANUP',
    'markerId=%s',
    'clientPid=%d',
    'parentPid=%d',
    'exitCode=%s',
    'stopRequested=%s',
    'forced=%s',
    'elapsedMillis=%d',
    'signalDiagnostic=%s',
  ]) {
    assert.ok(cleanup.includes(field), `BACKEND_ACCEPTANCE_WIRE_CLEANUP_FIELD_MISSING:${field}`);
  }
  assert.ok(
    /safeWireSignalDiagnostic\(stderrLog\)/.test(cleanup),
    'BACKEND_ACCEPTANCE_WIRE_CLEANUP_SIGNAL_SUMMARY_MISSING',
  );
  assert.ok(
    /TERMINAL_WIRE_PROCESS_SIGNAL_LINE_INVALID/.test(source),
    'BACKEND_ACCEPTANCE_WIRE_SIGNAL_INVALID_MARKER_MISSING',
  );

  const lifecycleLoggerStart = source.indexOf('private static void writeWireLifecycleLog(');
  const lifecycleLoggerEnd = source.indexOf('\n    private static String probeCommandKind', lifecycleLoggerStart);
  const probeResultStart = source.indexOf('private JsonNode awaitProbeResult(Duration timeout, String stage)');
  const probeResultEnd = source.indexOf('\n        int pongCount()', probeResultStart);
  assert.ok(lifecycleLoggerStart >= 0 && lifecycleLoggerEnd > lifecycleLoggerStart, 'WIRE_LIFECYCLE_LOGGER_MISSING');
  assert.ok(probeResultStart >= 0 && probeResultEnd > probeResultStart, 'SESSION_PROBE_RESULT_WAITER_MISSING');
  const lifecycleLogger = source.slice(lifecycleLoggerStart, lifecycleLoggerEnd);
  const probeResult = source.slice(probeResultStart, probeResultEnd);
  assert.match(lifecycleLogger, /Files\.writeString\(\s*stderrLog[\s\S]*StandardOpenOption\.APPEND/);
  const parentSignalSummary = probeResult.indexOf('signalDiagnostic=%s');
  const firstAssertionMarker = probeResult.indexOf('firstAssertion=%s');
  const resultBeforeAssert = probeResult.indexOf('stage=RESULT_BEFORE_ASSERT');
  const probeExitAssertion = probeResult.indexOf(
    'Assertions.assertEquals(0, node.exitValue(), "TERMINAL_WIRE_SESSION_PROBE_EXIT_NONZERO")',
  );
  assert.ok(parentSignalSummary >= 0, 'SESSION_PROBE_PARENT_SIGNAL_SUMMARY_MISSING');
  assert.ok(firstAssertionMarker >= 0 && resultBeforeAssert >= 0 && probeExitAssertion > resultBeforeAssert,
    'SESSION_PROBE_FIRST_FAILURE_MUST_BE_PERSISTED_BEFORE_ASSERTION');
  assert.ok(probeResult.slice(0, probeExitAssertion).includes('writeWireLifecycleLog('),
    'SESSION_PROBE_PARENT_DIAGNOSTICS_NOT_RUN_SCOPED');
});

test('TDS records the correlated close outcome before persisting a session disconnect', () => {
  const source = readFileSync(tdsSessionActorsPath, 'utf8');
  const closeStart = source.indexOf('private void connectionClosed(String attemptId, TdsWebSocketConnection connection)');
  const closeEnd = source.indexOf('\n        private void revoke(', closeStart);
  assert.ok(closeStart >= 0 && closeEnd > closeStart, 'TDS_SESSION_CONNECTION_CLOSED_OWNER_MISSING');
  const closeHandler = source.slice(closeStart, closeEnd);
  assert.match(closeHandler, /event=tds_session_connection_closed/);
  assert.match(closeHandler, /connectionId=\{\} sessionId=\{\} generation=\{\} closeReason=\{\}/);
  assert.match(closeHandler, /queueDisconnect\(closed, closeReason\)/);
  assert.doesNotMatch(closeHandler, /terminalCredential|deviceId|payload|groupWorkspaceKey/);
});

test('TDS logs the close request before sending the WebSocket close frame', () => {
  const source = readFileSync(tdsWebSocketConnectionPath, 'utf8');
  const closeStart = source.indexOf('private Mono<Void> closeAsync(TerminalConnectionProtocol.Close close)');
  const closeEnd = source.indexOf('\n    public void finish()', closeStart);
  assert.ok(closeStart >= 0 && closeEnd > closeStart, 'TDS_WEBSOCKET_CLOSE_OWNER_MISSING');
  const closeMethod = source.slice(closeStart, closeEnd);
  const diagnosticIndex = closeMethod.indexOf('event=tds_ws_close_started');
  const socketCloseIndex = closeMethod.indexOf('session.close(new CloseStatus(close.code(), close.reason()))');
  assert.ok(
    diagnosticIndex >= 0 && socketCloseIndex > diagnosticIndex,
    'TDS_WEBSOCKET_CLOSE_DIAGNOSTIC_ORDER_INVALID',
  );
  assert.match(closeMethod, /connectionId=\{\} sessionId=\{\} closeCode=\{\} closeReason=\{\}/);
  assert.doesNotMatch(closeMethod, /terminalCredential|deviceId|payload|Authorization/);
});

test('TDS retains pooled WebSocket payloads across asynchronous handling and releases once', () => {
  const handlerSource = readFileSync(tdsWebSocketHandlerPath, 'utf8');
  assert.match(
    handlerSource,
    /WebSocketMessage message = indexed\.getT2\(\);\s+message\.retain\(\);/,
    'TDS_WEBSOCKET_PAYLOAD_MUST_BE_RETAINED_BEFORE_ASYNC_HANDOFF',
  );
  const asyncFrameLog = handlerSource.match(
    /int frameBytes = message\.getPayload\(\)\.readableByteCount\(\);\s+WebSocketMessage\.Type frameType = message\.getType\(\);\s+TdsAsyncLog\.enqueue\(\s*logScheduler,\s*\(\) -> LOGGER\.info\(([\s\S]*?)\)\);/,
  );
  assert.ok(
    asyncFrameLog,
    'TDS_WEBSOCKET_ASYNC_LOG_MUST_CAPTURE_SCALARS_NOT_POOLED_PAYLOAD',
  );
  assert.match(asyncFrameLog[1], /frameType,\s+frameBytes\s*$/);
  assert.doesNotMatch(asyncFrameLog[1], /\bmessage\b|payload|readableByteCount/);
  assert.match(
    handlerSource,
    /return handled\.doFinally\(ignored -> message\.release\(\)\);\s+\} catch \(RuntimeException \| Error setupFailure\) \{\s+message\.release\(\);/,
    'TDS_WEBSOCKET_EXTRA_REFERENCE_MUST_RELEASE_ON_TERMINATION_OR_SETUP_FAILURE',
  );
});

test('backend acceptance structure rejects an unregistered scenario group', () => {
  const scratch = mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'v2s-acceptance-structure-'));
  const scratchAcceptance = path.join(
    scratch,
    'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance',
  );
  try {
    cpSync(acceptanceRoot, scratchAcceptance, {recursive: true});
    writeFileSync(
      path.join(scratchAcceptance, 'UnregisteredAcceptanceScenarios.java'),
      `package com.catering.v2s.app.acceptance;
final class UnregisteredAcceptanceScenarios {
    @AcceptanceScenario(id = "fixture.unregistered", module = "FIXTURE", operation = "fixture")
    void fixture() {}
}
`,
    );
    assert.throws(
      () => validateAcceptanceStructure(scratch),
      error => String(error).includes('UnregisteredAcceptanceScenarios.java is not registered'),
    );
    rmSync(path.join(scratchAcceptance, 'UnregisteredAcceptanceScenarios.java'));
    writeFileSync(
      path.join(scratchAcceptance, 'UnconsumedHelperScenarios.java'),
      'package com.catering.v2s.app.acceptance;\nfinal class UnconsumedHelperScenarios {}\n',
    );
   assert.throws(
     () => validateAcceptanceStructure(scratch),
     error => String(error).includes('UnconsumedHelperScenarios.java has no explicit @Test consumer'),
   );
    rmSync(path.join(scratchAcceptance, 'UnconsumedHelperScenarios.java'));
    writeFileSync(
      path.join(scratchAcceptance, 'ConditionalHelperScenarios.java'),
      'package com.catering.v2s.app.acceptance;\nfinal class ConditionalHelperScenarios {}\n',
    );
    const suiteSource = readFileSync(path.join(scratchAcceptance, 'BackendAcceptanceTest.java'), 'utf8');
    const suiteEnd = suiteSource.lastIndexOf('\n}');
    const conditionalConsumer = [
      '',
      '    @Test',
      '    @EnabledIfEnvironmentVariable(named = "FIXTURE", matches = "true")',
      '    void conditionalFixtureConsumer() {',
      '        ConditionalHelperScenarios.run(this);',
      '    }',
      '',
    ].join('\n');
    writeFileSync(
      path.join(scratchAcceptance, 'BackendAcceptanceTest.java'),
      suiteSource.slice(0, suiteEnd) + conditionalConsumer + suiteSource.slice(suiteEnd),
    );
    assert.throws(
      () => validateAcceptanceStructure(scratch),
      error => String(error).includes('ConditionalHelperScenarios conditional consumer must document its default status'),
    );
    rmSync(path.join(scratchAcceptance, 'ConditionalHelperScenarios.java'));
    writeFileSync(
      path.join(scratchAcceptance, 'InvocationlessHelperScenarios.java'),
      'package com.catering.v2s.app.acceptance;\nfinal class InvocationlessHelperScenarios {}\n',
    );
    const invocationlessConsumer = [
      '',
      '    @Test',
      '    void invocationlessFixtureConsumer() {',
      '        Class<InvocationlessHelperScenarios> type = null;',
      '    }',
      '',
    ].join('\n');
    writeFileSync(
      path.join(scratchAcceptance, 'BackendAcceptanceTest.java'),
      suiteSource.slice(0, suiteEnd) + invocationlessConsumer + suiteSource.slice(suiteEnd),
    );
    assert.throws(
      () => validateAcceptanceStructure(scratch),
      error => String(error).includes('InvocationlessHelperScenarios.java has no explicit @Test consumer'),
    );
 } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
});

test('CP-05 calibration requires an explicit supported batch cardinality before remote execution', () => {
  for (const batchCardinality of [undefined, '', '0', '21', '100.0']) {
    const environment = {...process.env};
    delete environment.V2S_BACKEND_ACCEPTANCE_BATCH_CARDINALITY;
    if (batchCardinality !== undefined) {
      environment.V2S_BACKEND_ACCEPTANCE_BATCH_CARDINALITY = batchCardinality;
    }
    const result = spawnSync(backendAcceptanceRunnerPath, ['--operation', 'all', '--calibration'], {
      cwd: root,
      env: environment,
      encoding: 'utf8',
    });
    assert.equal(result.status, 2, 'invalid calibration cardinality must fail before the remote runner');
    assert.match(result.stderr, /BACKEND_ACCEPTANCE_CALIBRATION_BATCH_CARDINALITY_REQUIRED/);
  }
});
