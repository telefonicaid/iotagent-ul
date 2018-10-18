# IoT Agent for the Ultralight 2.0 protocol

[![FIWARE IoT Agents](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/iot-agents.svg)](https://www.fiware.org/developers/catalogue/)
[![License: APGL](https://img.shields.io/github/license/telefonicaid/iotagent-ul.svg)](https://opensource.org/licenses/AGPL-3.0)
[![Documentation badge](https://img.shields.io/readthedocs/fiware-iotagent-ul.svg)](http://fiware-iotagent-ul.readthedocs.org/en/latest/?badge=latest)
[![Docker badge](https://img.shields.io/docker/pulls/fiware/iotagent-ul.svg)](https://hub.docker.com/r/fiware/iotagent-ul/)
[![Support badge](https://nexus.lab.fiware.org/repository/raw/public/badges/stackoverflow/iot-agents.svg)](https://stackoverflow.com/questions/tagged/fiware+iot)
![Status](https://nexus.lab.fiware.org/repository/raw/public/static/badges/statuses/iot-ultralight.svg)

## Index

* [Description](#description)
* [Installation](#installation)
* [API Overview](#api-overview)
* [API Reference Documentation](#api-reference-documentation)
* [Development documentation](#development-documentation)
* [Testing](#testing)

## Description
This *Internet of Things Agent* is a bridge that can be used to communicate devices using the Ultralight 2.0 protocol
and NGSI Context Brokers (like [Orion](https://github.com/telefonicaid/fiware-orion)). Ultralight 2.0 is a lightweight
text based protocol aimed to constrained devices and communications where the bandwidth and device memory may be limited
resources. This IoT Agent will provide different transport protocol bindings for the same protocol: HTTP, MQTT...

As is the case in any IoT Agent, this one follows the interaction model defined in the [Node.js IoT Agent Library](https://github.com/telefonicaid/iotagent-node-lib),
that is used for the implementation of the APIs found on the IoT Agent's North Port.
Information about the architecture of the IoT Agent can be found on that global repository.
This documentation will only address those features and characteristics
that are particular to the Ultralight 2.0 IoT Agent.

Additional information about operating the component can be found in the [Operations: logs and alarms](docs/operations.md) document.

This project is part of [FIWARE](https://www.fiware.org/). Check also the [FIWARE Catalogue entry for the IoTAgents](http://catalogue.fiware.org/enablers/backend-device-management-idas)

## Installation
Information about how to install the UL IoTAgent can be found at the corresponding section of the [Installation & Administration Guide](docs/installationguide.md).

## API Overview

An Overview of the API can be found in the [User & Programmers Manual](docs/usermanual.md).

## API Reference Documentation

Apiary reference for the Configuration API can be found [here](http://docs.telefonicaiotiotagents.apiary.io/#reference/configuration-api).
More information about IoTAgents and their APIs can be found in the IoTAgent Library [here](https://github.com/telefonicaid/iotagent-node-lib).

## Development documentation

Information about developing for the UL IoTAgent can be found at the corresponding section of the [User & Programmers Manual](docs/usermanual.md).

## Testing
[Mocha](https://mochajs.org/) Test Runner + [Chai](http://chaijs.com/) Assertion Library + [Sinon](http://sinonjs.org/) Spies, stubs.

The test environment is preconfigured to run [BDD](http://chaijs.com/api/bdd/) testing style with
`chai.expect` and `chai.should()` available globally while executing tests, as well as the [Sinon-Chai](http://chaijs.com/plugins/sinon-chai) plugin.

Module mocking during testing can be done with [proxyquire](https://github.com/thlorenz/proxyquire)

To run tests, type
```bash
grunt test
```

Tests reports can be used together with Jenkins to monitor project quality metrics by means of TAP or XUnit plugins.
To generate TAP report in `report/test/unit_tests.tap`, type
```bash
grunt test-report
```
