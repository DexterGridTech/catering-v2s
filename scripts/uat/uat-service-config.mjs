import {createHaproxyConfiguration} from '../dev/r5-managed-terminal-topology.mjs';
import {loadTdsCapacityConfiguration} from '../env/tds-capacity-configuration.mjs';
import {
  UAT_ASSET_BUCKET,
  UAT_ASSET_PRIVATE_BUCKET,
  UAT_CONTAINER_NAMES,
  UAT_DATABASE,
  UAT_DATABASE_ROLE,
  UAT_TDS_DATABASE_ROLE,
  UAT_DORIS_DATABASE,
  UAT_DORIS_TABLE,
  UAT_DORIS_WRITER,
  UAT_DOCKER_PROJECT,
  UAT_DOCKER_NAMESPACE_LABEL,
  UAT_IMAGES,
  UAT_NAMESPACE,
  UAT_PORTS,
  UAT_PUBLIC_HOST,
  UAT_REMOTE_ROOT,
  UAT_DOCKER_ROOT_LABEL,
  UAT_ENDPOINTS,
  UAT_RESOURCE_BUDGET_MIB,
  UAT_VOLUME_NAMES,
} from './uat-config.mjs';

const fail = code => { const error = new Error(code); error.code = code; throw error; };
const yamlQuote = value => JSON.stringify(String(value));
const requiredEnv = name => '${' + name + ':?required}';

function serviceLabels(service) {
  return [
    `      ${UAT_DOCKER_ROOT_LABEL}: ${yamlQuote(UAT_REMOTE_ROOT)}`,
    `      ${UAT_DOCKER_NAMESPACE_LABEL}: ${yamlQuote(UAT_NAMESPACE)}`,
    `      com.catering-v2s.environment-kind: ${yamlQuote('uat')}`,
    `      com.catering-v2s.service: ${yamlQuote(service)}`,
    `      com.catering-v2s.host-fingerprint: ${yamlQuote(requiredEnv('V2S_UAT_HOST_FINGERPRINT'))}`,
    `      com.catering-v2s.config-sha256: ${yamlQuote(requiredEnv('V2S_UAT_CONFIG_SHA256'))}`,
  ].join('\n');
}

function volumeLabels(service) {
  return [
    `      ${UAT_DOCKER_ROOT_LABEL}: ${yamlQuote(UAT_REMOTE_ROOT)}`,
    `      ${UAT_DOCKER_NAMESPACE_LABEL}: ${yamlQuote(UAT_NAMESPACE)}`,
    `      com.catering-v2s.environment-kind: ${yamlQuote('uat')}`,
    `      com.catering-v2s.service: ${yamlQuote(service)}`,
  ].join('\n');
}

function renderComposeService({name, container, image, memoryMiB, fields}) {
  return [
    `  ${name}:`,
    `    image: ${yamlQuote(image)}`,
    '    platform: linux/amd64',
    `    container_name: ${yamlQuote(container)}`,
    '    restart: unless-stopped',
    `    mem_limit: ${memoryMiB}m`,
    ...fields,
    '    labels:',
    serviceLabels(name),
  ].join('\n');
}

export function renderUatLivekitConfig({apiKey, apiSecret} = {}) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(apiKey ?? '') || !/^[A-Za-z0-9_-]{32,128}$/.test(apiSecret ?? '')) {
    fail('UAT_LIVEKIT_CREDENTIAL_INVALID');
  }
  return [
    `port: ${UAT_PORTS.livekitSignal}`,
    'rtc:',
    `  udp_port: ${UAT_PORTS.livekitMediaUdp}`,
    '  use_external_ip: false',
    `  node_ip: ${UAT_PUBLIC_HOST}`,
    'turn:',
    '  enabled: false',
    'keys:',
    `  ${apiKey}: ${apiSecret}`,
    'logging:',
    '  level: info',
    '  json: true',
    '',
  ].join('\n');
}

