FROM node:22

RUN mkdir -p /opt/app/

# Install app dependencies
COPY *.json /opt/app/

# Create app directory
WORKDIR /opt/app
RUN npm i -g nodemon
RUN npm i -g ts-node
RUN npm i -g tsx
RUN npm i --include=dev
