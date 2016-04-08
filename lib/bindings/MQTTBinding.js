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
    commonBindings = require('./../commonBindings'),
    ulParser = require('../ulParser'),
    mqtt = require('mqtt'),
    logger = require('logops'),
    async = require('async'),
    errors = require('../errors'),
    constants = require('../constants'),
    apply = async.apply,
    context = {
        op: 'IOTAUL.MQTT.Binding'
    },
    mqttClient,
    config;

/**
 * Get the API Key for the selected service if there is any, or the default API Key if a specific one does not exist.
 *
 * @param {String} service          Name of the service whose API Key we are retrieving.
 * @param {String} subservice       Name of the subservice whose API Key we are retrieving.
 */
function getEffectiveApiKey(service, subservice, callback) {
    logger.debug(context, 'Getting effective API Key');

    iotAgentLib.findConfiguration(service, subservice, function(error, group) {
        if (group) {
            logger.debug('Using found group: %j', group);
            callback(null, group.apikey);
        } else if (config.mqtt.defaultKey) {
            logger.debug('Using default API Key: %s', config.mqtt.defaultKey);
            callback(null, config.mqtt.defaultKey);
        } else {
            logger.error(context, 'Could not find any API Key information for device.');
            callback(new errors.GroupNotFound(service, subservice));
        }
    });
}

/**
 * Generate the list of topics related to the device, based on the device attribute definitions.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 * @param {String} apikey           API Key the device is subscribed to.
 */
function generateDeviceTopics(device, apikey, callback) {
    var topics = [];

    logger.debug(context, 'Generating device topics');
    topics.push('/' + apikey + '/' + device.id + '/' + constants.MEASURES_SUFIX + '/+');
    topics.push('/' + apikey + '/' + device.id + '/' + constants.MEASURES_SUFIX);
    topics.push('/' + apikey + '/' + device.id + '/' + constants.CONFIGURATION_SUFIX +
        '/' + constants.CONFIGURATION_COMMAND_SUFIX);

    callback(null, topics);
}

function deviceProvisioningHandler(device, callback) {
    function subscribeToTopics(topics, callback) {
        logger.debug('Subscribing to topics: %j', topics);

        mqttClient.subscribe(topics, null, function(error) {
            if (error) {
                logger.error('Error subscribing to device topics: %s', error);
                callback(error);
            } else {
                logger.debug('Successfully subscribed to the following topics:\n%j\n', topics);
                callback(null, device);
            }
        });
    }

    if (mqttClient) {
        async.waterfall([
            apply(getEffectiveApiKey, device.service, device.subservice),
            apply(generateDeviceTopics, device),
            subscribeToTopics
        ], callback);
    } else {
        callback();
    }
}

/**
 * Unsubscribe the MQTT Client of all the topics for a single device.
 *
 * @param {Object} device       Object containing all the information about the device from the registry.
 */
function unsubscribeSingleDevice(device, callback) {
    function unsubscribeFromTopics(topics, callback) {
        mqttClient.unsubscribe(topics, null);

        callback();
    }

    async.waterfall([
        apply(getEffectiveApiKey, device.service, device.subservice),
        apply(generateDeviceTopics, device),
        unsubscribeFromTopics
    ], callback);
}

/**
 * Recreate the MQTT subscriptions for all the registered devices.
 */
function recreateSubscriptions(callback) {
    logger.debug(context, 'Recreating subscriptions for all devices');
    iotAgentLib.listDevices(function(error, devices) {
        if (error) {
            logger.error(context, 'Could not get the list of devices to recreate subscriptions');
            callback(error);
        } else {
            async.map(devices.devices, deviceProvisioningHandler, callback);
        }
    });
}

/**
 * Unsubscribe the MQTT Client for all the topics of all the devices of all the services.
 */
function unsubscribeAll(callback) {
    iotAgentLib.listDevices(function(error, devices) {
        if (error) {
            callback(error);
        } else {
            async.map(devices, unsubscribeSingleDevice, callback);
        }
    });
}

/**
 * Adds multiple MQTT measures to the Context Broker. Multiple measures come in the form of single-level JSON objects,
 * whose keys are the attribute names and whose values are the attribute values.
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {String} deviceId         Id of the device to be updated.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {Object} messageObj       JSON object sent using MQTT.
 */
function multipleMeasures(apiKey, deviceId, device, messageObj) {
    var updates = [];

    logger.debug('Processing multiple measures for device [%s] with apiKey [%s]', deviceId, apiKey);

    updates = messageObj.reduce(commonBindings.processMeasureGroup.bind(null, device), []);

    async.series(updates, function(error) {
        if (error) {
            logger.error(context, 'Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
        } else {
            logger.debug(context, 'Multiple measures for device [%s] with apiKey [%s] successfully updated',
                deviceId, apiKey);
        }
    });
}

/**
 * Adds a single MQTT measure to the context broker. The message for single measures contains the direct value to
 * be inserted in the attribute, given by its name.
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {String} deviceId         Id of the device to be updated.
 * @param {String} attribute        Name of the attribute to update.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {Buffer} message          Raw message coming from the MQTT client.
 */
function singleMeasure(apiKey, deviceId, attribute, device, message) {
    var values;

    logger.debug('Processing single measure for device [%s] with apiKey [%s]', deviceId, apiKey);

    values = [
        {
            name: attribute,
            type: commonBindings.guessType(attribute, device),
            value: message.toString()
        }
    ];

    iotAgentLib.update(device.name, device.type, '', values, device, function(error) {
        if (error) {
            logger.error(context, 'Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
        } else {
            logger.debug(context, 'Single measure for device [%s] with apiKey [%s] successfully updated',
                deviceId, apiKey);
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
        deviceId = topicInformation[2],
        parsedMessage;

    iotAgentLib.getDevice(deviceId, function(error, device) {
        if (error) {
            logger.error(context, 'Device not found for topic [%s]', topic);
        } else {
            if (topicInformation[4]) {
                singleMeasure(apiKey, deviceId, topicInformation[4], device, message);
            } else {
                parsedMessage = ulParser.parse(message.toString());

                if (parsedMessage && typeof parsedMessage === 'object') {
                    multipleMeasures(apiKey, deviceId, device, parsedMessage);
                } else {
                    logger.error(context, 'Couldn\'t process message [%s] due to format issues.', message);
                }
            }
        }
    });
}

function start(newConfig, callback) {
    var options = {
        keepalive: 0,
        connectTimeout: 60 * 60 * 1000
    };

    if (newConfig) {
        config = newConfig;

        if (config.mqtt && config.mqtt.username && config.mqtt.password) {
            options.username = config.mqtt.username;
            options.password = config.mqtt.password;
        }

        config = newConfig;

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host + ':' + config.mqtt.port, options);
        mqttClient.on('message', mqttMessageHandler);

        mqttClient.on('connect', function() {
            logger.info(context, 'MQTT Client connected');
            recreateSubscriptions(callback);
        });
    } else {
        callback(new errors.ConfigurationError('Missing MQTT configuration'));
    }
}

function stop(callback) {
    logger.info('Stopping IoT Agent');

    async.series([
        unsubscribeAll,
        mqttClient.end.bind(mqttClient, true)
    ], callback);
}

exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.start = start;
exports.stop = stop;
exports.protocol = 'MQTT_UL';
