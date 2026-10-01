import { readJsonFile, readStdin, resolvePath } from '../../core/io.js';
import { usageError } from '../../core/errors.js';

const JSON_SOURCE_GUIDANCE = 'Provide one of: --json, --json-file, or --json-stdin.';

const emptyValueError = (option) => usageError(`--${option} requires a value.`);

export const readJsonBody = async ({ json, jsonFile, jsonStdin }) => {
  const given = [
    [json, 'json'],
    [jsonFile, 'json-file'],
    [jsonStdin, 'json-stdin'],
  ].filter(([value]) => value !== undefined);
  if (given.length === 0) throw usageError(JSON_SOURCE_GUIDANCE);
  if (given.length > 1) throw usageError('Use only one JSON input source: --json, --json-file, or --json-stdin.');
  const [[, option]] = given;
  if (json === '' || jsonFile === '') throw emptyValueError(option);

  if (json !== undefined) {
    try {
      return JSON.parse(json);
    } catch (error) {
      throw usageError(`Invalid JSON in --json: ${error.message}`);
    }
  }

  if (jsonFile !== undefined) {
    try {
      return await readJsonFile(resolvePath(jsonFile));
    } catch (error) {
      throw usageError(error.message);
    }
  }

  const stdin = await readStdin();
  if (!stdin.trim()) throw usageError('No JSON was received on stdin.');
  try {
    return JSON.parse(stdin);
  } catch (error) {
    throw usageError(`Invalid JSON from stdin: ${error.message}`);
  }
};
