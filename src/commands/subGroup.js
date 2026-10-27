import { cliWords, defineGroup, lastSegment } from './registry.js';

const WORD_SEPARATOR = ' ';

export const subGroup = ({ id, usage, actions, children }) => {
  const noun = lastSegment(id);
  const group = cliWords(id).slice(0, -1).join(WORD_SEPARATOR);
  const guidance = `Use: ${group} ${noun} ${actions}.`;
  return defineGroup({
    id,
    help: { usage, guidance },
    unknown: (word) => ({ message: `Unknown ${noun} action: ${word}.`, guidance }),
    children,
  });
};
