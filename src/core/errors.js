export const cliError = (code, message, guidance, details) => ({
  ok: false,
  error: {
    code,
    message,
    ...(details ? { details } : {}),
  },
  agent_guidance: guidance,
});

export const cliSuccess = (data, guidance) => ({
  ok: true,
  data,
  agent_guidance: guidance,
});
