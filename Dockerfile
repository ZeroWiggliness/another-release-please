FROM node:20-alpine

RUN apk add --no-cache jq

WORKDIR /app

# Install runtime dependencies using the prebuilt package metadata.
COPY package.json yarn.lock .yarnrc.yml ./

# Install production dependencies only.
RUN corepack enable && \
  yarn workspaces focus --production && \
  yarn cache clean

# Copy the prebuilt application bundle.
COPY dist ./dist

# Make arp available globally so it can be called directly from any shell.
# BusyBox ships an 'arp' ARP-table utility that shadows our command at runtime.
# Remove every known location of it, then install a wrapper script that explicitly
# invokes node so there is no reliance on shebang / PATH resolution for the .js file.
RUN chmod +x /app/dist/bin/arp.js && \
  rm -f /sbin/arp /usr/sbin/arp /bin/arp /usr/bin/arp && \
  printf '#!/bin/sh\nexec node /app/dist/bin/arp.js "$@"\n' > /usr/local/bin/arp && \
  chmod +x /usr/local/bin/arp

ENV NODE_ENV=production

ENTRYPOINT ["arp"]

CMD ["--help"]
