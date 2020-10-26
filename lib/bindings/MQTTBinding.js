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

/* eslint-disable consistent-return */

const fs = require('fs');
const iotAgentLib = require('iotagent-node-lib');
const commonBindings = require('./../commonBindings');
const utils = require('../iotaUtils');
const ulParser = require('../ulParser');
const mqtt = require('mqtt');
const async = require('async');
const constants = require('../constants');
const context = {
    op: 'IOTAUL.MQTT.Binding'
};
let mqttClient;
let mqttConn;
const config = require('../configService');

/**
 * Generate the list of global topics to listen to.
 */
function generateTopics(callback) {
    const topics = [];

    config.getLogger().debug(context, 'Generating topics');

    // With leading slashes
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '/+/+/' + constants.MEASURES_SUFIX + '/+');
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '/' +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.MEASURES_SUFIX +
            '/+'
    );
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '/+/+/' + constants.MEASURES_SUFIX);
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '/' +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.MEASURES_SUFIX
    );
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '/+/+/' +
            constants.CONFIGURATION_SUFIX +
            '/' +
            constants.CONFIGURATION_COMMAND_SUFIX
    );
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '/' +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.CONFIGURATION_SUFIX +
            '/' +
            constants.CONFIGURATION_COMMAND_SUFIX
    );
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '/+/+/' + constants.CONFIGURATION_COMMAND_UPDATE);
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '/' +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.CONFIGURATION_COMMAND_UPDATE
    );

    //Without leading slashes
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '+/+/' + constants.MEASURES_SUFIX + '/+');
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.MEASURES_SUFIX +
            '/+'
    );
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '+/+/' + constants.MEASURES_SUFIX);
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP + constants.MQTT_TOPIC_PROTOCOL + '/+/+/' + constants.MEASURES_SUFIX
    );
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '+/+/' +
            constants.CONFIGURATION_SUFIX +
            '/' +
            constants.CONFIGURATION_COMMAND_SUFIX
    );
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.CONFIGURATION_SUFIX +
            '/' +
            constants.CONFIGURATION_COMMAND_SUFIX
    );
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '+/+/' + constants.CONFIGURATION_COMMAND_UPDATE);
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.CONFIGURATION_COMMAND_UPDATE
    );

    callback(null, topics);
}

/**
 * Recreate the MQTT subscriptions.
 */
