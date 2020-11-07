FROM ubuntu:20.10
WORKDIR /app
RUN apt-get update -y
RUN apt-get upgrade -y
RUN apt-get install nodejs -y
RUN apt-get install npm -y
COPY package*.json /app
RUN npm i --production
COPY dist /app/dist
EXPOSE 80 
EXPOSE 8333
RUN ls -al
CMD ["npm", "start"]