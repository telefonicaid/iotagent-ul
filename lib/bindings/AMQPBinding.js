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
    context = {
        op: 'IOTAUL.AMQP.Binding'
    };

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
    callback();
}

/**
 * Starts the IoT Agent with the passed configuration. This method also starts the listeners for all the transport
 * binding plugins.
 */
function start(callback) {
    config.getLogger().info(context, 'Starting AQMP binding');

    callback();
}

/**
 * Stops the IoT Agent and all the transport plugins.
 */
function stop(callback) {
    config.getLogger().info('Stopping AMQP Binding');

    callback();
}


exports.commandHandler = commandHandler;
exports.start = start;
exports.stop = stop;
exports.protocol = 'AMQP';