function recreateSubscriptions(callback) {
    config.getLogger().debug(context, 'Recreating global subscriptions');

    function subscribeToTopics(topics, callback) {
        config.getLogger().debug('Subscribing to topics: %j', topics);

        mqttClient.subscribe(topics, null, function (error) {
            if (error) {
                iotAgentLib.alarms.raise(constants.MQTTB_ALARM, error);
                config.getLogger().error(context, ' GLOBAL-001: Error subscribing to topics: %s', error);
                callback(error);
            } else {
                iotAgentLib.alarms.release(constants.MQTTB_ALARM);
                config.getLogger().debug('Successfully subscribed to the following topics:\n%j\n', topics);
                if (callback) {
                    callback(null);
                }
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
    const cmdName = attribute.name;
    const cmdAttributes = attribute.value;
    const options = {};
    const payload = ulParser.createCommandPayload(device, cmdName, cmdAttributes);
    var commands = Object.assign({}, ...device.commands.map((c) => ({ [c.name]: c })));

    options.qos =
        commands[cmdName].mqtt && commands[cmdName].mqtt.qos
            ? commands[cmdName].mqtt.qos
            : config.getConfig().mqtt.qos
            ? parseInt(config.getConfig().mqtt.qos)
            : 0;
    options.retain =
        commands[cmdName].mqtt && commands[cmdName].mqtt.retain
            ? commands[cmdName].mqtt.retain
            : config.getConfig().mqtt.retain
            ? config.getConfig().mqtt.retain
            : false;

    // prettier-ignore
    config.getLogger().info(
        context,
        'Sending command execution to device [%s] with apikey [%s] and payload [%s] ',
        device.id,
        apiKey,
        payload
    );
    const commandTopic = '/' + apiKey + '/' + device.id + '/cmd';
    return mqttClient.publish.bind(mqttClient, commandTopic, payload, options);
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

    utils.getEffectiveApiKey(device.service, device.subservice, device, function (error, apiKey) {
        async.series(attributes.map(generateCommandExecution.bind(null, apiKey, device)), callback);
    });
}

/**
 * Extract all the information from a Context Broker response and send it to the topic indicated by the APIKey and
 * DeviceId.
 *
 * @param {String} apiKey           API Key for the Device Group
 * @param {String} deviceId         ID of the Device.
 * @param {Object} results          Context Broker response.
 */
function sendConfigurationToDevice(apiKey, deviceId, results, callback) {
    const configurations = utils.createConfigurationNotification(results);
    const options = {};

    if (config.getConfig().mqtt.qos) {
        options.qos = parseInt(config.getConfig().mqtt.qos) || 0;
    }

    if (config.getConfig().mqtt.retain === true) {
        options.retain = config.getConfig().mqtt.retain;
    }

    const payload = ulParser.createConfigurationPayload(deviceId, configurations);
    config
        .getLogger()
        .debug(
            context,
            'Sending requested configuration to device [%s] with apikey [%s] and payload [%s] ',
            deviceId,
            apiKey,
            payload
        );
    const leadingSlash = config.getConfig().mqtt.avoidLeadingSlash ? '' : '/';
    const commandTopic =
        leadingSlash +
        apiKey +
        '/' +
        deviceId +
        '/' +
        constants.CONFIGURATION_SUFIX +
        '/' +
        constants.CONFIGURATION_VALUES_SUFIX;
    mqttClient.publish(commandTopic, payload, options);
    config.getLogger().info(context, 'Configuration:\n %j was sent to the device %s', payload, commandTopic);
    callback();
}

/**
 * Starts the IoT Agent with the passed configuration. This method also starts the listeners for all the transport
 * binding plugins.
 */
function start(callback) {
    const mqttConfig = config.getConfig().mqtt;
    if (!mqttConfig) {
        return config.getLogger().error(context, 'Error MQTT is not configured');
    }

    const rejectUnauthorized =
        typeof mqttConfig.rejectUnauthorized === 'boolean' ? mqttConfig.rejectUnauthorized : true;
    const options = {
        protocol: mqttConfig.protocol ? mqttConfig.protocol : 'mqtt',
        host: mqttConfig.host ? mqttConfig.host : 'localhost',
        port: mqttConfig.port ? mqttConfig.port : 1883,
        key: mqttConfig.key ? fs.readFileSync(mqttConfig.key, 'utf8') : null,
        ca: mqttConfig.ca ? fs.readFileSync(mqttConfig.ca, 'utf8') : null,
        cert: mqttConfig.cert ? fs.readFileSync(mqttConfig.cert, 'utf8') : null,
        rejectUnauthorized,
        username: mqttConfig.username ? mqttConfig.username : null,
        password: mqttConfig.password ? mqttConfig.password : null,
        keepalive: mqttConfig.keepalive ? parseInt(mqttConfig.keepalive) : 0,
        connectTimeout: 60 * 60 * 1000
    };

    const retries = mqttConfig.retries ? mqttConfig.retries : constants.MQTT_DEFAULT_RETRIES;
    const retryTime = mqttConfig.retryTime ? mqttConfig.retryTime : constants.MQTT_DEFAULT_RETRY_TIME;
    let isConnecting = false;
    let numRetried = 0;
    config.getLogger().info(context, 'Starting MQTT binding');

    function createConnection(callback) {
        config.getLogger().info(context, 'creating connection');
        if (isConnecting) {
            return;
        }
        isConnecting = true;
        mqttClient = mqtt.connect(options.protocol + '://' + mqttConfig.host + ':' + mqttConfig.port, options);
        isConnecting = false;
        // TDB: check if error
        if (!mqttClient) {
            config.getLogger().error(context, 'error mqttClient not created');
            if (numRetried <= retries) {
                numRetried++;
                return setTimeout(createConnection, retryTime * 1000, callback);
            }
        }
        mqttClient.on('error', function (e) {
            /*jshint quotmark: double */
            config.getLogger().fatal("GLOBAL-002: Couldn't connect with MQTT broker: %j", e);
            /*jshint quotmark: single */
            if (callback) {
                callback(e);
            }
        });
        mqttClient.on('message', commonBindings.mqttMessageHandler);
        /* eslint-disable-next-line no-unused-vars */
        mqttClient.on('connect', function (ack) {
            config.getLogger().info(context, 'MQTT Client connected');
            recreateSubscriptions();
        });
        mqttClient.on('close', function () {
            // If mqttConn is null, the connection has been closed on purpose
            if (mqttConn) {
                if (numRetried <= retries) {
                    config.getLogger().warn(context, 'reconnecting...');
                    numRetried++;
                    return setTimeout(createConnection, retryTime * 1000);
                }
            } else {
                // Do Nothing
            }
        });

        config.getLogger().info(context, 'connected');
        mqttConn = mqttClient;
        if (callback) {
            callback();
        }
    } // function createConnection

    async.waterfall([createConnection], function (error) {
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

    async.series([unsubscribeAll, mqttClient.end.bind(mqttClient, true)], function () {
        config.getLogger().info('MQTT Binding Stopped');
        if (mqttConn) {
            mqttConn = null;
        }
        callback();
    });
}

exports.sendConfigurationToDevice = sendConfigurationToDevice;
exports.commandHandler = commandHandler;
exports.start = start;
exports.stop = stop;
exports.protocol = 'MQTT';
