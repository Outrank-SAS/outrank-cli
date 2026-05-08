import { getOption, hasFlag, parseArgs } from '../core/args.js';
import { requestAgentApi } from '../core/api.js';
import {
  clearStoredAuth,
  getConfigPath,
  getDefaultBaseUrl,
  resolveRuntimeConfig,
  storeAuthConfig,
} from '../core/config.js';
import { cliSuccess } from '../core/errors.js';

export const AUTH_HELP = `Usage:
  outrank-cli auth login <api-key> [--base-url <url>] [--no-verify]
  outrank-cli auth whoami
  outrank-cli auth status
  outrank-cli auth logout

Commands:
  login     Store an API key locally and optionally verify it immediately.
  whoami    Verify auth and return the current user and organization details.
  status    Show the currently resolved auth and base-url configuration.
  logout    Remove the stored API key from local config.

Notes:
  Environment variables override local config: OUTRANK_API_KEY, OUTRANK_BASE_URL.
  Optional config-dir override: OUTRANK_CONFIG_DIR
  Local config path: ~/.outrank/config.json
`;

export const handleAuthCommand = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: AUTH_HELP.trim(),
      },
      'Choose one of: login, whoami, status, logout.',
    );
  }

  if (subcommand === 'login') {
    const apiKey = parsed.positionals[0] ?? getOption(parsed, 'api-key');
    if (!apiKey) {
      throw Object.assign(new Error('Missing API key.'), {
        cliCode: 'CLI_INVALID_USAGE',
        guidance:
          'Run `outrank-cli auth login <api-key>` or pass `--api-key <api-key>`, then retry.',
      });
    }

    const baseUrl = getOption(parsed, 'base-url') ?? getDefaultBaseUrl();
    if (!hasFlag(parsed, 'no-verify')) {
      const verifyParsed = parseArgs(['--api-key', apiKey, '--base-url', baseUrl]);
      const response = await requestAgentApi(verifyParsed, {
        method: 'GET',
        path: '/auth/whoami',
      });
      if (!response.ok) {
        return response.payload;
      }
    }

    const saved = await storeAuthConfig({ apiKey, baseUrl });
    return cliSuccess(
      {
        stored: {
          api_key: true,
          base_url: saved.baseUrl,
          config_path: getConfigPath(),
        },
      },
      'Credentials saved. Run `outrank-cli auth whoami` to confirm the active workspace at any time.',
    );
  }

  if (subcommand === 'whoami') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: '/auth/whoami',
    });
    return response.payload;
  }

  if (subcommand === 'status') {
    const runtime = await resolveRuntimeConfig(parsed);
    return cliSuccess(
      {
        base_url: runtime.baseUrl,
        api_key_present: Boolean(runtime.apiKey),
        api_key_source: process.env.OUTRANK_API_KEY
          ? 'env'
          : runtime.config.apiKey
            ? 'config'
            : 'missing',
        base_url_source: process.env.OUTRANK_BASE_URL
          ? 'env'
          : runtime.config.baseUrl
            ? 'config'
            : 'default',
        config_path: getConfigPath(),
      },
      'Confirm this target before running live commands. If you use a non-default Outrank deployment, set `OUTRANK_BASE_URL` first.',
    );
  }

  if (subcommand === 'logout') {
    const runtime = await resolveRuntimeConfig(parsed);
    await clearStoredAuth();
    return cliSuccess(
      {
        cleared: ['apiKey'],
        config_path: getConfigPath(),
        base_url_still_configured: Boolean(runtime.config.baseUrl),
      },
      'Stored API key removed. Any future authenticated call now requires OUTRANK_API_KEY or a fresh `auth login`.',
    );
  }

  throw Object.assign(new Error(`Unknown auth subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli auth --help` to see available auth commands.',
  });
};
