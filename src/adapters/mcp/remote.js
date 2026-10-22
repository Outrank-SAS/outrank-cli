import { registry } from '../../commands/index.js';
import { ContextSource } from '../../core/context.js';
import { createLogger } from './logger.js';
import { createMcpServer } from './server.js';
import { parseToolsetOverride } from './toolsets.js';

export const REMOTE_PROFILE_NAME = 'remote';

const remoteOptions = () => ({
  profile: undefined,
  override: parseToolsetOverride(),
  readOnly: false,
  uploadDir: null,
  uploadDirProblem: null,
  startupError: null,
});

const remoteContext = ({ apiKey, baseUrl }) => ({
  apiKey,
  baseUrl: new URL(baseUrl).origin,
  storedBaseUrl: undefined,
  profile: { name: REMOTE_PROFILE_NAME, source: ContextSource.FLAG, explicit: true, known: true },
  source: { apiKey: ContextSource.FLAG, baseUrl: ContextSource.FLAG, envIgnored: false, baseUrlEnvIgnored: false },
});

export const createRemoteMcpServer = async ({ apiKey, baseUrl, version, whoami, timeouts, logger = createLogger() }) => {
  if (typeof apiKey !== 'string' || apiKey === '') throw new TypeError('createRemoteMcpServer needs an apiKey.');
  return createMcpServer({
    registry,
    version,
    options: remoteOptions(),
    env: {},
    readConfig: async () => ({}),
    context: remoteContext({ apiKey, baseUrl }),
    whoami,
    remote: true,
    timeouts,
    logger,
  });
};
