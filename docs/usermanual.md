# User & Programmers Manual

-   [API Overview](#api-overview)
    -   [Ultralight 2.0 Protocol](#ultralight-20-protocol)
    -   [Transport Protocol](#transport-protocol)
-   [Developing new transports](#developing-new-transports)
-   [Development documentation](#development-documentation)

## API Overview

This section describes the specific South-bound API implemented by this IoTAgent. For the Configuration API and other
APIs concerning general IoTAgents, check the [API Reference section](https://github.com/telefonicaid/iotagent-ul/blob/master/README.md#api).

### Ultralight 2.0 Protocol

#### Description

Ultralight 2.0 is a lightweight text based protocol aimed to constrained devices and communications where the bandwidth
and device memory may be limited resources.

#### Measure Payload Syntax

The payload for information update requests is composed of a list of key-value pairs separated by the `|` character.
E.g.:

```text
t|15|k|abc
```

In this example, two attributes, one named "t" with value "15" and another named "k" with value "abc" are transmitted.
Values in Ultralight 2.0 are not typed (everything is treated as a string).

Multiple groups of measures can be combined into a single request (but just for HTTP/POST or MQTT), using the `#`
character. In that case, a different NGSI request will be generated for each group of measures. E.g.:

```text
gps|1.2/3.4#t|10
```

This will generate two elements in the NGSI batch update request (POST /v2/op/update) for the same entity, one for each
one of the measures. Each one of those elements can contain any number of attributes.

Measure groups can additionally have an optional timestamp, with the following syntax:

```text
2016-06-13T00:35:30Z|lle|100
```

The timestamp will be added as a prefix of the measures themselves, separated by a '|'. The attribute will be translated
to a `TimeInstant` attribute in the final entity.

#### Active versus passive attributes

Current version of the agent only supports active attributes, i.e. those attributes actively reported +by the device to
the agent. Passive or lazy attributes, i.e. those attributes whose value is only given upon explicit +request from the
agent, are not implemented. Please check the issue +[#23](https://github.com/telefonicaid/iotagent-ul/issues/23) for
more details and updates regarding its implementation.

#### Commands Syntax

Commands are messages sent to the device from the IoT Agent. A command has the following format:

```text
<device name>@<command name>|<command value>
```

This indicates that the device (named 'device_name' in the Context Broker) has to execute the command 'command_name',
with the given value. E.g.:

```text
Robot1@turn|left
```

This example will tell the Robot 1 to turn to left.

In the case of complex commands requiring parameters, the `command_value` could be used to implement parameter passing.
E.g:

```text
weatherStation167@ping|param1=1|param2=2
```

This example will tell the Weather Station 167 to reply to a ping message with the provided params.

Once the command has finished its execution in the device, the reply to the server must adhere to the following format:

```text
<device name>@<command name>|result
```

Where `device_name` and `command_name` must be the same ones used in the command execution, and the result is the final
result of the command. E.g.:

```text
weatherStation167@ping|Ping ok
```

In this case, the Weather station replies with a String value indicating everything has worked fine.

#### Bidirectionality Syntax

The latest versions of the Provisioning API allow for the definition of reverse expressions to keep data shared between
the Context Broker and the device in sync (regardless of whether the data originated in plain data from the device or in
a transformation expression in the IoTAgent). In this cases, when a reverse expression is defined, whenever the
bidirectional attribute is modified, the IoTAgent sends a command to the original device, with the name defined in the
reverse expression attribute and the ID of the device (see Commands Syntax, just above).

#### Commands transformations

It is possible to use expressions to transform commands, in the same way that other attributes could do it, that is
adding `expression` to command definition. This way a command could be defined like:

```json
{
    "name": "reset",
    "type": "command",
    "expression": "{ set: 0}"
}
```

and when command will be executed the command value will be the result of apply value to defined expression. Following
the example case the command will be:

```
set|0
```

Additionally a command could define a `payloadType` in their definition with the aim to transform payload command with
the following meanings:

-   **binaryfromstring**: Payload will transformed into a be Buffer after read it from a string.
-   **binaryfromhex**: Payload will transformed into a be Buffer after read it from a string hex.
-   **binaryfromjson**: Payload will transformed into a be Buffer after read it from a JSON string.
-   **json**: Payload will be stringify from a JSON.
-   **`<empty>`**: This is the default case. Payload will not be transformed.

#### Casting to JSON native format

**FIXME**: this need to be tested, once IOTA Lib 3.0.0 gets released and IOTA UL 2.0.0 (using it) gets released.

Ultralight 2.0 defines a method that allows to use native JSON types in the NGSI v2. For example: The IotAgent receives
this UL measure:

```text
t|10|s|true|l|78.8
```

then the NGSI v2 update uses `10`(number), `true` (boolean) and `78.8` (number) instead of "10" (string), "true"
(string) and "78.8" (string).

This functionality relies on string measures casting feature implemented in the iotagent library. This functionality
uses native JavaScript
[`JSON.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse) function
to cast data coming from measures (as text) to JSON native types. This functionality does not change the attribute type,
using the type specified in the config group or device provision, even if it is not consistent with the measures that
are coming. As an example, for a given measure:

```
a|1|b|1.01|c|true|d|null|e|[1,2,3]|f|['a','b','c']|g|{a:1,b:2,c:3}|h|I'm a string
```

The resulting entity would be something like:

```json
{
    "id": "entityid:001",
    "type": "entitytype",
    "a": {
        "type": "provisionedType",
        "value": 1
    },
    "b": {
        "type": "provisionedType",
        "value": 1.01
    },
    "c": {
        "type": "provisionedType",
        "value": true
    },
    "d": {
        "type": "provisionedType",
        "value": null
    },
    "e": {
        "type": "provisionedType",
        "value": [1, 2, 3]
    },
    "f": {
        "type": "provisionedType",
        "value": ["a", "b", "c"]
    },
    "g": {
        "type": "provisionedType",
        "value": { "a": 1, "b": 2, "c": 3 }
    },
    "h": {
        "type": "provisionedType",
        "value": "I'm a string"
    }
}
```

Note that `provisionedType` is the type included in the device provision or config group, and it is not changed.

### Transport Protocol

Ultralight 2.0 defines a payload describing measures and commands to share between devices and servers but, does not
specify a single transport protocol. Instead, different transport protocol bindings can be established for different
scenarios.

The following sections describe the bindings currently supported: HTTP, MQTT and AMQP.

#### HTTP binding

There are three possible interactions defined in the HTTP binding: requests with GET, requests with POST and commands.

##### Requests with GET requests

A device can report new measures to the IoT Platform using an HTTP GET request to the `/iot/d` path with the following
query parameters:

-   **i (device ID)**: Device ID (unique for the API Key).
-   **k (API Key)**: API Key for the service the device is registered on.
-   **t (timestamp)**: Timestamp of the measure. Will override the automatic IoTAgent timestamp (optional).
-   **d (Data)**: Ultralight 2.0 payload.

Payloads for GET requests should not contain multiple measure groups.

##### Requests with POST requests

Another way of reporting measures is to do it using a POST request. In this case, the payload is passed along as the
request payload. Two query parameters are still mandatory:

-   **i (device ID)**: Device ID (unique for the API Key).
-   **k (API Key)**: API Key for the service the device is registered on.
-   **t (timestamp)**: Timestamp of the measure. Will override the automatic IoTAgent timestamp (optional).

##### Sending commands

All the interations between IotAgent and ContextBroker related to comamnds are described in
[Theory: Scenario 3: commands](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands)
and
[Practice: Scenario 3: commands - happy path](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands-happy-path)
and
[Practice: Scenario 3: commands - error](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands-error).

MQTT devices commands are always push. For HTTP Devices commands to be push they **must** be provisioned with the
`endpoint` attribute, from device or group device, that will contain the URL where the IoT Agent will send the received
commands. Otherwise the command will be poll. When using the HTTP transport, the command handling have two flavours:

-   **Push commands**: The request payload format will be the one described in the UL Protocol description. The device
    will reply with a 200OK response containing the result of the command in the UL2.0 result format. Example of the
    HTTP request sent by IOTA in the case of push command:

```
POST http://[DEVICE_IP]:[PORT]
fiware-service: smart
fiware-servicepath: /streetligths
content-type: text/plain

Robot1@turn|left
```

-   **Polling commands**: in this case, the Agent does not send any messages to the device, being the later responsible
    of retrieving them from the IoTAgent whenever the device is ready to get commands. In order to retrieve commands
    from the IoT Agent, the device will send the query parameter 'getCmd' with value '1' as part of a normal measure. As
    a result of this action, the IoTAgent, instead of returning an empty body (the typical response to a measurement
    report), will return a list of all the commands available for the device, sepparated by the character '#'. The
    command payload is described in the [commands syntax section](#commands-syntax) (and its shared with the push
    commands). Whenever the device has completed the execution of the command, it will send the response in the same way
    measurements are reported, but using the **command result format** as exposed in the
    [commands syntax section](#commands-syntax).

Some additional remarks regarding polling commands:

-   Commands can be also retrieved without needed of sending a mesaure. In other words, the device is not forced to send
    a measure in order to get the accumulated commands. However, in this case note that `GET` method is used to carry
    the `getCmd=1` query parameter (as they are no actual payload for measures, `POST` wouldn't make too much sense).
    Example to retrieve commands from IoT Agent:

```text
curl -X GET 'http://localhost:7896/iot/d?i=motion001&k=4jggokgpepnvsb2uv4s40d59ov&getCmd=1' -i
```

-   Example of the HTTP response sent by IOTA in the case of polling commands (and only one command is stored for that
    device):

```
200 OK
Content-type: text/plain

Robot1@turn|left
```

##### Time processing

HTTP bindig is returning in a HTTP header named `X-Processing-Time` processing time (in milliseconds) expended by
current HTTP measure request. For example:

```
X-Processing-Time: 38
```

#### MQTT binding

MQTT is a machine-to-machine (M2M)/IoT connectivity protocol, focused on a lightweight interaction between peers. MQTT
is based on publish-subscribe mechanisms over a hierarchical set of topics defined by the user.

This section specifies the topics and messages allowed when using MQTT as the transport protocol for Ultralight 2.0. All
the topics subscribed by the agent (to send measures, to configuration command retrieval or to get result of a command)
are prefixed with the agent procotol:

```text
/ul/<apiKey>/<deviceId>
```

where `<apiKey>` is the API Key assigned to the service and `<deviceId>` is the ID of the device.

All topics published by the agent (to send a comamnd or to send configuration information) to a device are not prefixed
by the protocol, in this case '/ul', just include apikey and deviceid (e.g: `/FF957A98/MydeviceId/cmd` and
`/FF957A98/MyDeviceId/configuration/values` ).

> **Note** Measures and commands are sent over different MQTT topics:
>
> -   _Measures_ are sent on the `/<protocol>/<api-key>/<device-id>/attrs` topic,
> -   _Commands_ are sent on the `/<api-key>/<device-id>/cmd` topic,
>
> The reasoning behind this is that when sending measures northbound from device to IoT Agent, it is necessary to
> explicitly identify which IoT Agent is needed to parse the data. This is done by prefixing the relevant MQTT topic
> with a protocol, otherwise there is no way to define which agent is processing the measure. This mechanism allows
> smart systems to connect different devices to different IoT Agents according to need.
>
> For southbound commands, this distinction is unnecessary since the correct IoT Agent has already registered itself for
> the command during the device provisioning step and the device will always receive commands in an appropriate format.


##### Sending a single measure in one message

In order to send a single measure value to the server, the device must publish the plain value to the following topic:

```text
/ul/<apiKey>/<deviceId>/attrs/<attrName>
```

Where `<apiKey>` and `<deviceId>` have the typical meaning and `<attrName>` is the name of the measure the device is
sending.

or instance, if using [Mosquitto](https://mosquitto.org/) with a device with ID `id_sen1`, API Key `ABCDEF` and
attribute IDs `h` and `t`, then humidity measures are reported this way:

```bash
    $ mosquitto_pub -t /ul/ABCDEF/id_sen1/attrs/h -m 70 -h <mosquitto_broker> -p <mosquitto_port> -u <user> -P <password>
```

##### Sending multiple measures in one message

In order to send multiple measures in a single message, a device must publish a message in the following topic:

```text
/ul/<apiKey>/<deviceId>/attrs
```

Where `<apiKey>` and `<deviceId>` have the typical meaning. The payload of such message should be a legal Ultralight 2.0
payload (with or without measure groups).

For instance, if using [Mosquitto](https://mosquitto.org/) with a device with ID `id_sen1`, API Key `ABCDEF` and
attribute IDs `h` and `t`, then all measures (humidity and temperature) are reported this way:

```bash
    $ mosquitto_pub -t /ul/ABCDEF/id_sen1/attrs -m 'h|70|t|15' -h <mosquitto_broker> -p <mosquitto_port> -u <user> -P <password>
```

##### Configuration retrieval

The protocol offers a mechanism for the devices to retrieve its configuration (or any other value it needs from those
stored in the Context Broker). Two topics are created in order to support this feature: a topic for configuration
commands and a topic to receive configuration information. This mechanism can be enabled or disabled using a
configuration flag, `configRetrieval`.

In case of MQTT to retrieve configuration parameters from the Context Broker, it is required that the device should be
provisioned using "MQTT" as transport key, at device or group level. By default it will be considered "MQTT" as
transport if none transport is defined at device or group level or IOTA_DEFAULT_TRANSPORT env var.

The parameter will be given as follows:

`"transport": "MQTT"`

This mechanism and the bidirectionality plugin cannot be simultaneously activated.

##### Configuration command topic

```text
/ul/{{apikey}}/{{deviceid}}/configuration/commands
```

The IoT Agent listens in this topic for requests coming from the device. The messages must contain an Ultralight 2.0
payload with the following format:

```text
{{type}}|{{fields}}
```

-   **type**: indicates the type of command the device is sending. See below for accepted values.
-   **fields**: array with the names of the values to be retrieved from the Context Broker entity representing the
    device, separated by the `|` character.

This command will trigger a query to the CB that will, as a result, end up with a new message posted to the
Configuration information topic (described bellow).

E.g.:

```text
configuration|pollingInterval|publishInterval
```

There are two accepted values for the configuration command types:

-   `subscription`: this command will generate a subscription in the Context Broker that will be triggered whenever any
    of the selected values change. In case the value has changed, all the attributes will be retrieved.
-   `configuration`: this commands will generate a single request to the Context Broker from the IoTAgent, that will
    trigger a single publish message in the values topic.

##### Configuration information topic

```text
/{{apikey}}/{{deviceid}}/configuration/values
```

Every device must subscribe to this topic, so it can receive configuration information. Whenever the device requests any
information from the IoTA, the information will be posted in this topic. The information is published in the same format
used in multiple command reporting: a plain Ultralight 2.0 text with:

-   the `device id` and `command type` separated by the `@`character;
-   a `|` character;
-   a list of `attribute=value` requested pairs separated by the `|` character.

An additional parameter called `dt` is added with the system current time.

E.g.:

```text
device_1@configuration|pollingInterval=200|publishInterval=80|dt=20190626T154200Z
```

##### Commands

All the interations between IotAgent and ContextBroker related to comamnds are described in
[Theory: Scenario 3: commands](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands)
and
[Practice: Scenario 3: commands - happy path](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands-happy-path)
and
[Practice: Scenario 3: commands - error](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands-error).

Commands using the MQTT transport protocol binding always work in PUSH mode: the server publishes a message in a topic
where the device is subscribed: the _commands topic_. Once the device has finished with the command, it publishes it
result to another topic.

The _commands topic_, where the client will be subscribed has the following format:

```text
/<apiKey>/<deviceId>/cmd
```

The result of the command must be reported in the following topic:

```text
/ul/<apiKey>/<deviceId>/cmdexe
```

The command execution and command reporting payload format is specified under the Ultralight 2.0 Commands Syntax, above.

For instance, if a user wants to send a command `ping` with parameters `data = 22`, he will send the following request
to the Context Broker regarding an entity called `sen1` of type `sensor`:

```json
{
    "updateAction": "UPDATE",
    "contextElements": [
        {
            "id": "sen1",
            "type": "sensor",
            "isPattern": "false",
            "attributes": [
                {
                    "name": "ping",
                    "type": "command",
                    "value": "22"
                }
            ]
        }
    ]
}
```

If the API key associated to de device is `ABCDEF`, and the device ID related to `sen1` entity is `id_sen1`, this will
generate a message in the `/ABCDEF/id_sen1/cmd` topic with the following payload:

```text
id_sen1@ping|22
```

If using [Mosquitto](https://mosquitto.org/), such a command is received by running the `mosquitto_sub` script:

```bash
$ mosquitto_sub -v -t /# -h <mosquitto_broker> -p <mosquitto_port> -u <user> -P <password> /ABCDEF/id_sen1/cmd id_sen1@ping|22
```

At this point, Context Broker will have updated the value of `ping_status` to `PENDING` for `sen1` entity. Neither
`ping_info` nor `ping` are updated.

Once the device has executed the command, it can publish its results in the `/ul/ABCDEF/id_sen1/cmdexe` topic with a
payload with the following format:

```text
id_sen1@ping|1234567890
```

If using [Mosquitto](https://mosquitto.org/), such command result is sent by running the `mosquitto_pub` script:

```bash
$ mosquitto_pub -t /ul/ABCDEF/id_sen1/cmdexe -m 'id_sen1@ping|1234567890' -h <mosquitto_broker> -p <mosquitto_port> -u <user> -P <password>
```

In the end, Context Broker will have updated the values of `ping_info` and `ping_status` to `1234567890` and `OK`,
respectively. `ping` attribute is never updated.

Some additional remarks regarding MQTT commands:

-   MQTT devices can configure (at provisioning and updating time) each command with different values of MQTT QoS and
    MQTT retain values, which will be used only by a command. Moreover, in the same MQTT device different commands can
    be configured to use different MQTT options related with QoS level and Retain message policy. I.E:

```json
{
    "commands": [
        {
            "type": "command",
            "name": "a_command_name_A",
            "mqtt": { "qos": 2, "retain": true }
        },
        {
            "type": "command",
            "name": "a_command_name_B",
            "mqtt": { "qos": 1, "retain": false }
        }
    ]
}
```

#### AMQP binding

[AMQP](https://www.amqp.org/) stands for Advance Message Queuing Protocol, and is one of the most popular protocols for
message-queue systems. Although the protocol itself is software independent and allows for a great architectural
flexibility, this transport binding has been designed to work with the [RabbitMQ](https://www.rabbitmq.com/) broker, in
a way that closely resembles the MQTT binding (in the previous section). In fact, for IoT Platform deployments in need
of an scalable MQTT Broker, RabbitMQ with the MQTT plugin will be used, connecting the IoT Agent to RabbitMQ through
AMQP and the clients to RabbitMQ through MQTT.

The binding connects the IoT Agent to an exchange (usually `amq.topic`) and creates two queues (to share between all the
instances of the IoTAgents in a cluster environment): one for the incoming measures, and another for command result
update messages (named as the measure one, adding the `_commands` sufix).

For both measure reporting and command update status the mechanism is much the same as in the case of the MQTT binding:
all the messages must be published to the selected exchange, using the following routing keys:

| Key pattern                           | Meaning                    |
| ------------------------------------- | -------------------------- |
| .<apiKey>.<deviceId>.attrs            | Multiple measure reporting |
| .<apiKey>.<deviceId>.attrs.<attrName> | Single measure reporting   |
| .<apiKey>.<deviceId>.cmd              | Command reception          |
| .<apiKey>.<deviceId>.cmdexe           | Command update message     |

The payload is the same as for the other bindings.

## Developing new transports

The Ultralight 2.0 IoT Agent can work with multiple different transports for the same Ultralight 2.0 payload. Those
transports are dinamically loaded when the Agent starts, by looking in the `lib/bindings` folder for Node.js Modules.
Those module must export the following fields:

-   **deviceProvisioningHandler(device, callback)**: this handler will be called each time a new device is provisioned
    in the IoT Agent. The device object contains all the information provided in the device registration.

-   **configurationHandler(configuration, callback)**: handler for changes (provisioning or updates) in device groups.
    This handler should be used when configuration groups require any initialization or registration in the protocol
    binding.

-   **start(newConfig, callback)**: starts the binding module, with the provided configuration. The `newConfig` object
    contains the global Agent configuration; the module should use a specific attribute inside the global scope to hold
    all its configuration values instead of using the global configuration scope itself.

-   **stop(callback)**: stops the binding module.

-   **protocol**: This field must contain a string key identifying the protocol. Requests coming from the server
    (commands and passive attributes) will use the `protocol` field of the devices and the corresponding `protocol`
    attribute in the modules to identify which module should attend the request.

All the methods **must** call the callback before exiting (with or without error). Bindings will use methods in the IoT
Agent Node.js library to interact process incoming requests.

## Development documentation

### Project build

The project is managed using npm.

For a list of available task, type

```bash
npm run
```

The following sections show the available options in detail.

### Start

Runs a local version of the IoT Agent

```bash
# Use git-bash on Windows
npm start
```

### Testing

[Mocha](https://mochajs.org/) Test Runner + [Should.js](https://shouldjs.github.io/) Assertion Library.

The test environment is preconfigured to run BDD testing style.

Module mocking during testing can be done with [proxyquire](https://github.com/thlorenz/proxyquire)

To run tests, type

```bash
docker run -d -p 27017:27017 mongo:4.2
docker run -d -p 5672:5672 rabbitmq:3.8.9
docker run -d -p 1883:1883 eclipse-mosquitto:1.6.7

npm test
```

### Coding guidelines

ESLint

Uses the provided `.eslintrc.json` flag file. To check source code style, type

```bash
npm run lint
```

### Continuous testing

Support for continuous testing by modifying a src file or a test. For continuous testing, type

```bash
npm run test:watch
```

If you want to continuously check also source code style, use instead:

```bash
npm run watch
```

### Code Coverage

Istanbul

Analizes the code coverage of your tests.

To generate an HTML coverage report under `site/coverage/` and to print out a summary, type

```bash
# Use git-bash on Windows
npm run test:coverage
```

### Documentation guidelines

remark

To check consistency of the Markdown markup, type

```bash
npm run lint:md
```

textlint

Uses the provided `.textlintrc` flag file. To check for spelling and grammar errors, dead links and keyword consistency,
type

```bash
npm run lint:text
```

### Clean

Removes `node_modules` and `coverage` folders, and `package-lock.json` file so that a fresh copy of the project is
restored.

```bash
# Use git-bash on Windows
npm run clean
```

### Prettify Code

Runs the [prettier](https://prettier.io) code formatter to ensure consistent code style (whitespacing, parameter
placement and breakup of long lines etc.) within the codebase.

```bash
# Use git-bash on Windows
npm run prettier
```

To ensure consistent Markdown formatting run the following:

```bash
# Use git-bash on Windows
npm run prettier:text
```
