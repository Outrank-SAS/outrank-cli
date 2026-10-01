import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registry } from '../../commands/index.js';
import { toErrorEnvelope } from '../../core/errors.js';
import { getVersion } from '../../core/version.js';
import { MCP_DEBUG_ENV, TRUTHY_ENV_VALUES } from './constants.js';
import { createLogger } from './logger.js';
import { resolveMcpOptions } from './options.js';
import { createMcpServer } from './server.js';

const EXIT_FAILURE = 1;

export const runMcpServer = async (argv, { env = process.env, cwd = process.cwd(), input } = {}) => {
  const logger = createLogger({ enabled: TRUTHY_ENV_VALUES.includes(env[MCP_DEBUG_ENV]) });
  try {
    const options = resolveMcpOptions({ argv, env, cwd });
    if (options.startupError) logger.always('invalid_command_line', { message: options.startupError.error.message });
    const { server, session } = await createMcpServer({ registry, version: getVersion(), options, env, logger });
    await server.connect(new StdioServerTransport());
    if (input) {
      input.once('end', () => {
        logger.debug('input_closed', {});
        session.shutdown();
        server.close().catch(() => {});
      });
    }
    logger.debug('started', {
      tools: session.selection().tools.length,
      toolsets: session.selection().source,
      organization: session.organization(),
    });
  } catch (error) {
    logger.always('startup_failed', { error: toErrorEnvelope(error).error });
    process.exitCode = EXIT_FAILURE;
  }
};
