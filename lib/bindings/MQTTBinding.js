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
 */

'use strict';

var iotAgentLib = require('iotagent-node-lib'),
    intoTrans = iotAgentLib.intoTrans,
    _ = require('underscore'),
    commonBindings = require('./../commonBindings'),
    utils = require('../iotaUtils'),
    ulParser = require('../ulParser'),
    mqtt = require('mqtt'),
    logger = require('logops'),
    async = require('async'),
    constants = require('../constants'),
    context = {
        op: 'IOTAUL.MQTT.Binding'
    },
    mqttClient,
    config = require('../configService');

/**
 * Generate the list of global topics to listen to.
 */
function generateTopics(callback) {
    var topics = [];

    logger.debug(context, 'Generating topics');
    topics.push('/+/+/' + constants.MEASURES_SUFIX + '/+');
    topics.push('/+/+/' + constants.MEASURES_SUFIX);
    topics.push('/+/+/' + constants.CONFIGURATION_COMMAND_SUFIX);

    callback(null, topics);
}

/**
 * Recreate the MQTT subscriptions.
 */
function recreateSubscriptions(callback) {
    logger.debug(context, 'Recreating global subscriptions');

    function subscribeToTopics(topics, callback) {
        logger.debug('Subscribing to topics: %j', topics);

        mqttClient.subscribe(topics, null, function(error) {
            if (error) {
                logger.error(context, ' GLOBAL-001: Error subscribing to topics: %s', error);
                callback(error);
            } else {
                logger.debug('Successfully subscribed to the following topics:\n%j\n', topics);
                callback(null);
            }
        });
    }

    async.waterfall([
        generateTopics,
        subscribeToTopics
    ], callback);
}

/**
 * Unsubscribe the MQTT Client for all the topics of all the devices of all the services.
 */
function unsubscribeAll(callback) {
    function unsubscribeFromTopics(topics, callback) {
        mqttClient.unsubscribe(topics, null);

        callback();
    }

    async.waterfall([
        generateTopics,
        unsubscribeFromTopics
    ], callback);
}

/**
 * Adds multiple MQTT measures to the Context Broker. Multiple measures come in the form of single-level JSON objects,
 * whose keys are the attribute names and whose values are the attribute values.
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {String} message          UL payload.
 */
