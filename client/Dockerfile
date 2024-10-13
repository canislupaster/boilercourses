FROM node:22.9-alpine3.19

WORKDIR /client
COPY client/package.json client/package-lock.json ./

RUN npm install

WORKDIR /client
COPY client .
COPY shared /shared

ARG SERVER_URL
ARG NEXT_PUBLIC_ROOT_URL
ARG NEXT_PUBLIC_GOAT_COUNTER
ARG NEXT_PUBLIC_MSAL_CLIENT_ID
ARG NEXT_PUBLIC_MSAL_TENANT

RUN npm run build
CMD ["npm", "run", "start"]