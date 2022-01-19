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

ARG NODE_VERSION=12
ARG GITHUB_ACCOUNT=telefonicaid
ARG GITHUB_REPOSITORY=iotagent-ul
ARG DOWNLOAD=latest
ARG SOURCE_BRANCH=master

# Default Builder, distro and distroless build version
ARG BUILDER=node:${NODE_VERSION}
ARG DISTRO=node:${NODE_VERSION}-slim
ARG DISTROLESS=gcr.io/distroless/nodejs:${NODE_VERSION}
ARG PACKAGE_MANAGER=apt
ARG USER=node

########################################################################################
#
# This build stage retrieves the source code from GitHub. The default download is the 
# latest tip of the master of the named repository on GitHub.
#
# To obtain the latest stable release run this Docker file with the parameters:
# --no-cache --build-arg DOWNLOAD=stable
#
# To obtain any specific version of a release run this Docker file with the parameters:
# --no-cache --build-arg DOWNLOAD=1.7.0
#
# For development purposes, to create a development image including a running Distro, 
# run this Docker file with the parameter:
#
# --target=builder
#
######################################################################################## 
FROM ${BUILDER} AS builder
ARG GITHUB_ACCOUNT
ARG GITHUB_REPOSITORY
ARG DOWNLOAD
ARG SOURCE_BRANCH
ARG PACKAGE_MANAGER

# hadolint ignore=DL3002
USER root
# hadolint ignore=SC2039
RUN \
	# Ensure that the chosen package manger is supported by this Dockerfile
	# also ensure that unzip and git is installed prior to downloading sources
	if [ "${PACKAGE_MANAGER}" = "apt"  ]; then \
		echo -e "\033[0;34mINFO: Using default \"${PACKAGE_MANAGER}\".\033[0m"; \
		apt-get install -y --no-install-recommends unzip git; \
	elif [ "${PACKAGE_MANAGER}" = "yum"  ]; then \
		echo -e "\033[0;33mWARNING: Overriding default package manager. Using \"${PACKAGE_MANAGER}\" .\033[0m"; \
		yum install -y unzip git; \
		yum clean all; \
	elif [ "${PACKAGE_MANAGER}" = "apk"  ]; then \
		echo -e "\033[0;33mWARNING: Overriding default package manager. Using \"${PACKAGE_MANAGER}\" .\033[0m"; \
		apk add --no-cache unzip git; \
	else \
	 	echo -e "\033[0;31mERROR: Package Manager \"${PACKAGE_MANAGER}\" not supported.\033[0m"; \
	 	exit 1; \
	fi


# As an Alternative for local development, just copy this Dockerfile into file the root of 
# the repository and replace the whole RUN statement below by the following COPY statement 
# in your local source using :
#
# COPY . /opt/iotaul/
#

