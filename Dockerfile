# Copyright 2015 Telefónica Investigación y Desarrollo, S.A.U
#
# This file is part of the IoT Agent for the Ultralight 2.0 protocol (IOTAUL) component
#
# IOTAUL is free software: you can redistribute it and/or
# modify it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the License,
# or (at your option) any later version.
#
# IOTAUL is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public
# License along with IOTAUL.
# If not, see http://www.gnu.org/licenses/.
#
# For those usages not covered by the GNU Affero General Public License
# please contact with: [daniel.moranjimenez@telefonica.com]

ARG  NODE_VERSION=8.12.0-slim
FROM node:${NODE_VERSION}

MAINTAINER FIWARE IoTAgent Team. Telefónica I+D

WORKDIR /opt/iotaul

COPY package*.json ./

RUN \
  apt-get update && \
  apt-get install -y git && \
  npm install pm2@3.2.2 -g && \
  echo "INFO: npm install --production..." && \
  cd /opt/iotaul && npm install --production && \
  # Clean apt cache
  apt-get clean && \
  apt-get remove -y git && \
  apt-get -y autoremove

COPY . ./

USER node
ENV NODE_ENV=production

ENV MQTT_HOST=localhost \
    MQTT_PORT=1883 \ 
    MQTT_QOS=1 \
    MQTT_RETAIN=false

ENV AMQP_HOST=localhost \
    AMQP_PORT=5672 \
    AMQP_EXCHANGE=iota-exchange \
    AMQP_QUEUE=iotaqueue \
    AMQP_OPTIONS_DURABLE=true

ENV HTTP_PORT=7896

ENV IOTA_LOGLEVEL=DEBUG \
    IOTA_TIMESTAMP=true \
    IOTA_CONTEXTBROKER_HOST=localhost \
    IOTA_CONTEXTBROKER_PORT=1026 \
    IOTA_SERVER_PORT=4061 \
    IOTA_DEFAULTRESOURCE=/iot/d \
    IOTA_DEVICEREGISTRY_TYPE=mongodb \
    IOTA_MONGODB_HOST=localhost \
    IOTA_MONGODB_PORT=27017 \
    IOTA_MONGODB_DB=iotagentul

ENV IOTA_SERVICE=howtoService \
    IOTA_SUBERVICE=/howto \
    IOTA_PROVIDERURL=http://localhost:4061 \
    IOTA_DEFAULTREGISTRATIONDURATION=P1Y \
    IOTA_DEFAULTTYPE=Thing

ENV DEFAULTKEY=TEF \
    DEFAULTTRANSPORT=MQTT

ENTRYPOINT ["pm2-runtime", "bin/iotagent-ul"]
CMD ["-- ", "config.js"]
