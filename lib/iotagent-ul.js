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
    logger = require('logops'),
    async = require('async'),
    fs = require('fs'),
    path = require('path'),
    context = {
        op: 'IoTA-UL20.Agent'
    },
    config,
    transportBindings = [];

/**
 * Start all the transport protocol bindings found in the bindings directory.
 *
 * @param {Object} newConfig        Configuration object to start the bindings
 */
function startTransportBindings(newConfig, callback) {
    function invokeBinding(binding, callback) {
        binding.start(newConfig, callback);
    }

    var bindings = fs.readdirSync(path.join(__dirname, './bindings'));

    transportBindings = bindings.map(function(item) {
        return require('./bindings/' + item);
    });

    async.map(transportBindings, invokeBinding, callback);
}

/**
 * Stop all the transport protocol bindings of the agent.
 */
function stopTransportBindings(callback) {
    function invokeBinding(binding, callback) {
        binding.stop(callback);
    }

    async.map(transportBindings, invokeBinding, callback);
}

function applyFunctionFromBinding(argument, functionName, callback) {
    function addHandler(current, binding) {
        current.push(binding[functionName].bind(binding, argument));

        return current;
    }

    async.series(transportBindings.reduce(addHandler, []), callback);
}

function deviceProvisioningHandler(device, callback) {
    applyFunctionFromBinding(device, 'deviceProvisioningHandler', callback);
}

function configurationHandler(configuration, callback) {
    applyFunctionFromBinding(configuration, 'configurationHandler', callback);
}

/**
 * Starts the IOTA with the given configuration.
 *
 * @param {Object} newConfig        New configuration object.
 */
function start(newConfig, callback) {
    var options = {
        keepalive: 0,
        connectTimeout: 60 * 60 * 1000
    };

    config = newConfig;

    if (config.mqtt.username && config.mqtt.password) {
        options.username = config.mqtt.username;
        options.password = config.mqtt.password;
    }

    iotAgentLib.activate(config.iota, function(error) {
        if (error) {
            callback(error);
        } else {
            logger.info(context, 'IoT Agent services activated');

            iotAgentLib.setProvisioningHandler(deviceProvisioningHandler);
            iotAgentLib.setConfigurationHandler(configurationHandler);
            iotAgentLib.addUpdateMiddleware(iotAgentLib.dataPlugins.attributeAlias.update);

            startTransportBindings(newConfig, callback);
        }
    });
}

/**
 * Stops the current IoT Agent.
 *
 */
function stop(callback) {
    logger.info(context, 'Stopping IoT Agent');
    async.series([
        stopTransportBindings,
        iotAgentLib.resetMiddlewares,
        iotAgentLib.deactivate
    ], callback);
}

exports.start = start;
exports.stop = stop;
