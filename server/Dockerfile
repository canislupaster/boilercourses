FROM node:23.6-alpine3.20 AS nodejs

FROM eclipse-temurin:23-alpine-3.20 AS base

COPY --from=nodejs /usr/lib /usr/lib/
COPY --from=nodejs /usr/local/lib /usr/local/lib/
COPY --from=nodejs /usr/local/include /usr/local/include/
COPY --from=nodejs /usr/local/bin /usr/local/bin/
RUN apk add --no-cache curl bash chromium

FROM base AS builder

WORKDIR /server

COPY server/scripts/package.json server/scripts/package-lock.json ./scripts/
RUN cd ./scripts && npm install

COPY server/gradlew server/settings.gradle ./
COPY server/gradle ./gradle

RUN chmod +x gradlew
RUN ./gradlew wrapper --gradle-version latest

COPY server .
RUN ./gradlew installDist

FROM base AS runner

WORKDIR /server

COPY --from=builder server/scripts ./scripts
COPY shared /shared
COPY --from=builder /server/build/install/boilerclasses ./boilerclasses
COPY server/application.prod.conf application.conf

HEALTHCHECK --interval=5m --timeout=1m --start-period=1m \
  CMD curl -s -o /dev/null -w "%{http_code}" -X POST localhost:8080/info | grep -q 200 || exit 1

CMD cd ./scripts && npm run migrate:latest && cd .. && ./boilerclasses/bin/boilerclasses