# IoT Agent for the Ultralight 2.0 protocol

[![FIWARE IoT Agents](https://img.shields.io/badge/FIWARE-IoT_Agents-5dc0cf.svg?label=FIWARE&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAVCAYAAAC33pUlAAAABHNCSVQICAgIfAhkiAAAA8NJREFUSEuVlUtIFlEUx+eO+j3Uz8wSLLJ3pBiBUljRu1WLCAKXbXpQEUFERSQF0aKVFAUVrSJalNXGgmphFEhQiZEIPQwKLbEUK7VvZrRvbr8zzjfNl4/swplz7rn/8z/33HtmRhn/MWzbXmloHVeG0a+VSmAXorXS+oehVD9+0zDN9mgk8n0sWtYnHo5tT9daH4BsM+THQC8naK02jCZ83/HlKaVSzBey1sm8BP9nnUpdjOfl/Qyzj5ust6cnO5FItJLoJqB6yJ4QuNcjVOohegpihshS4F6S7DTVVlNtFFxzNBa7kcaEwUGcbVnH8xOJD67WG9n1NILuKtOsQG9FngOc+lciic1iQ8uQGhJ1kVAKKXUs60RoQ5km93IfaREvuoFj7PZsy9rGXE9G/NhBsDOJ63Acp1J82eFU7OIVO1OxWGwpSU5hb0GqfMydMHYSdiMVnncNY5Vy3VbwRUEydvEaRxmAOSSqJMlJISTxS9YWTYLcg3B253xsPkc5lXk3XLlwrPLuDPKDqDIutzYaj3eweMkPeCCahO3+fEIF8SfLtg/5oI3Mh0ylKM4YRBaYzuBgPuRnBYD3mmhA1X5Aka8NKl4nNz7BaKTzSgsLCzWbvyo4eK9r15WwLKRAmmCXXDoA1kaG2F4jWFbgkxUnlcrB/xj5iHxFPiBN4JekY4nZ6ccOiQ87hgwhe+TOdogT1nfpgEDTvYAucIwHxBfNyhpGrR+F8x00WD33VCNTOr/Wd+9C51Ben7S0ZJUq3qZJ2OkZz+cL87ZfWuePlwRcHZjeUMxFwTrJZAJfSvyWZc1VgORTY8rBcubetdiOk+CO+jPOcCRTF+oZ0okUIyuQeSNL/lPrulg8flhmJHmE2gBpE9xrJNkwpN4rQIIyujGoELCQz8ggG38iGzjKkXufJ2Klun1iu65bnJub2yut3xbEK3UvsDEInCmvA6YjMeE1bCn8F9JBe1eAnS2JksmkIlEDfi8R46kkEkMWdqOv+AvS9rcp2bvk8OAESvgox7h4aWNMLd32jSMLvuwDAwORSE7Oe3ZRKrFwvYGrPOBJ2nZ20Op/mqKNzgraOTPt6Bnx5citUINIczX/jUw3xGL2+ia8KAvsvp0ePoL5hXkXO5YvQYSFAiqcJX8E/gyX8QUvv8eh9XUq3h7mE9tLJoNKqnhHXmCO+dtJ4ybSkH1jc9XRaHTMz1tATBe2UEkeAdKu/zWIkUbZxD+veLxEQhhUFmbnvOezsJrk+zmqMo6vIL2OXzPvQ8v7dgtpoQnkF/LP8Ruu9zXdJHg4igAAAABJRU5ErkJgggA=)](https://www.fiware.org/developers/catalogue/)
[![License: APGL](https://img.shields.io/github/license/telefonicaid/iotagent-ul.svg)](https://opensource.org/licenses/AGPL-3.0)
[![Documentation badge](https://img.shields.io/readthedocs/fiware-iotagent-ul.svg)](http://fiware-iotagent-ul.readthedocs.org/en/latest/?badge=latest)
[![Docker badge](https://img.shields.io/docker/pulls/fiware/iotagent-ul.svg)](https://hub.docker.com/r/fiware/iotagent-ul/)
[![Support badge](https://img.shields.io/badge/tag-fiware+iot-orange.svg?logo=stackoverflow)](https://stackoverflow.com/questions/tagged/fiware+iot)

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
