FROM node:lts
WORKDIR /usr/src/app
COPY . .
RUN npm install --omit=dev
CMD ["node", "createidps.js"]
