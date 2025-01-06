FROM node:20.17

COPY package*.json . 

EXPOSE 3000

RUN npm i

COPY . .

CMD ["npm","run","build"]
