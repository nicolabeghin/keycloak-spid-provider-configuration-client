FROM node:lts-alpine
ENV NODE_OPTIONS=--dns-result-order=ipv4first
WORKDIR /usr/src/app
COPY . .
RUN npm install --omit=dev
CMD ["node", "createidps.js"]
