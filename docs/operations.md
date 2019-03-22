# Operations Manual: logs and alarms

-   [Overview](#overview)
-   [Logs](#logs)
-   [Alarms](#alarms)
-   [Error naming code](#error-naming-code)

## Overview

The following document shows all the errors that can appear in the IoTAgent Ultralight 2.0 log file, and gives a brief
idea of the severity and how to react to those errors.

Take into account that this Agent uses the IoT Agent Library for Node.js, and so can raise its alarms and log errors in
addition to those particular of this agent. More information about those can be found in the
[IoT Agent Library Operations Manual](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/operations.md).

## Logs

The following section contains the error log entries that can appear in the IoTA logs, grouped by category.

### Command errors

#### COMMANDS-001: Command execution could not be handled, as device for entity \[%s\] wasn\'t found

Indicates that a command has been received for a non-registered entity. This could mean the device was removed from the
IoT Agent without removing the registration in the Context Broker. Check for the existence of a provisioned device for
the entity, and, if it doesn't exist, remove the Context Broker registration for that unexistent device.

#### COMMANDS-002: Could not find any API Key information for device.

Indicates that there was no APIKey defined for the provisioned device targeted by a command. This error log should never
happen in production, as there should be a default APIKey configured for devices not belonging to a Configuration. If it
does happen, check the configuration property `defaultKey`.

#### COMMANDS-003: Couldn\'t update command status in the Context broker for device \[%s\] with apiKey \[%s\]: %s

There was some communication error connecting with the Context Broker that made it impossible to update the command
status. If this error appears, the command status will be left inconsistent. If this log appears frequently, it may be a
signal of network problems between the IoTAgent and the Context Broker. Check the IoTAgent network connection, and the
configured Context Broker port and host.

#### COMMANDS-004: Error handling incoming command for device \[%s\]

There was a problem sending the command to a device. If this error happens occasionally and just with one device, it may
indicate a problem with that particular device (broken connectivity, device shutdown, etc.). If it happens frequently it
will indicate a IoTAgent problem with the South Bound connectivity.

#### COMMANDS-005: Error updating error information for device \[%s\]

This error log indicates that a connectivity problem happened when the IoT Agent was trying to report an error sending
information to a device. If this log appears, it means the IoTAgent has problems both in the Northern and Southern
network interfaces, and it most probably indicates a general network accesing problem for the IoTA.

### Measure errors

#### MEASURES-001: Couldn\'t find device data for APIKey \[%s\] and DeviceId\[%s\]

This error log will appear whenever a measure arrives to the IoTAgent for a device that has not been provisioned or for
an API Key that has not been registered in the IOTAgent. This could have several origins: the may be a typo in the
DeviceId or APIKey used by the customer; or either the Configuration or the Device for the corresponding measure may
have been removed; or the customer may have forgotten to provision both the Configuration and the Device.

#### MEASURES-002: Couldn\'t send the updated values to the Context Broker due to an error: %s

There was some communication error connecting with the Context Broker that made it impossible to send the measures. If
this log appears frequently, it may be a signal of network problems between the IoTAgent and the Context Broker. Check
the IoTAgent network connection, and the configured Context Broker port and host.

#### MEASURES-003: Parse error parsing incoming MQTT message \[%\]

An error was found parsing the MQTT message payload. This will commonly happen when a new client is integrating their
software with the platform, meaning the payload has not the appropriate Ultralight 2.0 format. Normally, this is an
error that can only be addressed by the client itself

#### MEASURES-004: Couldn\'t process message \[%s\] due to format issues

Implies a message was received in an invalid MQTT Topic. Normally, this is an error that can only be addressed by the
client itself.

#### MEASURES-005: Error before processing device measures \[%s\]

This error will be risen when the IoTA is processing a set of MQTT measures, but cannot find the device they belong to.
Usually will be caused by unprovisioned or ill-provisioned devices.

#### MEASURES-006: Error before processing device measures \[%s\]

### Global errors

#### GLOBAL-001: Error subscribing to topics: %s

Error subscribing the IoT Agent to the appropriate MQTT Topics. This error can only happen at startup time, and should
prevent the IOTA from starting. If this error occurs, check the Mosquitto MQTT broker is up and running and check the
connectivity from the IoTAgent to the broker.

#### GLOBAL-002: Couldn\'t connect with MQTT broker: %j

This fatal error will be risen when the IOTAgent cannot make the initial connection to the Mosquitto MQTT broker. If
this error occurs, check the Mosquitto MQTT broker is up and running and check the connectivity from the IoTAgent to the
broker.

## Alarms

The following table shows the alarms that can be raised in the Ultralight 2.0 IoTAgent library. All the alarms are
signaled by an error log starting with the prefix `Raising %s:` (where `%s` is the alarm name). All the alarms are
released by an info log with the prefix `Releasing [%s]`. These texts appear in the `msg=` field of the generic log
record format.

| Alarm name  | Severity     | Description                                                      |
| :---------- | :----------- | :--------------------------------------------------------------- |
| MQTTB-ALARM | **Critical** | Indicates a persistent error accessing the Mosquitto MQTT Broker |

while the 'Severity' criterium is as follows:

-   **Critical** - The system is not working
-   **Major** - The system has a problem that degrades the service and must be addressed
-   **Warning** - It is happening something that must be notified

## Error naming code

Every error has a code composed of a prefix and an ID, codified with the following table:

| Prefix   | Type of operation                      |
| :------- | :------------------------------------- |
| GLOBAL   | Global errors                          |
| MEASURES | Errors related with measure processing |
| COMMANDS | Errors related with command processing |
