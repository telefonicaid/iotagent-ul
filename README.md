# IoT Agent for the Ultralight 2.0 protocol

## Index

* [Overview](#overview)
* [Installation](#installation)
* [Usage](#usage)
* [Configuration] (#configuration)
* [Packaging](#packaging)
* [Protocol] (#protocol)
* [Transport Protocol] (#transportprotocol)
* [Developing new transports] (#transport)
* [Development documentation] (#development)

## <a name="overview"/> Overview
This *Internet of Things Agent* is a bridge that can be used to communicate devices using the Ultralight 2.0 protocol
and NGSI Context Brokers (like [Orion](https://github.com/telefonicaid/fiware-orion)). Ultralight 2.0 is a lightweight
text based protocol aimed to constrained devices and communications where the bandwidth and device memory may be limited
resources. This IoTA will provide different transport protocol bindings for the same protocol: HTTP, MQTT...

As is the case in any IoT Agent, this one follows the interaction model defined in the [Node.js IoT Agent Library](https://github.com/telefonicaid/iotagent-node-lib),
that is used for the implementation of the Northbound APIs. Information about the IoTAgent's architecture can be found
on that global repository. This documentation will only address those features and characteristics that are particular
to the Ultralight 2.0 IoTAgent.

Additional information about operating the component can be found in the [Operations: logs and alarms](docs/operations.md) document.

## <a name="installation"/> Installation
There are three ways of installing the Ultralight 2.0 Agent: cloning the Github repository, using the RPM or using Docker.
Regardless of the installation method, there are some middlewares that must be present, as a prerequisite for the component
installation (no installation instructions are provided for these middlewares):

* A MQTT v3.1 Broker is needed for the MQTT Binding to work. Both [Mosquitto](http://mosquitto.org/) and [Rabbit MQ](https://www.rabbitmq.com/)
(with the MQTT plugin activated) have been tested for this purpose.

* A [MongoDB](https://www.mongodb.com/) instance (v3.2+) is required for those IoT Agents configured to have persistent storage.
An in-memory storage repository is also provided for testing purposes.

* The IoT Agent purpose is to connect devices (using a certain southbound device protocol) and NGSI endpoints (typically
 a NGSI Context Broker, like [Orion](https://github.com/telefonicaid/fiware-orion)), so an accessible Context Broker is also required.
IoT Agents were tested with v0.26.0 (higher versions should also work).

Please, follow the links to the official Web Pages to find how can you install each of the middlewares in your environment.

The following sections describe each installation method in detail.

### Cloning the Github repository

Clone the repository with the following command:
```
git clone https://github.com/telefonicaid/iotagent-ul.git
```

Once the repository is cloned, from the root folder of the project execute:
```
npm install
```
This will download the dependencies for the project, and let it ready to the execution.

When the component is executed from a cloned Github repository, it takes the default config file that can be found
in the root of the repository.

### Using the RPM
To see how to generate the RPM, follow the instructions in [Packaging](#rpm).

To install the RPM, use the YUM tool:
```
yum localinstall --nogpg <rpm-file_name>
```

Be aware that the RPM installs linux services that can be used to start the application, instead of directly calling
the executable (as explained in the section [Usage](#usage).

When this option is used, all the files are installed under the `/opt/iotaul` folder. There you can find the `config.js`
file to configure the service. Remember to restart the service each time the config file has changed.

### Using Docker
There are automatic builds of the development version of the IOTAgent published in Docker hub. In order to install
using the docker version, just execute the following:
```
docker run -d --link orion:orion --link mosquitto:mosquitto --link mongo:mongo -p 7896:7896 -p 4041:4041 telefonicaiot/iotagent-ul
```
As you can see, the Ultralight 2.0 (as any other IOTA) requires some docker dependencies to work:

* **mongo**: Mongo database instance (to store provisioning data).
* **orion**: Orion Context Broker.
* **mosquitto**: Mosquitto MQTT broker, to deal with MQTT based requests.

In order to link them, deploy them using docker and use the option `--link` as shown in the example. You may also want to
map the external IOTA ports, for external calls: 4041 (Northbound API) and 7896 (HTTP binding).

## <a name="usage"/> Usage

### Github installation
In order to execute the IOTAgent, just issue the following command from the root folder of the cloned project:
```
bin/iotagent-ul [config file]
```
The optional name of a config file is optional and described in the following section.

### RPM installation
The RPM installs a linux service that can be managed with the typical instructions:
```
service iotaul start

service iotaul status

service iotaul stop
```

In this mode, the log file is written in `/var/log/iotaul/iotaul.log`.

### Docker installation
The Docker automatically starts listening in the API ports, so there is no need to execute any process in order to
have the application running. The Docker image will automatically start.

## <a name="packaging"/> Packaging
The only package type allowed is RPM. In order to execute the packaging scripts, the RPM Build Tools must be available
in the system.

From the root folder of the project, create the RPM with the following commands:
```
cd rpm
./create-rpm.sh -v <version-number> -r  <release-number>
```
Where `<version-number>` is the version (x.y.z) you want the package to have and `<release-number>` is an increasing
number dependent un previous installations.

## <a name="configuration"/> Configuration

All the configuration for the IoT Agent resides in the `config.js` file, in the root of the application. This file
is a JavaSript file, that contains the following sections:

* **config.iota**: general IoT Agent configuration. This group of attributes is common to all types of IoT Agents, and
is described in the global [IoT Agent Library Documentation](https://github.com/telefonicaid/iotagent-node-lib#configuration).
* **config.mqtt**: configuration for the MQTT transport protocol binding of the IoTA (described in the following subsections).
* **config.http**: configuration for the MQTT transport protocol binding of the IoTA (described in the following subsections).
* **config.defaultKey**: default API Key, for devices lacking a provided Configuration.
* **config.defaultTransport**: code of the MQTT transport that will be used to resolve incoming commands and lazy attributes
 in case a transport protocol could not be inferred for the device.

### MQTT Binding configuration
The `config.mqtt` section of the config file contains all the information needed to connect to the MQTT Broker from the
IoTAgent. The following attributes are accepted:

* **host**: Host where the MQTT Broker is located.
* **port**: Port where the MQTT Broker is listening
* **username**: User name for the IoTAgent in the MQTT broker, if authentication is activated.
* **password**: Password for the IoTAgent in the MQTT broker, if authentication is activated.

### HTTP Binding configuration
The `config.http` section of the config file contains all the information needed to start the HTTP server for the HTTP
transport protocol binding. The following options are accepted:

* **port**: port where the southbound HTTP listener will be listening for information from the devices.

### Configuration with environment variables
Some of the more common variables can be configured using environment variables. The ones overriding general parameters
in the `config.iota` set are described in the [IoTA Library Configuration manual](https://github.com/telefonicaid/iotagent-node-lib#configuration).

The ones relating specific Ultralight 2.0 bindings are described in the following table.

| Environment variable      | Configuration attribute             |
|:------------------------- |:----------------------------------- |
| IOTA_MQTT_HOST            | mqtt.host                           |
| IOTA_MQTT_PORT            | mqtt.port                           |
| IOTA_MQTT_USERNAME        | mqtt.username                       |
| IOTA_MQTT_PASSWORD        | mqtt.password                       |
| IOTA_HTTP_HOST            | http.host                           |
| IOTA_HTTP_PORT            | http.port                           |


## <a name="protocol"/> Protocol
### Description
Ultralight 2.0 is a lightweight text based protocol aimed to constrained devices and communications where the
bandwidth and device memory may be limited resources.

### Measure Payload Syntax
The payload for information update requests is composed of a list of key-value pairs separated by the '|' character. E.g.:
```
t|15|k|abc
```
In this example, two attributes, one named "t" with value "15" and another named "k" with value "abc" are transmitted.
Values in Ultralight 2.0 are not typed (everything is treated as a string).

Multiple groups of measures can be combined into a single request, using the '#' character. In that case, a different
NGSI request will be generated for each group of measures. E.g.:
```
gps|1.2/3.4#t|10
```
This will generate two NGSI requests for the same entity, one for each one of the values. Each one of those requests
can contain any number of attributes.

Measure groups can additionaly have an optional timestamp, with the following syntax:
```
2016-06-13T00:35:30Z|lle|100
```
The timestamp will be added as a prefix of the measures themselves, separated by a '|'. The attribute will be translated
to a `TimeInstant` attribute in the final entity.T

### Commands Syntax
Commands are messages sent to the device from the IoT Agent. A command has the following format:
```
<device name>@<command name>|<param name>=<value>|....
```
This indicates that the device (named 'device_name' in the Context Broker) has to execute the command 'command_name', with
the given parameters. E.g.:
```
weatherStation167@ping|param1=1|param2=2
```
This example will tell the Weather Station 167 to reply to a ping message with the provided params.

Once the command has finished its execution in the device, the reply to the server must adhere to the following format:
```
<device name>@<command name>|result
```
Where `device_name` and `command_name` must be the same ones used in the command execution, and the result is the
final result of the command. E.g.:
```
weatherStation167@ping|Ping ok
```
In this case, the Weather station replies with a String value indicating everything has worked fine.

# <a name="transportprotocol"/> Transport Protocol
Ultralight 2.0 defines a payload describing measures and commands to share between devices and servers but, does not
specify a single transport protocol. Instead, different transport protocol bindings can be established for different
scenarios.

This transport protocol binding has not been implemented yet.

The following sections describe the bindings currently supported, or under development.

## HTTP
There are three possible interactions defined in the HTTP binding: requests with GET, requests with POST and commands.

### Requests with GET requests
A device can report new measures to the IoT Platform using an HTTP GET request to the `/iot/d` path with the following
query parameters:

* **i (device ID)**: Device ID (unique for the API Key).
* **k (API Key)**: API Key for the service the device is registered on.
* **t (timestamp)**: Timestamp of the measure. Will override the automatic IoTAgent timestamp (optional).
* **d (Data)**: Ultralight 2.0 payload.

Payloads for GET requests should not contain multiple measure groups.

### Requests with POST requests
Another way of reporting measures is to do it using a POST request. In this case, the payload is passed along as the
request payload. Two query parameters are still mandatory:

* **i (device ID)**: Device ID (unique for the API Key).
* **k (API Key)**: API Key for the service the device is registered on.
* **t (timestamp)**: Timestamp of the measure. Will override the automatic IoTAgent timestamp (optional).

### Sending commands
When using the HTTP transport, the command handling have two flavours:

* **Push commands**: in this case, the Device **must** be provisioned with the `endpoint` attribute, that will contain
the URL where the IoT Agent will send the received commands. The request payload format will be the one described in the
UL Protocol description. The device will reply with a 200OK response containing the result of the command in the UL2.0
result format.

* **Polling commands**: in this case, the Agent does not send any messages to the device, being the later responsible
of retrieving them from the IoTAgent whenever the device is ready to get commands. In order to retrieve commands from
the IoT Agent, the device will send, as part of a normal measure, the query parameter 'getCmd' with value '1'. As a
result of this action, the IoTAgent, instead of returning an empty body (the typical response to a measurement report),
it will return a list of all the commands available for the device, sepparated by the character '#'. The command payload
is described in the protocol section (and its shared with the push commands). Whenever the device has completed the
execution of the command, it will send the response in the same way measurments are reported, but using the **command
result format** as exposed in the [Protocol section](#protocol).

## MQTT
MQTT is a machine-to-machine (M2M)/IoT connectivity protocol, focused on a lightweight interaction between peers. MQTT
is based on publish-subscribe mechanisms over a hierarchical set of topics defined by the user.

This section specifies the topics and messages allowed when using MQTT as the transport protocol for Ultralight 2.0. All
the topics used with the MQTT protocol contain the same prefix:
```
<apiKey>/<deviceId>
```
where `<apiKey>` is the API Key assigned to the service and `<deviceId>` is the ID of the device.

This transport protocol binding is still under development.

### Sending a single measure in one message
In order to send a single measure value to the server, the device must publish the plain value to the following topic:
```
<apiKey>/<deviceId>/attrs/<attrName>
```
Where `<apiKey>` and `<deviceId>` have the typical meaning and `<attrName>` is the name of the measure the device is
sending.

### Sending multiple measures in one message
In order to send multiple measures in a single message, a device must publish a message in the following topic:
```
<apiKey>/<deviceId>/attrs
```
Where `<apiKey>` and `<deviceId>` have the typical meaning. The payload of such message should be a legal Ultralight 2.0
payload (with or without measure groups).

### Commands
Commands using the MQTT transport protocol binding always work in PUSH mode: the server publishes a message in a topic
where the device is subscribed: the *commands topic*. Once the device has finished with the command, it publishes it result
to another topic.

The *commands topic*, where the client will be subscribed has the following format:
```
<apiKey>/<deviceId>/cmd
```

The result of the command must be reported in the following topic:
```
<apiKey>/<deviceId>/cmdexe
```
The command execution and command reporting payload format is specified under the Ultralight 2.0 Commands Syntax, above.

## <a name="transport"/> Developing new transports

The Ultralight 2.0 IoT Agent can work with multiple different transports for the same Ultralight 2.0 payload. Those
transports are dinamically loaded when the Agent starts, by looking in the `lib/bindings` folder for Node.js Modules.
Those module must export the following fields:

* **deviceProvisioningHandler(device, callback)**: this handler will be called each time a new device is provisioned
in the IoT Agent. The device object contains all the information provided in the device registration.

* **configurationHandler(configuration, callback)**: handler for changes (provisioning or updates) in device groups. This
handler should be used when configuration groups require any initialization or registration in the protocol binding.

* **start(newConfig, callback)**: starts the binding module, with the provided configuration. The `newConfig` object
contains the global Agent configuration; the module should use a specific attribute inside the global scope to hold all
its configuration values instead of using the global configuration scope itself.

* **stop(callback)**: stops the binding module.

* **protocol**: This field must contain a string key identifying the protocol. Requests coming from the server (commands
and passive attributes) will use the `protocol` field of the devices and the corresponding `protocol` attribute in the
modules to identify which module should attend the request.

All the methods **must** call the callback before exiting (with or without error). Bindings will use methods in the
IoT Agent Node.js library to interact process incoming requests.

## <a name="development"/> Development documentation
### Project build
The project is managed using Grunt Task Runner.

For a list of available task, type
```bash
grunt --help
```

The following sections show the available options in detail.


### Testing
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


### Coding guidelines
jshint, gjslint

Uses provided .jshintrc and .gjslintrc flag files. The latter requires Python and its use can be disabled
while creating the project skeleton with grunt-init.
To check source code style, type
```bash
grunt lint
```

Checkstyle reports can be used together with Jenkins to monitor project quality metrics by means of Checkstyle
and Violations plugins.
To generate Checkstyle and JSLint reports under `report/lint/`, type
```bash
grunt lint-report
```


### Continuous testing

Support for continuous testing by modifying a src file or a test.
For continuous testing, type
```bash
grunt watch
```


### Source Code documentation
dox-foundation

Generates HTML documentation under `site/doc/`. It can be used together with jenkins by means of DocLinks plugin.
For compiling source code documentation, type
```bash
grunt doc
```


### Code Coverage
Istanbul

Analizes the code coverage of your tests.

To generate an HTML coverage report under `site/coverage/` and to print out a summary, type
```bash
# Use git-bash on Windows
grunt coverage
```

To generate a Cobertura report in `report/coverage/cobertura-coverage.xml` that can be used together with Jenkins to
monitor project quality metrics by means of Cobertura plugin, type
```bash
# Use git-bash on Windows
grunt coverage-report
```


### Code complexity
Plato

Analizes code complexity using Plato and stores the report under `site/report/`. It can be used together with jenkins
by means of DocLinks plugin.
For complexity report, type
```bash
grunt complexity
```

### PLC

Update the contributors for the project
```bash
grunt contributors
```


### Development environment

Initialize your environment with git hooks.
```bash
grunt init-dev-env 
```

We strongly suggest you to make an automatic execution of this task for every developer simply by adding the following
lines to your `package.json`
```
{
  "scripts": {
     "postinstall": "grunt init-dev-env"
  }
}
``` 


### Site generation

There is a grunt task to generate the GitHub pages of the project, publishing also coverage, complexity and JSDocs pages.
In order to initialize the GitHub pages, use:

```bash
grunt init-pages
```

This will also create a site folder under the root of your repository. This site folder is detached from your repository's
history, and associated to the gh-pages branch, created for publishing. This initialization action should be done only
once in the project history. Once the site has been initialized, publish with the following command:

```bash
grunt site
```

This command will only work after the developer has executed init-dev-env (that's the goal that will create the detached site).

This command will also launch the coverage, doc and complexity task (see in the above sections).

