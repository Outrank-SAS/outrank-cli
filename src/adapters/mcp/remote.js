import { registry } from '../../commands/index.js';
import { ContextSource } from '../../core/context.js';
import { CHATGPT_SURFACE_NAME, chatGptSurface } from './chatgpt.js';
import { chatGptRegistry } from './chatgptCommands.js';
import { TOOLSETS_ALL } from './constants.js';
import { createLogger } from './logger.js';
import { createMcpServer } from './server.js';
import { parseToolsetOverride } from './toolsets.js';

export const REMOTE_PROFILE_NAME = 'remote';

const remoteOptions = (surface) => ({
  profile: undefined,
  override: parseToolsetOverride(surface ? TOOLSETS_ALL : undefined),
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

const resolveSurface = (name) => {
  if (name === undefined) return null;
  if (name === CHATGPT_SURFACE_NAME) return chatGptSurface;
  throw new TypeError(`createRemoteMcpServer does not know the surface ${name}.`);
};

export const createRemoteMcpServer = async ({
  apiKey,
  baseUrl,
  version,
  whoami,
  surface: surfaceName,
  timeouts,
  logger = createLogger(),
}) => {
  if (typeof apiKey !== 'string' || apiKey === '') throw new TypeError('createRemoteMcpServer needs an apiKey.');
  const surface = resolveSurface(surfaceName);
  return createMcpServer({
    registry: surface ? chatGptRegistry : registry,
    guidanceRegistry: registry,
    version,
    surface,
    options: remoteOptions(surface),
    env: {},
    readConfig: async () => ({}),
    context: remoteContext({ apiKey, baseUrl }),
    whoami,
    remote: true,
    timeouts,
    logger,
  });
};
