/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-ul
 *
 * iotagent-ul is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-ul is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-ul.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[iot_support@tid.es]
 *
 * Modified by: Fernando Méndez, Daniel Calvo - ATOS Research & Innovation
 */

const iotAgentLib = require('iotagent-node-lib');
const regenerateTransid = iotAgentLib.regenerateTransid;
const config = require('./configService');
const transportSelector = require('./transportSelector');
const intoTrans = iotAgentLib.intoTrans;
const _ = require('underscore');
const utils = require('./iotaUtils');
const async = require('async');
const ulParser = require('./ulParser');
const constants = require('./constants');
const context = {
    op: 'IOTAUL.Common.Binding'
};

/**
 * Find the attribute given by its name between all the active attributes of the given device, returning its type, or
 * null otherwise.
 *
 * @param {String} attribute        Name of the attribute to find.
 * @param {Object} device           Device object containing all the information about a device.
 * @return {String}                 String identifier of the attribute type.
 */
function guessType(attribute, device) {
    for (let i = 0; i < device.active.length; i++) {
        if (device.active[i].name === attribute) {
            return device.active[i].type;
        }
    }

    if (attribute === constants.TIMESTAMP_ATTRIBUTE) {
        if (iotAgentLib.configModule.checkNgsi2()) {
            return constants.TIMESTAMP_TYPE_NGSI2;
        }
        return constants.TIMESTAMP_TYPE;
    }
    return constants.DEFAULT_ATTRIBUTE_TYPE;
}

function sendConfigurationToDevice(device, apiKey, deviceId, results, callback) {
    transportSelector.applyFunctionFromBinding(
        [apiKey, deviceId, results],
        'sendConfigurationToDevice',
        device.transport,
        callback
    );
}

/**
 * Deals with configuration requests coming from the device. Whenever a new configuration requests arrives with a list
 * of attributes to retrieve, this handler asks the Context Broker for the values of those attributes, and publish a
 * new message in the "/1234/MQTT_2/configuration/values" topic
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {String} deviceId         Id of the device to be updated.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {Object} objMessage          JSON object received.
 */
function manageConfigurationRequest(apiKey, deviceId, device, objMessage) {
    utils.manageConfiguration(
        apiKey,
        deviceId,
        device,
        objMessage,
        async.apply(sendConfigurationToDevice, device),
        function(error) {
            if (error) {
                iotAgentLib.alarms.raise(constants.MQTTB_ALARM, error);
            } else {
                iotAgentLib.alarms.release(constants.MQTTB_ALARM);
                config
                    .getLogger()
                    .debug(context, 'Configuration request finished for APIKey [%s] and Device [%s]', apiKey, deviceId);
            }
        }
    );
}

/**
 * Utility function used to reduce UL Payload group arrays and process them to update their value in the Context Broker.
 * This function process a new element of the payload group, generating a function ready to be called with a callback
 * in a async.series() call.
 *
 * @param {Object} device       Object containing all the information about the device sending the measures.
 * @param {String} apikey       APIKey of the service the device belongs to.
 * @param {Array} previous      Array of prepared functions that send information to the Context Broker.
 * @param {Object} current      Information sent by the device.
 * @param {Number} index        Index of the group in the array.
 * @return {Array}             Updated array of functions.
 */

/* eslint-disable-next-line no-unused-vars */
function processMeasureGroup(device, apikey, previous, current, index) {
    const values = [];

    if (current.command) {
        previous.push(
            iotAgentLib.setCommandResult.bind(
                null,
                device.name,
                config.getConfig().iota.defaultResource,
                apikey,
                current.command,
                current.value,
                constants.COMMAND_STATUS_COMPLETED,
                device
            )
        );
    } else {
        for (const i in current) {
            /* eslint-disable-next-line no-prototype-builtins */
            if (current.hasOwnProperty(i)) {
                values.push({
                    name: i,
                    type: guessType(i, device),
                    value: current[i]
                });
            }
        }

        previous.push(iotAgentLib.update.bind(null, device.name, device.type, '', values, device));
    }

    return previous;
}

/**
 * Adds multiple measures to the Context Broker. Multiple measures come in the form of single-level JSON objects,
 * whose keys are the attribute names and whose values are the attribute values.
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {String} message          UL payload.
 */
function multipleMeasures(apiKey, device, message) {
    let updates = [];
    const messageStr = message.toString();
    let parsedMessage;

    config.getLogger().debug('Processing multiple measures for device [%s] with apiKey [%s]', device.id, apiKey);

    try {
        parsedMessage = ulParser.parse(messageStr);
    } catch (e) {
        config.getLogger().error(context, 'MEASURES-003: Parse error parsing incoming message [%]', messageStr);
        return;
    }

    updates = parsedMessage.reduce(processMeasureGroup.bind(null, device, apiKey), []);

    async.series(updates, function(error) {
        if (error) {
            config.getLogger().error(
                context,
                /*jshint quotmark: double */
                " MEASURES-002: Couldn't send the updated values to the Context Broker due to an error: %s",
                /*jshint quotmark: single */
                error
            );
        } else {
            // prettier-ignore
            config.getLogger().debug(
                context,
                'Multiple measures for device [%s] with apiKey [%s] successfully updated',
                device.id,
                apiKey
            );
        }
    });
}