RUN \
	if [ "${DOWNLOAD}" = "latest" ] ; \
	then \
		RELEASE="${SOURCE_BRANCH}"; \
		echo "INFO: Building Latest Development from ${SOURCE_BRANCH} branch."; \
	elif [ "${DOWNLOAD}" = "stable" ]; \
	then \
		RELEASE=$(curl -s https://api.github.com/repos/"${GITHUB_ACCOUNT}"/"${GITHUB_REPOSITORY}"/releases/latest | grep 'tag_name' | cut -d\" -f4); \
		echo "INFO: Building Latest Stable Release: ${RELEASE}"; \
	else \
	 	RELEASE="${DOWNLOAD}"; \
	 	echo "INFO: Building Release: ${RELEASE}"; \
	fi && \
	RELEASE_CONCAT=$(echo "${RELEASE}" | tr / -); \
	curl -s -L https://github.com/"${GITHUB_ACCOUNT}"/"${GITHUB_REPOSITORY}"/archive/"${RELEASE}".zip > source.zip && \
	unzip source.zip -x "*/test/**" "*/rpm/**" "*/ghpages/**" "*/docs/**" "*/.*" && \
	rm source.zip && \
	mv "${GITHUB_REPOSITORY}-${RELEASE_CONCAT}" /opt/iotaul

WORKDIR /opt/iotaul

RUN \
	echo "INFO: npm install --production..." && \
	npm install --only=prod --no-package-lock --no-optional --unsafe-perm

########################################################################################
#
# This build stage installs PM2 if required.
# 
# To create an image using PM2 run this Docker file with the parameter:
#
# --target=pm2-install
#
########################################################################################
FROM ${DISTRO} AS pm2
ARG GITHUB_ACCOUNT
ARG GITHUB_REPOSITORY
ARG NODE_VERSION
ARG USER

LABEL "maintainer"="FIWARE IoTAgent Team. Telefónica I+D"
LABEL "description"="An Internet of Things Agent for the Ultralight 2.0 protocol (with AMQP, HTTP and MQTT transports). This IoT Agent is designed to be a bridge between Ultralight and the NGSI interface of a context broker."
LABEL "name"="iotagent-ul"
LABEL "summary"="IoT Agent for Ultralight 2.0 with PM2"

LABEL "org.opencontainers.image.authors"="iot_support@tid.es"
LABEL "org.opencontainers.image.documentation"="https://fiware-iotagent-ul.rtfd.io/"
LABEL "org.opencontainers.image.vendor"="Telefónica Investigación y Desarrollo, S.A.U"
LABEL "org.opencontainers.image.licenses"="AGPL-3.0-only"
LABEL "org.opencontainers.image.title"="IoT Agent for the Ultralight 2.0 protocol with pm2"
LABEL "org.opencontainers.image.description"="An Internet of Things Agent for the Ultralight 2.0 protocol (with AMQP, HTTP and MQTT transports). This IoT Agent is designed to be a bridge between Ultralight and the NGSI interface of a context broker."
LABEL "org.opencontainers.image.source"="https://github.com/${GITHUB_ACCOUNT}/${GITHUB_REPOSITORY}"
LABEL "org.nodejs.version"="${NODE_VERSION}"

COPY --from=builder /opt/iotaul /opt/iotaul
COPY --from=builder /opt/iotaul/LICENSE /licenses/LICENSE
RUN npm install pm2@4.4.0 -g --no-package-lock --no-optional

USER ${USER}
ENV NODE_ENV=production
# Expose 4061 for NORTH PORT, 7896 for HTTP PORT
EXPOSE ${IOTA_NORTH_PORT:-4061} ${IOTA_HTTP_PORT:-7896}
CMD ["pm2-runtime", "/opt/iotaul/bin/iotagent-ul", "-- ", "config.js"]

########################################################################################
#
# This build stage creates an anonymous user to be used with the distroless build
# as defined below.
#
########################################################################################
FROM ${DISTRO} AS anon-user
# hadolint ignore=DL3002
USER root
RUN sed -i -r "/^(root|nobody)/!d" /etc/passwd /etc/shadow /etc/group \
    && sed -i -r 's#^(.*):[^:]*$#\1:/sbin/nologin#' /etc/passwd

########################################################################################
#
# This build stage creates a distroless image for production.
#
# IMPORTANT: For production environments use Docker Secrets to protect values of the 
# sensitive ENV variables defined below, by adding _FILE to the name of the relevant 
# variable.
#
# - IOTA_AUTH_USER, IOTA_AUTH_PASSWORD - when using Keystone Security 
# - IOTA_AUTH_CLIENT_ID, IOTA_AUTH_CLIENT_SECRET - when using OAuth2 Security
#
########################################################################################
FROM ${DISTROLESS} AS distroless
ARG GITHUB_ACCOUNT
ARG GITHUB_REPOSITORY
ARG NODE_VERSION

LABEL "maintainer"="FIWARE IoTAgent Team. Telefónica I+D"
LABEL "description"="An Internet of Things Agent for the Ultralight 2.0 protocol (with AMQP, HTTP and MQTT transports). This IoT Agent is designed to be a bridge between Ultralight and the NGSI interface of a context broker."
LABEL "name"="iotagent-ul"
LABEL "summary"="IoT Agent for Ultralight 2.0 (Distroless)"

LABEL "org.opencontainers.image.authors"="iot_support@tid.es"
LABEL "org.opencontainers.image.documentation"="https://fiware-iotagent-ul.rtfd.io/"
LABEL "org.opencontainers.image.vendor"="Telefónica Investigación y Desarrollo, S.A.U"
LABEL "org.opencontainers.image.licenses"="AGPL-3.0-only"
LABEL "org.opencontainers.image.title"="IoT Agent for the Ultralight 2.0 protocol (Distroless)"
LABEL "org.opencontainers.image.description"="An Internet of Things Agent for the Ultralight 2.0 protocol (with AMQP, HTTP and MQTT transports). This IoT Agent is designed to be a bridge between Ultralight and the NGSI interface of a context broker."
LABEL "org.opencontainers.image.source"="https://github.com/${GITHUB_ACCOUNT}/${GITHUB_REPOSITORY}"
LABEL "org.nodejs.version"="${NODE_VERSION}"

COPY --from=builder /opt/iotaul /opt/iotaul
COPY --from=anon-user /etc/passwd /etc/shadow /etc/group /etc/
WORKDIR /opt/iotaul

USER nobody
ENV NODE_ENV=production
# Expose 4061 for NORTH PORT, 7896 for HTTP PORT
EXPOSE ${IOTA_NORTH_PORT:-4061} ${IOTA_HTTP_PORT:-7896}
CMD ["./bin/iotagent-ul", "-- ", "config.js"]
HEALTHCHECK  --interval=30s --timeout=3s --start-period=10s \
  CMD ["/nodejs/bin/node", "./bin/healthcheck"]

########################################################################################
#
# This build stage creates a node-slim image for production.
#
# IMPORTANT: For production environments use Docker Secrets to protect values of the 
# sensitive ENV variables defined below, by adding _FILE to the name of the relevant 
# variable.
#
# - IOTA_AUTH_USER, IOTA_AUTH_PASSWORD - when using Keystone Security 
# - IOTA_AUTH_CLIENT_ID, IOTA_AUTH_CLIENT_SECRET - when using OAuth2 Security
#
########################################################################################
FROM ${DISTRO} AS slim
ARG GITHUB_ACCOUNT
ARG GITHUB_REPOSITORY
ARG NODE_VERSION
ARG USER

LABEL "maintainer"="FIWARE IoTAgent Team. Telefónica I+D"
LABEL "description"="An Internet of Things Agent for the Ultralight 2.0 protocol (with AMQP, HTTP and MQTT transports). This IoT Agent is designed to be a bridge between Ultralight and the NGSI interface of a context broker."
LABEL "name"="iotagent-ul"
LABEL "summary"="IoT Agent for Ultralight 2.0"

LABEL "org.opencontainers.image.authors"="iot_support@tid.es"
LABEL "org.opencontainers.image.documentation"="https://fiware-iotagent-ul.rtfd.io/"
LABEL "org.opencontainers.image.vendor"="Telefónica Investigación y Desarrollo, S.A.U"
LABEL "org.opencontainers.image.licenses"="AGPL-3.0-only"
LABEL "org.opencontainers.image.title"="IoT Agent for the Ultralight 2.0 protocol"
LABEL "org.opencontainers.image.description"="An Internet of Things Agent for the Ultralight 2.0 protocol (with AMQP, HTTP and MQTT transports). This IoT Agent is designed to be a bridge between Ultralight and the NGSI interface of a context broker."
LABEL "org.opencontainers.image.source"="https://github.com/${GITHUB_ACCOUNT}/${GITHUB_REPOSITORY}"
LABEL "org.nodejs.version"="${NODE_VERSION}"

COPY --from=builder /opt/iotaul /opt/iotaul
COPY --from=builder /opt/iotaul/LICENSE /licenses/LICENSE
WORKDIR /opt/iotaul

USER ${USER}
ENV NODE_ENV=production
# Expose 4061 for NORTH PORT, 7896 for HTTP PORT
EXPOSE ${IOTA_NORTH_PORT:-4061} ${IOTA_HTTP_PORT:-7896}
CMD ["node", "/opt/iotaul/bin/iotagent-ul", "-- ", "config.js"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
   CMD ["npm", "run", "healthcheck"]
