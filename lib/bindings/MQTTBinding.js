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
    utils = require('../iotaUtils'),
    ulParser = require('../ulParser'),
    mqtt = require('mqtt'),
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

    config.getLogger().debug(context, 'Generating topics');
    topics.push('/+/+/' + constants.MEASURES_SUFIX + '/+');
    topics.push('/+/+/' + constants.MEASURES_SUFIX);
    topics.push('/+/+/' + constants.CONFIGURATION_COMMAND_SUFIX);

    callback(null, topics);
}

/**
 * Recreate the MQTT subscriptions.
 */
function recreateSubscriptions(callback) {
    config.getLogger().debug(context, 'Recreating global subscriptions');

    function subscribeToTopics(topics, callback) {
        config.getLogger().debug('Subscribing to topics: %j', topics);

        mqttClient.subscribe(topics, null, function(error) {
            if (error) {
                iotAgentLib.alarms.raise(constants.MQTTB_ALARM, error);
                config.getLogger().error(context, ' GLOBAL-001: Error subscribing to topics: %s', error);
                callback(error);
            } else {
                iotAgentLib.alarms.release(constants.MQTTB_ALARM);
                config.getLogger().debug('Successfully subscribed to the following topics:\n%j\n', topics);
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
    var options = {};
    payload = ulParser.createCommandPayload(device, cmdName, cmdAttributes);
    if (config.getConfig().mqtt.qos) {
        options.qos = config.getConfig().mqtt.qos;
    }
    if (config.getConfig().mqtt.retain === true) {
        options.retain = config.getConfig().mqtt.retain;
    }
    config.getLogger().debug(context, 'Sending command execution to device [%s] with apikey [%s] and payload [%s] ',
        apiKey, device.id, payload);

    return mqttClient.publish.bind(mqttClient, '/' + apiKey + '/' + device.id + '/cmd', payload, options);
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
    config.getLogger().debug(context, 'Handling MQTT command for device [%s]', device.id);

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

    config.getLogger().info(context, 'Starting MQTT binding');

    if (config.getConfig().mqtt && config.getConfig().mqtt.username && config.getConfig().mqtt.password) {
        options.username = config.getConfig().mqtt.username;
        options.password = config.getConfig().mqtt.password;
    }

    mqttClient = mqtt.connect('mqtt://' + config.getConfig().mqtt.host + ':' + config.getConfig().mqtt.port, options);
    mqttClient.on('error', function(e) {
        config.getLogger().fatal('GLOBAL-002: Couldn\'t connect with MQTT broker: %j', e);
        callback(e);
    });

    // customized by Nobuyuki Matsui
    // execute mqttExtensions.execute before calling 'commonBindings.messageHandler' when receiving mqtt message
    // originaru => mqttClient.on('message', commonBindings.messageHandler);
    if (config.getConfig().mqtt &&
        config.getConfig().mqtt.extensions &&
        Array.isArray(config.getConfig().mqtt.extensions)) {
        var mqttExtensions = require('../extensions/mqtt-extensions');
        mqttClient.on('message', mqttExtensions.execute(commonBindings.messageHandler));
    } else {
        mqttClient.on('message', commonBindings.messageHandler);
    }

    mqttClient.on('connect', function() {
        config.getLogger().info(context, 'MQTT Client connected');
        recreateSubscriptions(callback);
    });
}

/**
 * Stops the IoT Agent and all the transport plugins.
 */
function stop(callback) {
    config.getLogger().info('Stopping MQTT Binding');

    async.series([
        unsubscribeAll,
        mqttClient.end.bind(mqttClient, true)
    ], function() {
        config.getLogger().info('MQTT Binding Stopped');
        callback();
    });
}

exports.commandHandler = commandHandler;
exports.start = start;
exports.stop = stop;
exports.protocol = 'MQTT';