/**
 * Adds a single measure to the context broker. The message for single measures contains the direct value to
 * be inserted in the attribute, given by its name.
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {String} attribute        Name of the attribute to update.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {Buffer} message          Raw message coming from the client.
 */
function singleMeasure(apiKey, attribute, device, message) {
    config.getLogger().debug('Processing single measure for device [%s] with apiKey [%s]', device.id, apiKey);

    const values = [
        {
            name: attribute,
            type: guessType(attribute, device),
            value: message.toString()
        }
    ];

    iotAgentLib.update(device.name, device.type, '', values, device, function(error) {
        if (error) {
            config.getLogger().error(
                context,
                /*jshint quotmark: double */
                " MEASURES-002: Couldn't send the updated values to the Context Broker due to an error: %s",
                /*jshint quotmark: single */
                error
            );
        } else {
            // prettier-ignore
            config.getLogger().debug(
                context,
                'Single measure for device [%s] with apiKey [%s] successfully updated',
                device.id,
                apiKey
            );
        }
    });
}

/**
 * Handles an incoming message, extracting the API Key, device Id and attribute to update (in the case of single
 * measures) from the topic.
 *
 * @param {String} topic        Topic of the form: '/<APIKey>/deviceId/attributes[/<attributeName>]'.
 * @param {Object} message      message body (Object or Buffer, depending on the value).
 */
function messageHandler(topic, message, protocol) {
    const topicInformation = topic.split('/');
    let parsedMessage;

    if (topicInformation[1].toLowerCase() === 'ul') {
        topicInformation.splice(1, 1);
    }
    const apiKey = topicInformation[1];
    const deviceId = topicInformation[2];
    const messageStr = message.toString();

    function processMessageForDevice(device, apiKey, topicInformation) {
        iotAgentLib.alarms.release(constants.MQTTB_ALARM);

        if (
            topicInformation[3] === constants.CONFIGURATION_SUFIX &&
            topicInformation[4] === constants.CONFIGURATION_COMMAND_SUFIX &&
            message
        ) {
            parsedMessage = ulParser.parseConfigurationRequest(messageStr);
            manageConfigurationRequest(apiKey, deviceId, device, parsedMessage);
        } else if (topicInformation[3] === constants.CONFIGURATION_COMMAND_UPDATE) {
            const commandObj = ulParser.result(message.toString());
            utils.updateCommand(
                apiKey,
                device,
                commandObj.result,
                commandObj.command,
                constants.COMMAND_STATUS_COMPLETED,
                function(error) {
                    config.getLogger().debug('Command updated with result: %s', error);
                }
            );
        } else if (topicInformation[4]) {
            singleMeasure(apiKey, topicInformation[4], device, message);
        } else if (topicInformation[3] === constants.MEASURES_SUFIX) {
            multipleMeasures(apiKey, device, message.toString());
        } else {
            config.getLogger().error(
                context,
                /*jshint quotmark: double */
                "MEASURES-004: Couldn't process message [%s] due to format issues.",
                /*jshint quotmark: single */
                message
            );
        }
    }

    function processDeviceMeasure(error, device) {
        if (error) {
            config.getLogger().warn(context, 'MEASURES-004: Device not found for topic [%s]', topic);
        } else {
            const localContext = _.clone(context);

            localContext.service = device.service;
            localContext.subservice = device.subservice;

            intoTrans(localContext, processMessageForDevice)(device, apiKey, topicInformation);
        }
    }

    utils.retrieveDevice(deviceId, apiKey, protocol, processDeviceMeasure);
}

/**
 * Handles an incoming AMQP message, extracting the API Key, device Id and attribute to update (in the case of single
 * measures) from the AMQP topic.
 *
 * @param {String} topic        Topic of the form: '/<APIKey>/deviceId/attributes[/<attributeName>]'.
 * @param {Object} message      AMQP message body (Object or Buffer, depending on the value).
 */
function amqpMessageHandler(topic, message) {
    regenerateTransid(topic);
    messageHandler(topic, message, 'AMQP');
}

/**
 * Handles an incoming MQTT message, extracting the API Key, device Id and attribute to update (in the case of single
 * measures) from the MQTT topic.
 *
 * @param {String} topic        Topic of the form: '/<APIKey>/deviceId/attributes[/<attributeName>]'.
 * @param {Object} message      MQTT message body (Object or Buffer, depending on the value).
 */
function mqttMessageHandler(topic, message) {
    regenerateTransid(topic);
    config.getLogger().debug(context, 'message topic: %s', topic);
    messageHandler(topic, message, 'MQTT');
}

exports.amqpMessageHandler = amqpMessageHandler;
exports.mqttMessageHandler = mqttMessageHandler;
exports.messageHandler = messageHandler;
exports.processMeasureGroup = processMeasureGroup;
exports.guessType = guessType;