export function renderUatHaproxyConfig() {
  return createHaproxyConfiguration({
    entryOnePort: UAT_PORTS.tdsEntryOne,
    entryTwoPort: UAT_PORTS.tdsEntryTwo,
    nodePorts: {a: UAT_PORTS.tdsNodeA, b: UAT_PORTS.tdsNodeB, c: UAT_PORTS.tdsNodeC},
    bindAddress: '0.0.0.0',
    controlSocketPath: '/tmp/haproxy-admin.sock',
  });
}

export function renderUatNginxConfig() {
  const apiProxy = [
    '    location = /api {',
    '      client_max_body_size 258m;',
    `      proxy_pass http://127.0.0.1:${UAT_PORTS.businessInternal};`,
    '      proxy_set_header Host $host;',
    '      proxy_set_header X-Real-IP $remote_addr;',
    '      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '      proxy_set_header X-Forwarded-Proto $scheme;',
    '    }',
    '    location ^~ /api/ {',
    '      client_max_body_size 258m;',
    `      proxy_pass http://127.0.0.1:${UAT_PORTS.businessInternal};`,
    '      proxy_set_header Host $host;',
    '      proxy_set_header X-Real-IP $remote_addr;',
    '      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '      proxy_set_header X-Forwarded-Proto $scheme;',
    '    }',
  ];
  const businessServer = [
    '  server {',
    `    listen 0.0.0.0:${UAT_PORTS.businessPublic};`,
    '    server_name _;',
    ...apiProxy,
    '    location / {',
    '      return 404;',
    '    }',
    '  }',
  ];
  const appServer = (port, app) => [
    '  server {',
    `    listen 0.0.0.0:${port} default_server;`,
    '    server_name _;',
    `    root /usr/share/nginx/html/${app};`,
    '    index index.html;',
    '    location = /healthz {',
    '      access_log off;',
    "      default_type text/plain;",
    "      return 200 'ok\\n';",
    '    }',
    ...apiProxy,
    '    location / {',
    '      try_files $uri $uri/ /index.html;',
    '    }',
    '  }',
  ];
  return [
    'server_tokens off;',
    '',
    ...appServer(UAT_PORTS.platformAdmin, 'platform-admin'),
    '',
    ...appServer(UAT_PORTS.operationsAdmin, 'operations-admin'),
    '',
    ...businessServer,
    '',
    '  server {',
    `    listen 0.0.0.0:${UAT_PORTS.assetsPublic};`,
    '    server_name _;',
    `    location ^~ /${UAT_ASSET_BUCKET}/ {`,
    `      proxy_pass http://127.0.0.1:${UAT_PORTS.minio};`,
    '      proxy_set_header Host $host;',
    '      proxy_set_header X-Real-IP $remote_addr;',
    '      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '    }',
    '    location / {',
    '      return 404;',
    '    }',
    '  }',
    '',
  ].join('\n');
}

function requiredCredential(credentials, name) {
  const value = credentials?.[name];
  if (typeof value !== 'string' || !value || /[\u0000\r\n]/.test(value)) {
    fail(`UAT_CREDENTIAL_REQUIRED:${name}`);
  }
  return value;
}

