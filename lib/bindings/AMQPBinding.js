/*
 * Copyright 2017 Telefonica Investigación y Desarrollo, S.A.U
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
 * Modified by: Daniel Calvo - ATOS Research & Innovation
 */

/* eslint-disable consistent-return */

const iotAgentLib = require('iotagent-node-lib');
const config = require('../configService');
const constants = require('../constants');
const utils = require('../iotaUtils');
const ulParser = require('../ulParser');
const amqp = require('amqplib/callback_api');
const commons = require('./../commonBindings');
const fillService = iotAgentLib.fillService;
const async = require('async');
let context = {
    op: 'IOTAUL.AMQP.Binding'
};
let amqpConn;
let amqpChannel;

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
    const payload = ulParser.createCommandPayload(device, cmdName, cmdAttributes);
    context = fillService(context, device);
    // prettier-ignore
    config.getLogger().debug(
        context,
        'Sending command execution to device %s with apikey %s and payload %s ',
        apiKey,
        device.id,
        payload
    );

    return function commandExecutor(callback) {
        amqpChannel.assertExchange(config.getConfig().amqp.exchange, 'topic', config.getConfig().amqp.options);
        amqpChannel.publish(
            config.getConfig().amqp.exchange,
            '.' + apiKey + '.' + device.id + '.cmd',
            Buffer.from(payload)
        );
        callback();
    };
}

/**
 * Handles a command execution request coming from the Context Broker. This handler should:
 *  - Identify the device affected by the command.
 *  - Send the command to the appropriate AMQP topic.
 *  - Update the command status in the Context Broker.
 *
 * @param {Object} device           Device data stored in the IOTA.
 * @param {String} attributes       Command attributes (in NGSIv1 format).
 */
function commandHandler(device, attributes, callback) {
    context = fillService(context, device);
    config.getLogger().debug(context, 'Handling AMQP command for device %s', device.id);

    utils.getEffectiveApiKey(device.service, device.subservice, device, function (error, apiKey) {
        async.series(attributes.map(generateCommandExecution.bind(null, apiKey, device)), callback);
    });
}

function queueListener(msg) {
    context = fillService(context, { service: 'n/a', subservice: 'n/a' });
    config.getLogger().debug(context, 'Received %j', msg);
    commons.amqpMessageHandler(msg.fields.routingKey.replace(/\./g, '/'), msg.content.toString());
}

/**
 * Device provisioning handler.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceProvisioningHandler(device, callback) {
    callback(null, device);
}

/**
 * Device updating handler.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceUpdatingHandler(device, callback) {
    callback(null, device);
}

/**
 * Starts the IoT Agent with the passed configuration. This method also starts the listeners for all the transport
 * binding plugins.
 */
function start(callback) {
    let exchange;
    let queue;
    const amqpConfig = config.getConfig().amqp;
    context = fillService(context, { service: 'n/a', subservice: 'n/a' });
    if (!amqpConfig) {
        return config.getLogger().error(context, 'Error AMPQ is not configured');
    }
    if (amqpConfig.disabled) {
        return config.getLogger().warn(context, 'AMPQ is disabled');
    }

    if (amqpConfig.exchange) {
        exchange = amqpConfig.exchange;
    } else {
        exchange = constants.AMQP_DEFAULT_EXCHANGE;
    }

    if (amqpConfig.queue) {
        queue = amqpConfig.queue;
    } else {
        queue = constants.AMQP_DEFAULT_QUEUE;
    }

    let durable;

    if (amqpConfig.options && amqpConfig.options.durable) {
        durable = amqpConfig.options.durable;
    } else {
        durable = constants.AMQP_DEFAULT_DURABLE;
    }

    let retries;
    let retryTime;

    if (amqpConfig.retries) {
        retries = amqpConfig.retries;
    } else {
        retries = constants.AMQP_DEFAULT_RETRIES;
    }
    if (amqpConfig.retrytime) {
        retryTime = amqpConfig.retryTime;
    } else {
        retryTime = constants.AMQP_DEFAULT_RETRY_TIME;
    }

    let uri = 'amqp://';

    if (amqpConfig.username && amqpConfig.password) {
        uri += amqpConfig.username + ':' + amqpConfig.password + '@';
    }
    if (amqpConfig.host) {
        uri += amqpConfig.host;
        if (amqpConfig.port) {
            uri += ':' + amqpConfig.port;
        }
    }

    let isConnecting = false;
    let numRetried = 0;

    config.getLogger().info(context, 'Starting AMQP binding');

    function createConnection(callback) {
        config.getLogger().info(context, 'creating connnection');
        if (isConnecting) {
            return;
        }
        isConnecting = true;
        amqp.connect(uri, function (err, conn) {
            isConnecting = false;
            // try again
            if (err) {
                config.getLogger().error(context, err.message);
                if (numRetried <= retries) {
                    numRetried++;
                    return setTimeout(createConnection, retryTime * 1000, callback);
                }
            } else {
                conn.on('error', function (err) {
                    if (err.message !== 'Connection closing') {
                        config.getLogger().error(context, err.message);
                    }
                });
                conn.on('close', function () {
                    // If amqpConn is null, the connection has been closed on purpose
                    if (amqpConn) {
                        config.getLogger().error(context, 'reconnecting');
                        if (numRetried <= retries) {
                            numRetried++;
                            return setTimeout(createConnection, retryTime * 1000);
                        }
                    }
                });
                config.getLogger().info(context, 'connected');
                amqpConn = conn;
                if (callback) {
                    callback();
                }
            }
        });
    }

    function createChannel(callback) {
        config.getLogger().debug(context, 'channel creating');
        amqpConn.createChannel(function (err, ch) {
            if (err) {
                config.getLogger().error(context, err.message);
            }
            config.getLogger().debug(context, 'channel created');
            amqpChannel = ch;
            callback();
        });
    }

    function assertExchange(callback) {
        if (amqpChannel) {
            config.getLogger().debug(context, 'asserting exchange');
            amqpChannel.assertExchange(exchange, 'topic', { durable });
            config.getLogger().debug(context, 'exchange asserted');
            callback();
        }
    }

    function assertQueue(callback) {
        config.getLogger().debug(context, 'asserting queues');
        amqpChannel.assertQueue(queue, { exclusive: false }, function () {
            amqpChannel.assertQueue(queue + '_commands', { exclusive: false }, callback);
        });
    }

    function createListener(queueObj, callback) {
        config.getLogger().debug(context, 'creating listeners');
        amqpChannel.bindQueue(queue, exchange, '.*.*.attrs.#');
        amqpChannel.consume(queue, queueListener, { noAck: true });
        config.getLogger().debug(context, 'subscribed to attrs queue');

        amqpChannel.bindQueue(queue + '_commands', exchange, '.*.*.cmdexe');
        amqpChannel.consume(queue + '_commands', queueListener, { noAck: true });
        config.getLogger().debug(context, 'subscribed to command queue');
        callback();
    }

    async.waterfall([createConnection, createChannel, assertExchange, assertQueue, createListener], function (error) {
        if (error) {
            config.getLogger().debug('AMQP error %j', error);
        }
        callback();
    });
}

/**
 * Stops the IoT Agent and all the transport plugins.
 */
function stop(callback) {
    config.getLogger().info(context, 'Stopping AMQP Binding');
    if (amqpConn) {
        amqpConn.close();
        amqpConn = null;
    }
    callback();
}

exports.commandHandler = commandHandler;
exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.deviceUpdatingHandler = deviceUpdatingHandler;
exports.start = start;
exports.stop = stop;
exports.protocol = 'AMQP';