function multipleMeasures(apiKey, device, message) {
    var updates = [],
        messageStr = message.toString(),
        parsedMessage;

    logger.debug('Processing multiple measures for device [%s] with apiKey [%s]', device.id, apiKey);

    try {
        parsedMessage = ulParser.parse(messageStr);
    } catch (e) {
        logger.error(context, 'MEASURES-003: Parse error parsing incoming MQTT message [%]', messageStr);
        return;
    }

    updates = parsedMessage.reduce(commonBindings.processMeasureGroup.bind(null, device), []);

    async.series(updates, function(error) {
        if (error) {
            logger.error(context,
                ' MEASURES-002: Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
        } else {
            logger.debug(context, 'Multiple measures for device [%s] with apiKey [%s] successfully updated',
                device.id, apiKey);
        }
    });
}

/**
 * Adds a single MQTT measure to the context broker. The message for single measures contains the direct value to
 * be inserted in the attribute, given by its name.
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {String} attribute        Name of the attribute to update.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {Buffer} message          Raw message coming from the MQTT client.
 */
function singleMeasure(apiKey, attribute, device, message) {
    var values;

    logger.debug('Processing single measure for device [%s] with apiKey [%s]', device.id, apiKey);

    values = [
        {
            name: attribute,
            type: commonBindings.guessType(attribute, device),
            value: message.toString()
        }
    ];

    iotAgentLib.update(device.name, device.type, '', values, device, function(error) {
        if (error) {
            logger.error(context,
                ' MEASURES-002: Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
        } else {
            logger.debug(context, 'Single measure for device [%s] with apiKey [%s] successfully updated',
                device.id, apiKey);
        }
    });
}

/**
 * Update the result of a command with the information given by the client.
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {String} message          UL payload.
 */
function updateCommand(apiKey, device, message) {
    var commandObj = ulParser.result(message);

    iotAgentLib.setCommandResult(
        device.name,
        config.getConfig().iota.defaultResource,
        apiKey,
        commandObj.command,
        commandObj.result,
        constants.COMMAND_STATUS_COMPLETED,
        device, function(error) {
            if (error) {
                logger.error(context,
                    'COMMANDS-003: Couldn\'t update command status in the Context broker for device [%s]' +
                    ' with apiKey [%s]: %s',
                    device.id, apiKey, error);
            } else {
                logger.debug(context, 'Single measure for device [%s] with apiKey [%s] successfully updated',
                    device.id, apiKey);
            }
        });
}

/**
 * Handles an incoming MQTT message, extracting the API Key, device Id and attribute to update (in the case of single
 * measures) from the MQTT topic.
 *
 * @param {String} topic        Topic of the form: '/<APIKey>/deviceId/attributes[/<attributeName>]'.
 * @param {Object} message      MQTT message body (Object or Buffer, depending on the value).
 */
function mqttMessageHandler(topic, message) {
    var topicInformation = topic.split('/'),
        apiKey = topicInformation[1],
        deviceId = topicInformation[2];

    function processMessageForDevice(device, apiKey, topicInformation) {
        if (topicInformation[4]) {
            singleMeasure(apiKey, topicInformation[4], device, message);
        } else {
            if (topicInformation[3] === constants.CONFIGURATION_COMMAND_SUFIX) {
                updateCommand(apiKey, device, message.toString());
            } else if (topicInformation[3] === constants.MEASURES_SUFIX) {
                multipleMeasures(apiKey, device, message.toString());
            } else {
                logger.error(context, 'MEASURES-004: Couldn\'t process message [%s] due to format issues.', message);
            }
        }
    }

    function processDeviceMeasure(error, device) {
        if (error) {
            logger.error(context, 'MEASURES-005: Error before processing device measures [%s]', topic);
        } else {
            var localContext = _.clone(context);

            localContext.service = device.service;
            localContext.subservice = device.subservice;

            intoTrans(localContext, processMessageForDevice)(device, apiKey, topicInformation);
        }
    }

    utils.retrieveDevice(deviceId, apiKey, processDeviceMeasure);
}

/**
 * Generate a function that executes the given command in the device.
 *
 * @param {String} apiKey           APIKey of the device's service or default APIKey.
 * @param {Object} device           Object containing all the information about a device.
 * @param {Object} attribute        Attribute in NGSI format.
 * @return {Function}               Command execution function ready to be called with async.series.
 */
function generateCommandExecution(apiKey, device, attribute) {
    var cmdName = attribute.name,
        cmdAttributes = attribute.value,
        payload;

    payload = ulParser.createCommandPayload(device, cmdName, cmdAttributes);

    logger.debug(context, 'Sending command execution to device [%s] with apikey [%s] and payload [%s] ',
        apiKey, device.id, payload);

    return mqttClient.publish.bind(mqttClient, '/' + apiKey + '/' + device.id + '/cmd', payload, null);
}

/**
 * Handles a command execution request coming from the Context Broker. This handler should:
 *  - Identify the device affected by the command.
 *  - Send the command to the appropriate MQTT topic.
 *  - Update the command status in the Context Broker.
 *
 * @param {Object} device           Device data stored in the IOTA.
 * @param {String} attributes       Command attributes (in NGSIv1 format).
 */
function commandHandler(device, attributes, callback) {
    logger.debug(context, 'Handling MQTT command for device [%s]', device.id);

    utils.getEffectiveApiKey(device.service, device.subservice, function(error, apiKey) {
        async.series(attributes.map(generateCommandExecution.bind(null, apiKey, device)), callback);
    });
}

/**
 * Starts the IoT Agent with the passed configuration. This method also starts the listeners for all the transport
 * binding plugins.
 */
function start(callback) {
    var options = {
        keepalive: 0,
        connectTimeout: 60 * 60 * 1000
    };

    logger.info(context, 'Starting MQTT binding');

    if (config.getConfig().mqtt && config.getConfig().mqtt.username && config.getConfig().mqtt.password) {
        options.username = config.getConfig().mqtt.username;
        options.password = config.getConfig().mqtt.password;
    }

    mqttClient = mqtt.connect('mqtt://' + config.getConfig().mqtt.host + ':' + config.getConfig().mqtt.port, options);
    mqttClient.on('error', function(e) {
        logger.fatal('GLOBAL-002: Couldn\'t connect with MQTT broker: %j', e);
        callback(e);
    });

    mqttClient.on('message', mqttMessageHandler);

    mqttClient.on('connect', function(error, param1, param2) {
        logger.info(context, 'MQTT Client connected');
        recreateSubscriptions(callback);
    });
}

/**
 * Stops the IoT Agent and all the transport plugins.
 */
function stop(callback) {
    logger.info('Stopping MQTT Binding');

    async.series([
        unsubscribeAll,
        mqttClient.end.bind(mqttClient, true)
    ], function() {
        logger.info('MQTT Binding Stopped');
        callback();
    });
}

exports.commandHandler = commandHandler;
exports.start = start;
exports.stop = stop;
exports.protocol = 'MQTT';