export function renderUatCateringBusinessServerEnvironment(credentials, diagnosticRun = null) {
  if (!credentials || typeof credentials !== 'object') fail('UAT_CBS_CREDENTIALS_REQUIRED');
  const minioRootUser = requiredCredential(credentials, 'V2S_UAT_MINIO_ROOT_USER');
  const minioRootPassword = requiredCredential(credentials, 'V2S_UAT_MINIO_ROOT_PASSWORD');
  const livekitApiKey = requiredCredential(credentials, 'V2S_LIVEKIT_API_KEY');
  const livekitApiSecret = requiredCredential(credentials, 'V2S_LIVEKIT_API_SECRET');
  const androidBuildTools = requiredCredential(credentials, 'TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY');
  if (!/^\/[A-Za-z0-9._/-]+$/.test(androidBuildTools) || androidBuildTools.split('/').includes('..')) {
    fail('UAT_ANDROID_BUILD_TOOLS_PATH_INVALID');
  }
  const values = {
    CATERING_BUSINESS_DB_URL: `jdbc:postgresql://127.0.0.1:${UAT_PORTS.postgres}/${UAT_DATABASE}`,
    CATERING_BUSINESS_DB_USERNAME: UAT_DATABASE_ROLE,
    CATERING_BUSINESS_DB_PASSWORD: requiredCredential(credentials, 'V2S_UAT_DATABASE_PASSWORD'),
    V2S_UAT_DATABASE_NAME: UAT_DATABASE,
    V2S_UAT_DATABASE_ROLE: UAT_DATABASE_ROLE,
    CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: requiredCredential(credentials, 'CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET'),
    CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: requiredCredential(credentials, 'CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET'),
    CATERING_ASSET_OBJECT_STORAGE_ENDPOINT: `http://127.0.0.1:${UAT_PORTS.minio}`,
    CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY: minioRootUser,
    CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY: minioRootPassword,
    CATERING_ASSET_OBJECT_STORAGE_BUCKET: UAT_ASSET_BUCKET,
    CATERING_ASSET_OBJECT_STORAGE_OBJECT_PREFIX: `${UAT_NAMESPACE}/`,
    CATERING_ASSET_TERMINAL_UPDATE_PRIVATE_BUCKET: UAT_ASSET_PRIVATE_BUCKET,
    CATERING_ASSET_TERMINAL_UPDATE_PRIVATE_OBJECT_PREFIX: 'terminal-update/',
    CATERING_ASSET_PUBLIC_BASE_URL: UAT_ENDPOINTS.assets,
    V2S_LIVEKIT_API_URL: `http://127.0.0.1:${UAT_PORTS.livekitSignal}`,
    V2S_LIVEKIT_API_KEY: livekitApiKey,
    V2S_LIVEKIT_API_SECRET: livekitApiSecret,
    V2S_LIVEKIT_SIGNAL_URL: UAT_ENDPOINTS.livekit,
    V2S_RUNTIME_ENVIRONMENT: 'uat',
    CATERING_OTP_DEBUG_CODE_EXPOSURE: 'true',
    TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY: androidBuildTools,
    SERVER_ADDRESS: '127.0.0.1',
    SERVER_PORT: String(UAT_PORTS.businessInternal),
    ...(diagnosticRun ? {
      V2S_DEV_PROFILE: 'r5-full',
      V2S_DEV_NAMESPACE: UAT_NAMESPACE,
      V2S_SEED_OTP_FIXED_VALUE: requiredCredential(credentials, 'V2S_SEED_OTP_FIXED_VALUE'),
      V2S_SEED_REPORT_RUN_ID: diagnosticRun.runId,
      V2S_SEED_REPORT_SECRET: requiredCredential(credentials, 'V2S_SEED_REPORT_SECRET'),
      V2S_SEED_REPORT_EVENTS: `${diagnosticRun.remoteRoot}/results/seed-request-events.jsonl`,
      V2S_DB_OPERATIONS_EVENTS: `${diagnosticRun.remoteRoot}/results/db-operations.jsonl`,
      V2S_DB_OPERATIONS_HMAC_KEY: requiredCredential(credentials, 'V2S_DB_OPERATIONS_HMAC_KEY'),
      V2S_DB_STATEMENT_DICTIONARY: `${diagnosticRun.remoteRoot}/results/statement-dictionary.json`,
    } : {}),
  };
  return Object.freeze(values);
}

