const QUERY_BASE_ORIGIN = 'https://local';

export const buildQueryPath = (basePath, searchParams = {}) => {
  const url = new URL(`${QUERY_BASE_ORIGIN}${basePath}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
};
