# IoT Agent for the Ultrlight 2.0 protocol

## Index

* [Overview](#overview)
* [Protocol] (#protocol)
* [Developing new transports] (#transport)
* [Development documentation] (#development)


## <a name="overview"/> Overview
This *Internet of Things Agent* is a bridge that can be used to communicate devices using the Ultralight 2.0 protocol
and NGSI Context Brokers (like [Orion](https://github.com/telefonicaid/fiware-orion)). Ultralight 2.0 is a lightweight
text based protocol aimed to constrained devices and communications where the bandwidth and device memory may be limited
resources. This IoTA will provide different transport protocol bindings for the same protocol: HTTP, MQTT...

As is the case in any IoT Agent, this one follows the interaction model defined in the [Node.js IoT Agent Library](https://github.com/telefonicaid/iotagent-node-lib),
that is used for the implementation of the Northbound APIs.

## <a name="protocol"/> Protocol
### Description
Ultralight 2.0 is a lightweight text based protocol aimed to constrained devices and communications where the
bandwidth and device memory may be limited resources.

### Measure Payload Syntax
The payload for information update requests is composed of a list of key-value pairs separated by the '$' character. E.g.:
```
t|15$k|abc
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

### Transport Protocol
Ultralight 2.0 defines a payload describing measures and commands to share between devices and servers but, does not
specify a single transport protocol. Instead, different transport protocol bindings can be established for different
scenarios.

This transport protocol binding has not been implemented yet.

The following sections describe the bindings currently supported, or under development.

#### HTTP
There are three possible interactions defined in the HTTP binding: requests with GET, requests with POST and commands.

##### Requests with GET requests
A device can report new measures to the IoT Platform using an HTTP GET request to the `/iot/d` path with the following
query parameters:

* **i (device ID)**: Device ID (unique for the API Key).
* **k (API Key)**: API Key for the service the device is registered on.
* **t (timestamp)**: Timestamp of the measure. Will override the automatic IoTAgent timestamp (optional).
* **d (Data)**: Ultralight 2.0 payload.

Payloads for GET requests should not contain multiple measure groups.

##### Requests with POST requests
Another way of reporting measures is to do it using a POST request. In this case, the payload is passed along as the
request payload. Two query parameters are still mandatory:

* **i (device ID)**: Device ID (unique for the API Key).
* **k (API Key)**: API Key for the service the device is registered on.
* **t (timestamp)**: Timestamp of the measure. Will override the automatic IoTAgent timestamp (optional).

##### Sending commands

#### MQTT
MQTT is a machine-to-machine (M2M)/IoT connectivity protocol, focused on a lightweight interaction between peers. MQTT
is based on publish-subscribe mechanisms over a hierarchical set of topics defined by the user.

This section specifies the topics and messages allowed when using MQTT as the transport protocol for Ultralight 2.0. All
the topics used with the MQTT protocol contain the same prefix:
```
<apiKey>/<deviceId>
```
where `<apiKey>` is the API Key assigned to the service and `<deviceId>` is the ID of the device.

This transport protocol binding is still under development.

##### Sending a single measure in one message
In order to send a single measure value to the server, the device must publish the plain value to the following topic:
```
<apiKey>/<deviceId>/attr/<attrName>
```
Where `<apiKey>` and `<deviceId>` have the typical meaning and `<attrName>` is the name of the measure the device is
sending.

##### Sending multiple measures in one message
In order to send multiple measures in a single message, a device must publish a message in the following topic:
```
<apiKey>/<deviceId>/attr
```
Where `<apiKey>` and `<deviceId>` have the typical meaning. The payload of such message should be a legal Ultralight 2.0
payload (with or without measure groups).

##### Commands
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