export function renderUatTdsServerEnvironment(credentials, nodeName, capacity = loadTdsCapacityConfiguration()) {
  if (!credentials || typeof credentials !== 'object' || !['a', 'b', 'c'].includes(nodeName)) {
    fail('UAT_TDS_INPUT_INVALID');
  }
  const databasePassword = requiredCredential(credentials, 'V2S_UAT_TDS_DATABASE_PASSWORD');
  const dorisWriterPassword = requiredCredential(credentials, 'V2S_UAT_DORIS_WRITER_PASSWORD');
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(databasePassword) || !/^[A-Za-z0-9_-]{32,64}$/.test(dorisWriterPassword)) {
    fail('UAT_TDS_CREDENTIAL_INVALID');
  }
  const ports = {a: UAT_PORTS.tdsNodeA, b: UAT_PORTS.tdsNodeB, c: UAT_PORTS.tdsNodeC};
  return Object.freeze({
    SPRING_DATASOURCE_URL: `jdbc:postgresql://127.0.0.1:${UAT_PORTS.postgres}/${UAT_DATABASE}`,
    SPRING_DATASOURCE_USERNAME: UAT_TDS_DATABASE_ROLE,
    SPRING_DATASOURCE_PASSWORD: databasePassword,
    SERVER_ADDRESS: '127.0.0.1',
    SERVER_PORT: String(ports[nodeName]),
    V2S_RUNTIME_ENVIRONMENT: 'uat',
    V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS: capacity.maxUnauthenticatedConnections,
    V2S_TDS_MAX_TRACKED_SESSIONS: capacity.maxTrackedSessions,
    V2S_TDS_NODE_ID: `terminal-data-server-uat-${nodeName}`,
    V2S_TDS_DORIS_ENDPOINT: `http://127.0.0.1:${UAT_PORTS.dorisBackendHttp}`,
    V2S_TDS_DORIS_DATABASE: UAT_DORIS_DATABASE,
    V2S_TDS_DORIS_TABLE: UAT_DORIS_TABLE,
    V2S_TDS_DORIS_USERNAME: UAT_DORIS_WRITER,
    V2S_TDS_DORIS_PASSWORD: dorisWriterPassword,
  });
}

export function renderUatTdsDatabaseGrantSql() {
  const role = UAT_TDS_DATABASE_ROLE;
  const database = UAT_DATABASE;
  return `GRANT CONNECT ON DATABASE "${database}" TO ${role};
GRANT USAGE ON SCHEMA platform_workspace, store_terminal, organization, terminal_binding, terminal_connection, contract, terminal_update TO ${role};
GRANT SELECT (workspace_uuid, group_workspace_key, status) ON platform_workspace.group_workspace TO ${role};
GRANT SELECT (workspace_uuid, group_workspace_key, terminal_ref, store_ref, status) ON store_terminal.terminal TO ${role};
GRANT SELECT (workspace_uuid, group_workspace_key, id, status) ON organization.store TO ${role};
GRANT SELECT (workspace_uuid, group_workspace_key, terminal_ref, generation, credential_digest, binding_status, bound_device_id, activated_at_epoch_millis) ON terminal_binding.latest_binding TO ${role};
GRANT USAGE ON SEQUENCE terminal_connection.session_sequence TO ${role};
GRANT SELECT, INSERT, UPDATE ON terminal_connection.latest_state TO ${role};
GRANT SELECT ON organization.terminal_topic_snapshot, contract.terminal_topic_snapshot TO ${role};
GRANT EXECUTE ON FUNCTION organization.read_terminal_topic_time(UUID, VARCHAR, UUID, VARCHAR, UUID) TO ${role};
GRANT EXECUTE ON FUNCTION contract.read_terminal_topic_time(UUID, VARCHAR, UUID, VARCHAR, UUID) TO ${role};
GRANT EXECUTE ON FUNCTION terminal_update.read_rule_topic_time(UUID, VARCHAR, UUID, UUID) TO ${role};
DO $uat_terminal_control_grants$
BEGIN
  IF to_regnamespace('terminal_control') IS NULL
      OR to_regclass('terminal_control.online_operation') IS NULL
      OR to_regprocedure('terminal_control.claim_online_operation(uuid,character varying)') IS NULL
      OR to_regprocedure('terminal_control.accept_terminal_report(uuid,uuid,uuid,bigint,character varying,character varying,character varying,timestamp with time zone,jsonb,character varying)') IS NULL THEN
    RAISE EXCEPTION 'UAT_TDS_TERMINAL_CONTROL_OBJECT_SET_INCOMPLETE';
  END IF;
  EXECUTE 'GRANT USAGE ON SCHEMA terminal_control TO ${role}';
  EXECUTE 'GRANT EXECUTE ON FUNCTION terminal_control.claim_online_operation(UUID, VARCHAR) TO ${role}';
  EXECUTE 'GRANT EXECUTE ON FUNCTION terminal_control.accept_terminal_report(UUID, UUID, UUID, BIGINT, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, JSONB, VARCHAR) TO ${role}';
END
$uat_terminal_control_grants$;`;
}

