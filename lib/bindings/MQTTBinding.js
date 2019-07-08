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
    mqttConn,
    config = require('../configService');

/**
 * Generate the list of global topics to listen to.
 */
function generateTopics(callback) {
    var topics = [];

    config.getLogger().debug(context, 'Generating topics');
    topics.push('/+/+/' + constants.MEASURES_SUFIX + '/+');
    topics.push('/+/+/' + constants.MEASURES_SUFIX);
    // FIXME: there is no way to send configuration command to device, still no implemented.
    //topics.push('/+/+/' + constants.CONFIGURATION_SUFIX + '/' + constants.CONFIGURATION_COMMAND_SUFIX);
    topics.push('/+/+/' + constants.CONFIGURATION_COMMAND_UPDATE);

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

    async.waterfall([generateTopics, subscribeToTopics], callback);
}

/**
 * Unsubscribe the MQTT Client for all the topics of all the devices of all the services.
 */
function unsubscribeAll(callback) {
    function unsubscribeFromTopics(topics, callback) {
        mqttClient.unsubscribe(topics, null);

        callback();
    }

    async.waterfall([generateTopics, unsubscribeFromTopics], callback);
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
        options.qos = parseInt(config.getConfig().mqtt.qos) || 0;
    }
    if (config.getConfig().mqtt.retain === true) {
        options.retain = config.getConfig().mqtt.retain;
    }
    // prettier-ignore
    config.getLogger().debug(
        context,
        'Sending command execution to device [%s] with apikey [%s] and payload [%s] ',
        apiKey,
        device.id,
        payload
    );

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
    if (config.getConfig().mqtt.keepalive) {
        options.keepalive = parseInt(config.getConfig().mqtt.keepalive) || 0;
    }
    var retries, retryTime;

    if (config.getConfig() && config.getConfig().mqtt && config.getConfig().mqtt.retries) {
        retries = config.getConfig().mqtt.retries;
    } else {
        retries = constants.MQTT_DEFAULT_RETRIES;
    }
    if (config.getConfig() && config.getConfig().mqtt && config.getConfig().mqtt.retrytime) {
        retryTime = config.getConfig().mqtt.retryTime;
    } else {
        retryTime = constants.MQTT_DEFAULT_RETRY_TIME;
    }
    var isConnecting = false;
    var numRetried = 0;
    config.getLogger().info(context, 'Starting MQTT binding');

    function createConnection(callback) {
        config.getLogger().info(context, 'creating connnection');
        if (isConnecting) {
            return;
        }
        isConnecting = true;
        mqttClient = mqtt.connect(
            'mqtt://' + config.getConfig().mqtt.host + ':' + config.getConfig().mqtt.port,
            options
        );
        // TDB: check if error
        if (!mqttClient) {
            config.getLogger().error(context, 'error');
            if (numRetried <= retries) {
                numRetried++;
                return setTimeout(createConnection, retryTime * 1000, callback);
            }
        }
        isConnecting = false;
        mqttClient.on('error', function(e) {
            /*jshint quotmark: double */
            config.getLogger().fatal("GLOBAL-002: Couldn't connect with MQTT broker: %j", e);
            /*jshint quotmark: single */
            callback(e);
        });
        mqttClient.on('message', commonBindings.mqttMessageHandler);
        mqttClient.on('connect', function(ack) {
            config.getLogger().info(context, 'MQTT Client connected');
            recreateSubscriptions(callback);
        });
        mqttClient.on('close', function() {
            // If mqttConn is null, the connection has been closed on purpose
            if (mqttConn) {
                config.getLogger().error(context, 'reconnecting');
                if (numRetried <= retries) {
                    numRetried++;
                    return setTimeout(createConnection, retryTime * 1000);
                }
            } else {
                return;
            }
        });

        config.getLogger().info(context, 'connected');
        mqttConn = mqttClient;
        if (callback) {
            callback();
        }
    }

    async.waterfall([createConnection], function(error) {
        if (error) {
            config.getLogger().debug('MQTT error %j', error);
        }
        callback();
    });
}


/**
 * Stops the IoT Agent and all the transport plugins.
 */
function stop(callback) {
    config.getLogger().info('Stopping MQTT Binding');

    async.series([unsubscribeAll, mqttClient.end.bind(mqttClient, true)], function() {
        config.getLogger().info('MQTT Binding Stopped');
        if (mqttConn) {
            mqttConn = null;
        }
        callback();
    });
}

exports.commandHandler = commandHandler;
exports.start = start;
exports.stop = stop;
exports.protocol = 'MQTT';
