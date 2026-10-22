FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY bin ./bin
COPY src ./src
COPY README.md SKILL.md LICENSE ./
ENTRYPOINT ["node", "bin/outrank-cli.js", "mcp"]