export function renderUatTdsPrincipalSetupSql(password) {
  if (typeof password !== 'string' || !/^[A-Za-z0-9_-]{32,64}$/.test(password)) {
    fail('UAT_TDS_DATABASE_CREDENTIAL_INVALID');
  }
  return `CREATE ROLE ${UAT_TDS_DATABASE_ROLE} LOGIN PASSWORD '${password}';\n${renderUatTdsDatabaseGrantSql()}`;
}

export function renderUatCompose() {
  const postgres = renderComposeService({
    name: 'postgresql', container: UAT_CONTAINER_NAMES.postgresql, image: UAT_IMAGES.postgresql.ref,
    memoryMiB: UAT_RESOURCE_BUDGET_MIB.postgresql,
    fields: [
      '    environment:',
      '      POSTGRES_USER: postgres',
      '      POSTGRES_DB: postgres',
      `      POSTGRES_PASSWORD: ${yamlQuote(requiredEnv('V2S_UAT_POSTGRES_ROOT_PASSWORD'))}`,
      '    healthcheck:',
      '      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]',
      '      interval: 5s',
      '      timeout: 3s',
      '      retries: 12',
      '      start_period: 20s',
      '    ports:',
      `      - ${yamlQuote(`127.0.0.1:${UAT_PORTS.postgres}:5432`)}`,
      '    volumes:',
      '      - postgres-data:/var/lib/postgresql/data',
    ],
  });
  const minio = renderComposeService({
    name: 'minio', container: UAT_CONTAINER_NAMES.minio, image: UAT_IMAGES.minio.ref,
    memoryMiB: UAT_RESOURCE_BUDGET_MIB.minio,
    fields: [
      '    command: ["server", "/data", "--console-address", ":9001"]',
      '    environment:',
      `      MINIO_ROOT_USER: ${yamlQuote(requiredEnv('V2S_UAT_MINIO_ROOT_USER'))}`,
      `      MINIO_ROOT_PASSWORD: ${yamlQuote(requiredEnv('V2S_UAT_MINIO_ROOT_PASSWORD'))}`,
      '    ports:',
      `      - ${yamlQuote(`127.0.0.1:${UAT_PORTS.minio}:9000`)}`,
      '    volumes:',
      '      - minio-data:/data',
    ],
  });
  const doris = renderComposeService({
    name: 'doris', container: UAT_CONTAINER_NAMES.doris, image: UAT_IMAGES.doris.ref,
    memoryMiB: UAT_RESOURCE_BUDGET_MIB.doris,
    fields: [
      '    ports:',
      `      - ${yamlQuote(`127.0.0.1:${UAT_PORTS.dorisHttp}:8030`)}`,
      `      - ${yamlQuote(`127.0.0.1:${UAT_PORTS.dorisBackendHttp}:8040`)}`,
      `      - ${yamlQuote(`127.0.0.1:${UAT_PORTS.dorisMysql}:9030`)}`,
      '    volumes:',
      '      - doris-fe-meta:/opt/apache-doris/fe/doris-meta',
      '      - doris-be-storage:/opt/apache-doris/be/storage',
    ],
  });
  const livekit = renderComposeService({
    name: 'livekit', container: UAT_CONTAINER_NAMES.livekit, image: UAT_IMAGES.livekit.ref,
    memoryMiB: UAT_RESOURCE_BUDGET_MIB.livekit,
    fields: [
      '    network_mode: host',
      '    command: ["--config", "/etc/livekit/livekit.yaml"]',
      '    volumes:',
      '      - ./config/livekit.yaml:/etc/livekit/livekit.yaml:ro',
    ],
  });
  const haproxy = renderComposeService({
    name: 'haproxy', container: UAT_CONTAINER_NAMES.haproxy, image: UAT_IMAGES.haproxy.ref,
    memoryMiB: UAT_RESOURCE_BUDGET_MIB.haproxy,
    fields: [
      '    network_mode: host',
      '    command: ["haproxy", "-W", "-db", "-f", "/usr/local/etc/haproxy/haproxy.cfg"]',
      '    volumes:',
      '      - ./config/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro',
    ],
  });
  const nginx = renderComposeService({
    name: 'nginx', container: UAT_CONTAINER_NAMES.nginx, image: UAT_IMAGES.nginx.ref,
    memoryMiB: UAT_RESOURCE_BUDGET_MIB.nginx,
    fields: [
      '    network_mode: host',
      '    volumes:',
      '      - ./config/nginx.conf:/etc/nginx/conf.d/default.conf:ro',
      '      - ./published/platform-admin:/usr/share/nginx/html/platform-admin:ro',
      '      - ./published/operations-admin:/usr/share/nginx/html/operations-admin:ro',
    ],
  });
  const volume = (key, name, service) => [
    `  ${key}:`,
    `    name: ${yamlQuote(name)}`,
    '    labels:',
    volumeLabels(service),
  ].join('\n');

  return [
    'version: "3.3"',
    'services:',
    postgres,
    minio,
    doris,
    livekit,
    haproxy,
    nginx,
    'volumes:',
    volume('postgres-data', UAT_VOLUME_NAMES.postgresql, 'postgresql'),
    volume('minio-data', UAT_VOLUME_NAMES.minio, 'minio'),
    volume('doris-fe-meta', UAT_VOLUME_NAMES.dorisFeMeta, 'doris'),
    volume('doris-be-storage', UAT_VOLUME_NAMES.dorisBeStorage, 'doris'),
    '',
  ].join('\n\n');
}

