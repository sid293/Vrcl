FROM ubuntu:latest

RUN apt-get update && apt-get install -y nodejs npm 

COPY package*.json . 

RUN npm install

EXPOSE 8080 

COPY dist .

CMD ["npx","http-server","dist","-y"]

