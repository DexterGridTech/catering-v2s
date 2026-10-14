export const UAT_PUBLIC_HOST = '47.106.121.27';
export const UAT_ENVIRONMENT_KIND = 'uat';
export const UAT_NAMESPACE = 'v2s-uat-r5-full';
export const UAT_REMOTE_ROOT = '/srv/catering-v2s/uat';
export const UAT_DOCKER_ROOT_LABEL = 'com.catering-v2s.uat-root';
export const UAT_DOCKER_NAMESPACE_LABEL = 'com.catering-v2s.uat-namespace';
export const UAT_CREDENTIALS_FILE = '.runtime/uat/credentials.env';
export const UAT_DATABASE = 'catering_v2s_uat_r5_full';
export const UAT_DATABASE_ROLE = 'catering_v2s_uat';
export const UAT_TDS_DATABASE_ROLE = 'catering_v2s_tds_uat';
export const UAT_ASSET_BUCKET = 'catering-v2s-uat-assets';
export const UAT_ASSET_PRIVATE_BUCKET = 'catering-v2s-uat-terminal-update-private';
export const UAT_DORIS_DATABASE = 'terminal_connection_history';
export const UAT_DORIS_TABLE = 'connection_history';
export const UAT_DORIS_WRITER = 'tds_history_writer';
export const UAT_DOCKER_PROJECT = 'catering-v2s-uat';

// Immutable upstream manifest digests. Image IDs are captured from Docker
// readback when UAT first materializes the images; the cached DEV image IDs
// are not used as UAT resource identity.
export const UAT_IMAGES = Object.freeze({
  postgresql: Object.freeze({
    tag: 'postgres:16-alpine',
    ref: 'docker.io/library/postgres@sha256:4e6e670bb069649261c9c18031f0aded7bb249a5b6664ddec29c013a89310d50',
    upstream: 'https://hub.docker.com/_/postgres',
  }),
  minio: Object.freeze({
    tag: 'minio/minio:RELEASE.2025-09-07T16-13-09Z',
    ref: 'docker.io/minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e',
    upstream: 'https://github.com/minio/minio/releases/tag/RELEASE.2025-09-07T16-13-09Z',
  }),
  doris: Object.freeze({
    tag: 'apache/doris:all-in-one-4.1.3',
    ref: 'docker.io/apache/doris@sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609',
    upstream: 'https://doris.apache.org/docs/4.x/install/cluster-deployment/docker-compilation/',
  }),
  livekit: Object.freeze({
    tag: 'livekit/livekit-server:r5-6fd3b7088874',
    ref: 'docker.io/livekit/livekit-server@sha256:6fd3b7088874c4d119160dd688798dfec852bc014786d392caad15f6f63912a3',
    upstream: 'https://docs.livekit.io/transport/self-hosting/deployment/',
  }),
  haproxy: Object.freeze({
    tag: 'haproxy:3.4.6',
    ref: 'docker.io/library/haproxy@sha256:e273915691a8eab3f105bf3e39fd4c29a4ecf334e33421903b5589d25e14db26',
    upstream: 'https://hub.docker.com/_/haproxy',
  }),
  nginx: Object.freeze({
    tag: 'nginx:1.30.5',
    ref: 'docker.io/library/nginx@sha256:6e2a172ae5503c0df64cd3294b57c86394ced402016a8cc45436086fa51f5d02',
    upstream: 'https://hub.docker.com/layers/library/nginx/1.30.5/images/sha256-6e2a172ae5503c0df64cd3294b57c86394ced402016a8cc45436086fa51f5d02',
  }),
});

export const UAT_CONTAINER_NAMES = Object.freeze({
  postgresql: 'catering-v2s-uat-postgres',
  minio: 'catering-v2s-uat-minio',
  doris: 'catering-v2s-uat-doris',
  livekit: 'catering-v2s-uat-livekit',
  haproxy: 'catering-v2s-uat-haproxy',
  nginx: 'catering-v2s-uat-nginx',
});

export const UAT_VOLUME_NAMES = Object.freeze({
  postgresql: 'catering-v2s-uat-postgres-data',
  minio: 'catering-v2s-uat-minio-data',
  dorisFeMeta: 'catering-v2s-uat-doris-fe-meta',
  dorisBeStorage: 'catering-v2s-uat-doris-be-storage',
});

export const UAT_PORTS = Object.freeze({
  postgres: 19170,
  minio: 19171,
  dorisHttp: 19172,
  dorisBackendHttp: 19173,
  dorisMysql: 19174,
  businessInternal: 19175,
  platformAdmin: 19180,
  operationsAdmin: 19181,
  businessPublic: 19182,
  assetsPublic: 19183,
  livekitSignal: 19184,
  livekitMediaUdp: 19186,
  tdsEntryOne: 19190,
  tdsEntryTwo: 19191,
  tdsNodeA: 19192,
  tdsNodeB: 19193,
  tdsNodeC: 19194,
});

export const UAT_HOST_PORTS = Object.freeze(Object.values(UAT_PORTS));

export const UAT_RESOURCE_BUDGET_MIB = Object.freeze({
  postgresql: 1024,
  minio: 1536,
  doris: 5120,
  livekit: 512,
  haproxy: 128,
  nginx: 128,
  cateringBusinessServer: 1536,
  terminalDataServerEach: 768,
  hostReserve: 3072,
});

export const UAT_TOTAL_SERVICE_BUDGET_MIB =
  UAT_RESOURCE_BUDGET_MIB.postgresql +
  UAT_RESOURCE_BUDGET_MIB.minio +
  UAT_RESOURCE_BUDGET_MIB.doris +
  UAT_RESOURCE_BUDGET_MIB.livekit +
  UAT_RESOURCE_BUDGET_MIB.haproxy +
  UAT_RESOURCE_BUDGET_MIB.nginx +
  UAT_RESOURCE_BUDGET_MIB.cateringBusinessServer +
  UAT_RESOURCE_BUDGET_MIB.terminalDataServerEach * 3;
export const UAT_DISK_BUDGET_MIB = 3072;
export const UAT_HOST_DISK_RESERVE_MIB = 1024;

export const UAT_ENDPOINTS = Object.freeze({
  platformAdmin: `http://${UAT_PUBLIC_HOST}:${UAT_PORTS.platformAdmin}`,
  operationsAdmin: `http://${UAT_PUBLIC_HOST}:${UAT_PORTS.operationsAdmin}`,
  business: `http://${UAT_PUBLIC_HOST}:${UAT_PORTS.businessPublic}`,
  assets: `http://${UAT_PUBLIC_HOST}:${UAT_PORTS.assetsPublic}`,
  livekit: `ws://${UAT_PUBLIC_HOST}:${UAT_PORTS.livekitSignal}`,
  tdsEntryOne: `ws://${UAT_PUBLIC_HOST}:${UAT_PORTS.tdsEntryOne}`,
  tdsEntryTwo: `ws://${UAT_PUBLIC_HOST}:${UAT_PORTS.tdsEntryTwo}`,
});
