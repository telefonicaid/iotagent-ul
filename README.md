# IoT Agent for the Ultralight 2.0 protocol

[![FIWARE IoT Agents](https://nexus.lab.fiware.org/static/badges/chapters/iot-agents.svg)](https://www.fiware.org/developers/catalogue/)
[![License: APGL](https://img.shields.io/github/license/telefonicaid/iotagent-ul.svg)](https://opensource.org/licenses/AGPL-3.0)
[![Support badge](https://img.shields.io/badge/tag-fiware+iot-orange.svg?logo=stackoverflow)](https://stackoverflow.com/questions/tagged/fiware+iot)
<br/>
[![Quay badge](https://img.shields.io/badge/quay.io-fiware%2Fiotagent--ul-grey?logo=red%20hat&labelColor=EE0000)](https://quay.io/repository/fiware/iotagent-ul)
[![Docker badge](https://img.shields.io/badge/docker-telefonicaiot%2Fiotagent--ul-blue?logo=docker)](https://registry.hub.docker.com/r/telefonicaiot/iotagent-ul)
<br/>
[![Documentation badge](https://img.shields.io/readthedocs/fiware-iotagent-ul.svg)](http://fiware-iotagent-ul.readthedocs.io/en/latest/?badge=latest)
[![CI](https://github.com/telefonicaid/iotagent-ul/workflows/CI/badge.svg)](https://github.com/telefonicaid/iotagent-ul/actions?query=workflow%3ACI)
[![Coverage Status](https://coveralls.io/repos/github/telefonicaid/iotagent-ul/badge.svg?branch=master)](https://coveralls.io/github/telefonicaid/iotagent-ul?branch=master)
![Status](https://nexus.lab.fiware.org/static/badges/statuses/iot-ultralight.svg)
[![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/4699/badge)](https://bestpractices.coreinfrastructure.org/projects/4699)

An Internet of Things Agent for the Ultralight 2.0 protocol (with [AMQP](https://www.amqp.org/),
[HTTP](https://www.w3.org/Protocols/) and [MQTT](https://mqtt.org/) transports). This IoT Agent is designed to be a
bridge between Ultralight and the
[NGSI](https://swagger.lab.fiware.org/?url=https://raw.githubusercontent.com/Fiware/specifications/master/OpenAPI/ngsiv2/ngsiv2-openapi.json)
interface of a context broker.

It is based on the [IoT Agent Node.js Library](https://github.com/telefonicaid/iotagent-node-lib). Further general
information about the FIWARE IoT Agents framework, its architecture and the common interaction model can be found in the
library's GitHub repository.

This project is part of [FIWARE](https://www.fiware.org/). For more information check the FIWARE Catalogue entry for the
[IoT Agents](https://github.com/Fiware/catalogue/tree/master/iot-agents).

| :books: [Documentation](https://fiware-iotagent-ul.readthedocs.io) | :mortar_board: [Academy](https://fiware-academy.readthedocs.io/en/latest/iot-agents/idas) | <img style="height:1em" src="https://quay.io/static/img/quay_favicon.png"/> [quay.io](https://quay.io/repository/fiware/iotagent-ul) | :whale: [Docker Hub](https://hub.docker.com/r/telefonicaiot/iotagent-ul) | :dart: [Roadmap](https://github.com/telefonicaid/iotagent-ul/blob/master/docs/roadmap.md) |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |


## Contents

-   [Background](#background)
-   [Install](#install)
-   [Usage](#usage)
-   [API](#api)
-   [Contributing](#contributing)
-   [Testing](#testing)
-   [License](#license)

## Background

This _Internet of Things Agent_ is a bridge that can be used to communicate devices using the Ultralight 2.0 protocol
and NGSI Context Brokers (like [Orion](https://github.com/telefonicaid/fiware-orion)). Ultralight 2.0 is a lightweight
text based protocol aimed to constrained devices and communications where the bandwidth and device memory may be limited
resources. This IoT Agent will provide different transport protocol bindings for the same protocol: HTTP, MQTT...

As is the case in any IoT Agent, this one follows the interaction model defined in the
[Node.js IoT Agent Library](https://github.com/telefonicaid/iotagent-node-lib), that is used for the implementation of
the APIs found on the IoT Agent's North Port. Information about the architecture of the IoT Agent can be found on that
global repository. This documentation will only address those features and characteristics that are particular to the
Ultralight 2.0 IoT Agent.

Additional information about operating the component can be found in the
[Operations: logs and alarms](docs/operations.md) document.

## Install

Information about how to install the IoT Agent for Ultralight can be found at the corresponding section of the
[Installation & Administration Guide](docs/installationguide.md).

A `Dockerfile` is also available for your use - further information can be found [here](docker/README.md)

## Usage

Information about how to use the IoT Agent can be found in the [User & Programmers Manual](docs/usermanual.md).

The following features are listed as [deprecated](docs/deprecated.md).

## API

Apiary reference for the Configuration API can be found
[here](https://telefonicaiotiotagents.docs.apiary.io/#reference/configuration-api). More information about IoT Agents
and their APIs can be found in the IoT Agent Library [documentation](https://iotagent-node-lib.readthedocs.io/).

The latest IoT Agent for Ultralight documentation is also available on
[ReadtheDocs](https://fiware-iotagent-ul.readthedocs.io/en/latest/)

## Contributing

If you'd like to contribute, start by searching through the issues and pull requests to see whether someone else has
raised a similar idea or question.

Before contributing, please check out [contribution guidelines](docs/contribution.md)

## Testing

[Mocha](https://mochajs.org/) Test Runner + [Should.js](https://shouldjs.github.io/) Assertion Library.

The test environment is preconfigured to run BDD testing style.

Module mocking during testing can be done with [proxyquire](https://github.com/thlorenz/proxyquire)

In order to successfuly run the tests, on the local machine three services must be running:

-   **mosquitto** MQTT v5 broker;
-   **mongo** Database;
-   **rabbitmq** AMQP broker/server;

They can be run using Docker:

```shell
   docker run -d -p 27017:27017 --hostname mongo --name mongo mongo:6.0.12
   docker run -d -p 1883:1883 --hostname mosquitto --name mosquitto eclipse-mosquitto:1.6.15
   docker run -d -p 5672:5672 --hostname rabbit --name rabbit rabbitmq:3.11.13
```

The required libraries, if missing, can be installed with:

```
npm install
```

To run tests, type

```console
npm test
```

---

## License

The IoT Agent for Ultralight is licensed under [Affero General Public License (GPL) version 3](./LICENSE).

© 2023 Telefonica Investigación y Desarrollo, S.A.U

<details>
<summary><strong>Further information on the use of the AGPL open source license</strong></summary>

### Are there any legal issues with AGPL 3.0? Is it safe for me to use?

There is absolutely no problem in using a product licensed under AGPL 3.0. Issues with GPL (or AGPL) licenses are mostly
related with the fact that different people assign different interpretations on the meaning of the term “derivate work”
used in these licenses. Due to this, some people believe that there is a risk in just _using_ software under GPL or AGPL
licenses (even without _modifying_ it).

For the avoidance of doubt, the owners of this software licensed under an AGPL-3.0 license wish to make a clarifying
public statement as follows:

> Please note that software derived as a result of modifying the source code of this software in order to fix a bug or
> incorporate enhancements is considered a derivative work of the product. Software that merely uses or aggregates (i.e.
> links to) an otherwise unmodified version of existing software is not considered a derivative work, and therefore it
> does not need to be released as under the same license, or even released as open source.

</details>
