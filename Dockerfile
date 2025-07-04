FROM node:22.15

RUN mkdir -p /opt/app/

COPY *.json /opt/app/

WORKDIR /opt/app