export function renderUatMiddlewareBundle(credentials, diagnosticRun = null) {
  if (!credentials || typeof credentials !== 'object') fail('UAT_MIDDLEWARE_CREDENTIALS_REQUIRED');
  return Object.freeze({
    composeYaml: renderUatCompose(),
    livekitYaml: renderUatLivekitConfig({apiKey: credentials.V2S_LIVEKIT_API_KEY, apiSecret: credentials.V2S_LIVEKIT_API_SECRET}),
    cateringBusinessServerEnvironment: renderUatCateringBusinessServerEnvironment(credentials, diagnosticRun),
    tdsServerEnvironments: Object.freeze({
      a: renderUatTdsServerEnvironment(credentials, 'a'),
      b: renderUatTdsServerEnvironment(credentials, 'b'),
      c: renderUatTdsServerEnvironment(credentials, 'c'),
    }),
    tdsDatabaseGrantSql: renderUatTdsDatabaseGrantSql(),
    haproxyCfg: renderUatHaproxyConfig(),
    nginxConf: renderUatNginxConfig(),
    identities: Object.freeze({
      database: UAT_DATABASE,
      assets: Object.freeze({publicBucket: UAT_ASSET_BUCKET, privateUpdateBucket: UAT_ASSET_PRIVATE_BUCKET}),
      dorisDatabase: UAT_DORIS_DATABASE,
      dorisTable: UAT_DORIS_TABLE,
      dockerProject: UAT_DOCKER_PROJECT,
      containers: UAT_CONTAINER_NAMES,
      volumes: UAT_VOLUME_NAMES,
      images: UAT_IMAGES,
    }),
  });
}
