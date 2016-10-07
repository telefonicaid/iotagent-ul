# IoT Agent for the Ultralight 2.0 protocol

[![License badge](https://img.shields.io/badge/license-AGPL-blue.svg)](https://opensource.org/licenses/AGPL-3.0)
[![Documentation badge](https://readthedocs.org/projects/fiware-iotagent-ul/badge/?version=latest)](http://fiware-iotagent-ul.readthedocs.org/en/latest/?badge=latest)
[![Docker badge](https://img.shields.io/docker/pulls/fiware/iotagent-ul.svg)](https://hub.docker.com/r/fiware/iotagent-ul/)
[![Support badge]( https://img.shields.io/badge/support-sof-yellowgreen.svg)](http://ask.fiware.org)

## Index

* [Description](#description)
* [Build & Install](#installation)
* [API Overview] (#apioverview)
* [API Reference Documentation] (#apireference)
* [Development documentation] (#development)
* [Testing] (#testing)

## <a name="description"/> Description
This *Internet of Things Agent* is a bridge that can be used to communicate devices using the Ultralight 2.0 protocol
and NGSI Context Brokers (like [Orion](https://github.com/telefonicaid/fiware-orion)). Ultralight 2.0 is a lightweight
text based protocol aimed to constrained devices and communications where the bandwidth and device memory may be limited
resources. This IoTA will provide different transport protocol bindings for the same protocol: HTTP, MQTT...

As is the case in any IoT Agent, this one follows the interaction model defined in the [Node.js IoT Agent Library](https://github.com/telefonicaid/iotagent-node-lib),
that is used for the implementation of the Northbound APIs. Information about the IoTAgent's architecture can be found
on that global repository. This documentation will only address those features and characteristics that are particular
to the Ultralight 2.0 IoTAgent.

Additional information about operating the component can be found in the [Operations: logs and alarms](docs/operations.md) document.

This project is part of [FIWARE](https://www.fiware.org/). Check also the [FIWARE Catalogue entry for the IoTAgents](http://catalogue.fiware.org/enablers/backend-device-management-idas)

## <a name="installation"/> Installation
Information about how to install the UL IoTAgent can be found at the corresponding section of the [Installation & Administration Guide](docs/installationguide.md).

## <a name="apioverview"/> API Overview

An Overview of the API can be found in the [User & Programmers Manual](docs/usermanual.md).

## <a name="apireference"/> API Reference Documentation

Apiary reference for the Configuration API can be found [here]().
More information about IoTAgents and their APIs can be found in the IoTAgent Library [here](https://github.com/telefonicaid/iotagent-node-lib).

## <a name="development"/> Development documentation

Information about developing for the UL IoTAgent can be found at the corresponding section of the [User & Programmers Manual](docs/usermanual.md).

## <a name="testing"/> Testing
[Mocha](http://visionmedia.github.io/mocha/) Test Runner + [Chai](http://chaijs.com/) Assertion Library + [Sinon](http://sinonjs.org/) Spies, stubs.

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
