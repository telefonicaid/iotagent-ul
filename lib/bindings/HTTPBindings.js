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

var http = require('http'),
    async = require('async'),
    iotAgentLib = require('iotagent-node-lib'),
    _ = require('underscore'),
    intoTrans = iotAgentLib.intoTrans,
    express = require('express'),
    utils = require('../iotaUtils'),
    bodyParser = require('body-parser'),
    constants = require('../constants'),
    commonBindings = require('./../commonBindings'),
    errors = require('../errors'),
    ulParser = require('../ulParser'),
    httpBindingServer,
    request = require('request'),
    logger = require('logops'),
    config = require('../configService'),
    context = {
        op: 'IOTAUL.HTTP.Binding'
    };

function handleError(error, req, res, next) {
    var code = 500;

    logger.debug(context, 'Error [%s] handing request: %s', error.name, error.message);

    if (error.code && String(error.code).match(/^[2345]\d\d$/)) {
        code = error.code;
    }

    res.status(code).json({
        name: error.name,
        message: error.message
    });
}

function parseData(req, res, next) {
    var data,
        error,
        payload;

    if (req.body) {
        payload = req.body;
    } else {
        payload = req.query.d;
    }

    try {
        data = ulParser.parse(payload);
    } catch (e) {
        error = e;
    }

    if (error) {
        next(error);
    } else {
        req.ulPayload = data;
        next();
    }
}

function checkMandatoryParams(queryPayload) {
    return function(req, res, next) {
        var notFoundParams = [];

        req.apiKey = req.query.k;
        req.deviceId = req.query.i;

        if (!req.apiKey) {
            notFoundParams.push('API Key');
        }

        if (!req.deviceId) {
            notFoundParams.push('Device Id');
        }

        if (queryPayload && !req.query.d) {
            notFoundParams.push('Payload');
        }

        if (notFoundParams.length !== 0) {
            next(new errors.MandatoryParamsNotFound(notFoundParams));
        } else {
            next();
        }
    };
}

function handleIncomingMeasure(req, res, next) {
    var updates = [];

    logger.debug('Processing multiple HTTP measures for device [%s] with apiKey [%s]', req.deviceId, req.apiKey);

    function processHTTPWithDevice(device) {
        updates = req.ulPayload.reduce(commonBindings.processMeasureGroup.bind(null, device), []);

        async.series(updates, function(error) {
            if (error) {
                next(error);
                logger.error(context,
                    'Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
            } else {
                logger.debug(context,
                    'Multiple measures for device [%s] with apiKey [%s] successfully updated',
                    req.deviceId, req.apiKey);
                res.status(200).send('');
            }
        });
    }

    iotAgentLib.getDevice(req.deviceId, function(error, device) {
        if (error) {
            next(error);
        } else {
            var localContext = _.clone(context);

            localContext.service = device.service;
            localContext.subservice = device.subservice;

            intoTrans(localContext, processHTTPWithDevice)(device);
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
function updateCommand(apiKey, device, message, callback) {
    var commandObj = ulParser.result(message);

    iotAgentLib.setCommandResult(
        device.name,
        '',
        apiKey,
        commandObj.command,
        commandObj.result,
        constants.COMMAND_STATUS_COMPLETED,
        device,
        function(error) {
            if (error) {
                logger.error(context,
                    'Couldn\'t update command status in the Context broker for device [%s] with apiKey [%s]: %s',
                    device.id, device.apiKey, error);

                callback(error);
            } else {
                logger.debug(context, 'Single measure for device [%s] with apiKey [%s] successfully updated',
                    device.id, device.apiKey);

                callback();
            }
        });
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
        options;

    options = {
        url: device.endpoint,
        method: 'POST',
        body: ulParser.createCommandPayload(device, cmdName, cmdAttributes),
        headers: {
            'fiware-service': device.service,
            'fiware-servicepath': device.subservice
        }
    };

    return function sendUlCommandHTTP(callback) {
        request(options, function(error, response, body) {
            if (error || response.statusCode !== 200) {
                callback(new errors.HTTPCommandResponseError(response.statusCode, error));
            } else {
                process.nextTick(updateCommand.bind(null, apiKey, device, body, callback));
            }
        });
    };
}

/**
 * Handles a command execution request coming from the Context Broker. This handler should:
 *  - Identify the device affected by the command.
 *  - Send the command to the HTTP endpoint of the device.
 *  - Update the command status in the Context Broker while pending.
 *  - Update the command status when the result from the device is received.
 *
 * @param {Object} device           Device data stored in the IOTA.
 * @param {String} attributes       Command attributes (in NGSIv1 format).
 */
function commandHandler(device, attributes, callback) {
    utils.getEffectiveApiKey(device.service, device.subservice, function(error, apiKey) {
        async.series(attributes.map(generateCommandExecution.bind(null, apiKey, device)), function(error) {
            if (error) {
                logger.error('Error handling incoming command for device [%s]', device.id);
            } else {
                logger.debug('Incoming command for device [%s]', device.id);
            }
        });
    });

    callback();
}

/**
 * Device provisioning handler. This handler just fills in the transport protocol in case there is none.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceProvisioningHandler(device, callback) {
    if (!device.transport && device.endpoint) {
        device.transport = 'HTTP';
    }

    callback(null, device);
}

function start(callback) {
    var baseRoot = '/';

    httpBindingServer = {
        server: null,
        app: express(),
        router: express.Router()
    };

    logger.info(context, 'HTTP Binding listening on port [%s]', config.getConfig().http.port);

    httpBindingServer.app.set('port', config.getConfig().http.port);
    httpBindingServer.app.set('host', config.getConfig().http.host || '0.0.0.0');

    httpBindingServer.router.get(
        constants.HTTP_MEASURE_PATH, checkMandatoryParams(true), parseData, handleIncomingMeasure);

    httpBindingServer.router.post(
        constants.HTTP_MEASURE_PATH,
        bodyParser.text(),
        checkMandatoryParams(false),
        parseData,
        handleIncomingMeasure);

    httpBindingServer.app.use(baseRoot, httpBindingServer.router);
    httpBindingServer.app.use(handleError);

    httpBindingServer.server = http.createServer(httpBindingServer.app);

    httpBindingServer.server.listen(httpBindingServer.app.get('port'), httpBindingServer.app.get('host'), callback);
}

function stop(callback) {
    logger.info(context, 'Stopping Ultralight HTTP Binding: ');

    if (httpBindingServer) {
        httpBindingServer.server.close(function() {
            logger.info('HTTP Binding Stopped');
            callback();
        });
    } else {
        callback();
    }
}

exports.start = start;
exports.stop = stop;
exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.commandHandler = commandHandler;
exports.protocol = 'HTTP';
