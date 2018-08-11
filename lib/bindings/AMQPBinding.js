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
 */

'use strict';

var config = require('../configService'),
    constants = require('../constants'),
    utils = require('../iotaUtils'),
    ulParser = require('../ulParser'),
    amqp = require('amqplib/callback_api'),
    commons = require('./../commonBindings'),
    async = require('async'),
    context = {
        op: 'IOTAUL.AMQP.Binding'
    },
    offlinePubQueue = [],
    amqpConn,
    amqpChannel;

function closeOnErr(err) {
  if (!err) {
    return false;
  }
  config.getLogger().error(context, err);
  amqpConn.close();
  return true;
}

// method to publish a message, will queue messages internally if the connection is down and resend later
function publish(exchange, routingKey, content) {
  try {
    amqpChannel.assertExchange(config.getConfig().amqp.exchange, 'topic', config.getConfig().amqp.options);
    amqpChannel.publish(exchange, routingKey, content, { persistent: true },
                       function(err, ok) {
                         if (err) {
                           config.getLogger().error(err);
                           offlinePubQueue.push([exchange, routingKey, content]);
                           amqpChannel.connection.close();
                         }
                       });
  } catch (e) {
    config.getLogger().error(context, e.message);
    offlinePubQueue.push([exchange, routingKey, content]);
  }
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

    config.getLogger().debug(context, 'Sending command execution to device [%s] with apikey [%s] and payload [%s] ',
        apiKey, device.id, payload);

    return function commandExecutor(callback) {
        publish(config.getConfig().amqp.exchange, '.' + apiKey + '.' + device.id + '.cmd', new Buffer(payload));
        callback();
    };
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
    config.getLogger().debug(context, 'Handling AQMP command for device [%s]', device.id);

    utils.getEffectiveApiKey(device.service, device.subservice, function(error, apiKey) {
        async.series(attributes.map(generateCommandExecution.bind(null, apiKey, device)), callback);
    });
}

function queueListener(msg) {
    config.getLogger().debug(context, 'Received [%j]', msg);
    commons.amqpMessageHandler(msg.fields.routingKey.replace(/\./g, '/'), msg.content.toString());
}

/**
 * Starts the IoT Agent with the passed configuration. This method also starts the listeners for all the transport
 * binding plugins.
 */
function start(callback) {
    var exchange,
        queue,
        host,
        port,
        connectionString;

    if (config.getConfig() && config.getConfig().amqp && config.getConfig().amqp.exchange) {
        exchange = config.getConfig().amqp.exchange;
    } else {
        exchange = constants.AMQP_DEFAULT_EXCHANGE;
    }

    if (config.getConfig() && config.getConfig().amqp && config.getConfig().amqp.queue) {
        queue = config.getConfig().amqp.queue;
    } else {
        queue = constants.AMQP_DEFAULT_QUEUE;
    }

    if (config.getConfig() && config.getConfig().amqp && config.getConfig().amqp.host) {
        host = config.getConfig().amqp.host;
    } else {
        host = 'localhost';
    }

    if (config.getConfig() && config.getConfig().amqp && config.getConfig().amqp.port) {
        port = config.getConfig().amqp.port;
    } else {
        port = 5672;
    }

    connectionString = 'amqp://';

    if (config.getConfig() && config.getConfig().amqp && config.getConfig().amqp.username) {
        connectionString = connectionString + config.getConfig().amqp.username;
        if (config.getConfig() && config.getConfig().amqp && config.getConfig().amqp.password) {
          connectionString = connectionString + ':' + config.getConfig().amqp.password;
        }
        connectionString = connectionString + '@';
    }

    connectionString = connectionString + host + ':' + port;

    if (config.getConfig() && config.getConfig().amqp && config.getConfig().amqp.vhost) {
        connectionString = connectionString + config.getConfig().amqp.vhost;
    }

    config.getLogger().info(context, 'AQMP configuration: ' + connectionString);

    config.getLogger().info(context, 'Starting AQMP binding');

    var isConnecting = false;

    function startPublisher() {
      amqpConn.createConfirmChannel(function(err, ch) {
        if (closeOnErr(err)) {
          return;
        }
        ch.on('error', function(err) {
          config.getLogger().error(context,'channel error: '+ err.message);
        });
        ch.on('close', function() {
          config.getLogger().info(context,'channel closed');
        });

        amqpChannel = ch;
        while (true) {
          var m = offlinePubQueue.shift();
          if (!m) {
            break;
          }
          publish(m[0], m[1], m[2]);
        }
      });
    }

    // A worker that acks messages only if processed succesfully
    function startWorkerUpdates() {
      amqpConn.createChannel(function(err, ch) {
        if (closeOnErr(err)) {
          return;
        }
        ch.on('error', function(err) {
          config.getLogger().error(context, 'channel error: '+ err.message);
        });
        ch.on('close', function() {
          config.getLogger().info(context, 'channel closed');
        });
        //ch.prefetch(10);
        ch.assertExchange(exchange, 'topic', {});
        ch.assertQueue(queue, {exclusive: false}, function(err, _ok) {
          if (closeOnErr(err)) {
            return;
          }
          amqpChannel.bindQueue(queue, exchange, '.*.*.attrs.#');
          amqpChannel.consume(queue, queueListener, {noAck: true});
          config.getLogger().debug(context, 'subscribed to updates queue');
        });
      });
    }

    // A worker that acks messages only if processed succesfully
    function startWorkerCommands() {
      amqpConn.createChannel(function(err, ch) {
        if (closeOnErr(err)) {
          return;
        }
        ch.on('error', function(err) {
          config.getLogger().error(context, 'channel error: '+ err.message);
        });
        ch.on('close', function() {
          config.getLogger().info(context, 'channel closed');
        });
        //ch.prefetch(10);
        ch.assertExchange(exchange, 'topic', {});
        ch.assertQueue(queue + '_commands', {exclusive: false}, function(err, _ok) {
          if (closeOnErr(err)) {
            return;
          }
          amqpChannel.bindQueue(queue + '_commands', exchange, '.*.*.cmdexe');
          amqpChannel.consume(queue + '_commands', queueListener, {noAck: true});
          config.getLogger().debug(context, 'subscribed to command queue');
        });

      });
    }

    function whenConnected() {
      startPublisher();
      startWorkerUpdates();
      startWorkerCommands();
    }

    function createConnection() {
        if (isConnecting) {
          return;
        }
        isConnecting = true;
        amqp.connect(connectionString + '?heartbeat=60', function(err, conn) {
          isConnecting = false;
          if (err) {
            config.getLogger().error(context, err.message);
            return setTimeout(createConnection, 1000);
          }
          conn.on('error', function(err) {
            if (err.message !== 'Connection closing') {
              config.getLogger().error(context, err.message);
            }
          });
          conn.on('close', function() {
            config.getLogger().error(context, 'reconnecting');
            return setTimeout(createConnection, 1000);
          });

          config.getLogger().info(context, 'connected');
          amqpConn = conn;

          whenConnected();
        });
    }

    async.waterfall([
        createConnection
    ], function(error) {
        callback();
    });
}

/**
 * Stops the IoT Agent and all the transport plugins.
 */
function stop(callback) {
    config.getLogger().info(context, 'Stopping AMQP Binding');
    amqpConn.close();
    callback();
}


exports.commandHandler = commandHandler;
exports.start = start;
exports.stop = stop;
exports.protocol = 'AMQP';
