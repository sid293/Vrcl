FROM node:20.17

COPY package*.json .

RUN npm i

COPY dist ./dist 

CMD ["npm","run","start"]

