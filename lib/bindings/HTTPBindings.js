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
    apply = async.apply,
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
    config = require('../configService'),
    context = {
        op: 'IOTAUL.HTTP.Binding'
    },
    transport = 'HTTP';

function handleError(error, req, res) {
    var code = 500;

    config.getLogger().debug(context, 'Error [%s] handing request: %s', error.name, error.message);

    if (error.code && String(error.code).match(/^[2345]\d\d$/)) {
        code = error.code;
    }

    res.status(code).json({
        name: error.name,
        message: error.message
    });
}

function parseData(req, res, next) {
    var data, error, payload;

    if (req.body) {
        payload = req.body;
    } else {
        payload = req.query.d;
    }

    config.getLogger().debug(context, 'Parsing payload [%s]', payload);

    try {
        if (payload) {
            data = ulParser.parse(payload);
        }
    } catch (e) {
        error = e;
    }

    if (error) {
        next(error);
    } else {
        req.ulPayload = data;

        config.getLogger().debug(context, 'Parsed data: [%j]', data);
        next();
    }
}

function addTimestamp(req, res, next) {
    if (req.query.t && req.ulPayload) {
        for (var i = 0; i < req.ulPayload.length; i++) {
            req.ulPayload[i][constants.TIMESTAMP_ATTRIBUTE] = req.query.t;
        }
    }

    next();
}

function checkMandatoryParams(queryPayload) {
    return function(req, res, next) {
        var notFoundParams = [],
            error;

        req.apiKey = req.query.k;
        req.deviceId = req.query.i;

        if (!req.apiKey) {
            notFoundParams.push('API Key');
        }

        if (!req.deviceId) {
            notFoundParams.push('Device Id');
        }

        // CHeck if retrievingParam
        if (queryPayload && !req.query.d && req.query.getCmd !== '1') {
            notFoundParams.push('Payload');
        }

        if (req.method === 'POST' && !req.is('text/plain')) {
            error = new errors.UnsupportedType('text/plain');
        }

        if (notFoundParams.length !== 0) {
            next(new errors.MandatoryParamsNotFound(notFoundParams));
        } else {
            next(error);
        }
    };
}

/**
 * This middleware checks whether there is any polling command pending to be sent to the device. If there is some,
 * add the command information to the return payload. Otherwise it returns an empty payload.
 */
function returnCommands(req, res) {
    function updateCommandStatus(device, commandList) {
        var updates, cleanCommands;

        function createCommandUpdate(command) {
            return apply(
                iotAgentLib.setCommandResult,
                device.name,
                device.resource,
                req.query.k,
                command.name,
                ' ',
                'DELIVERED',
                device
            );
        }

        function cleanCommand(command) {
            return apply(iotAgentLib.removeCommand, device.service, device.subservice, device.id, command.name);
        }

        updates = commandList.map(createCommandUpdate);
        cleanCommands = commandList.map(cleanCommand);

        async.parallel(updates.concat(cleanCommands), function(error) {
            if (error) {
                // prettier-ignore
                config.getLogger().error(
                    context,
                    'Error updating command status after delivering commands for device [%s]',
                    device.id
                );
            } else {
                // prettier-ignore
                config.getLogger().debug(
                    context,
                    'Command status updated successfully after delivering command list to device [%s]',
                    device.id
                );
            }
        });
    }

    function parseCommand(item) {
        return ulParser.createCommandPayload(req.device, item.name, item.value);
    }

    function concatCommand(previous, current) {
        if (previous === '') {
            return current;
        } else {
            return previous + '|' + current;
        }
    }

    if (req.query && req.query.getCmd === '1') {
        iotAgentLib.commandQueue(req.device.service, req.device.subservice, req.deviceId, function(error, list) {
            if (error || !list || list.count === 0) {
                res.status(200).send('');
            } else {
                res.status(200).send(list.commands.map(parseCommand).reduce(concatCommand, ''));

                process.nextTick(updateCommandStatus.bind(null, req.device, list.commands));
            }
        });
    } else {
        res.status(200).send('');
    }
}

function handleIncomingMeasure(req, res, next) {
    var updates = [];

    // prettier-ignore
    config.getLogger().debug('Processing multiple HTTP measures for device [%s] with apiKey [%j]', 
        req.deviceId, req.apiKey);

    function processHTTPWithDevice(device) {
        if (req.ulPayload) {
            updates = req.ulPayload.reduce(commonBindings.processMeasureGroup.bind(null, device, req.apiKey), []);
        }

        async.series(updates, function(error) {
            if (error) {
                next(error);
                // prettier-ignore
                config.getLogger().error(
                    context,
                    /*jshint quotmark: double */
                    "MEASURES-002: Couldn't send the updated values to the Context Broker due to an error: %s",
                    /*jshint quotmark: single */
                    error
                );
            } else {
                // prettier-ignore
                config.getLogger().debug(
                    context,
                    'Multiple measures for device [%s] with apiKey [%s] successfully updated',
                    req.deviceId,
                    req.apiKey
                );

                next();
            }
        });
    }

    function processDeviceMeasure(error, device) {
        if (error) {
            next(error);
        } else {
            var localContext = _.clone(context);

            req.device = device;

            localContext.service = device.service;
            localContext.subservice = device.subservice;

            intoTrans(localContext, processHTTPWithDevice)(device);
        }
    }

    utils.retrieveDevice(req.deviceId, req.apiKey, transport, processDeviceMeasure);
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

    if (config.getConfig().http.timeout) {
        options.timeout = config.getConfig().http.timeout;
    }

    return function sendUlCommandHTTP(callback) {
        var commandObj;

        request(options, function(error, response, body) {
            if (error) {
                callback(new errors.HTTPCommandResponseError('', error, cmdName));
            } else if (response.statusCode !== 200) {
                var errorMsg;

                try {
                    commandObj = ulParser.result(body);
                    errorMsg = commandObj.result;
                } catch (e) {
                    errorMsg = body;
                }

                callback(new errors.HTTPCommandResponseError(response.statusCode, errorMsg, cmdName));
            } else {
                if (apiKey) {
                    commandObj = ulParser.result(body);

                    process.nextTick(
                        utils.updateCommand.bind(
                            null,
                            apiKey,
                            device,
                            commandObj.result,
                            commandObj.command,
                            constants.COMMAND_STATUS_COMPLETED,
                            callback
                        )
                    );
                } else {
                    callback();
                }
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
        async.series(attributes.map(generateCommandExecution.bind(null, apiKey, device)), function(errorAsync) {
            if (errorAsync) {
                // prettier-ignore
                config.getLogger().error(context, 
                    'COMMANDS-004: Error handling incoming command for device [%s]', device.id);

                utils.updateCommand(
                    apiKey,
                    device,
                    errorAsync.message,
                    errorAsync.command,
                    constants.COMMAND_STATUS_ERROR,
                    function(errorUpdateCommand) {
                        if (errorUpdateCommand) {
                            // prettier-ignore
                            config.getLogger().error(
                                context,
                                ' COMMANDS-005: Error updating error information for device [%s]',
                                device.id
                            );
                        }
                    }
                );
            } else {
                config.getLogger().debug('Incoming command for device [%s]', device.id);
            }
        });
    });

    callback();
}

function addDefaultHeader(req, res, next) {
    req.headers['content-type'] = req.headers['content-type'] || 'text/plain';
    next();
}

/**
 * Device provisioning handler. This handler just fills in the transport protocol in case there is none.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceProvisioningHandler(device, callback) {
    if (!device.transport) {
        device.transport = 'HTTP';
    }

    if (device.transport === 'HTTP') {
        if (device.endpoint) {
            device.polling = false;
        } else {
            device.polling = true;
        }
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

    config.getLogger().info(context, 'HTTP Binding listening on port [%s]', config.getConfig().http.port);

    httpBindingServer.app.set('port', config.getConfig().http.port);
    httpBindingServer.app.set('host', config.getConfig().http.host || '0.0.0.0');

    httpBindingServer.router.get(
        config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH,
        checkMandatoryParams(true),
        parseData,
        addTimestamp,
        handleIncomingMeasure,
        returnCommands
    );

    httpBindingServer.router.post(
        config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH,
        addDefaultHeader,
        bodyParser.text(),
        checkMandatoryParams(false),
        parseData,
        addTimestamp,
        handleIncomingMeasure,
        returnCommands
    );

    httpBindingServer.app.use(baseRoot, httpBindingServer.router);
    httpBindingServer.app.use(handleError);

    httpBindingServer.server = http.createServer(httpBindingServer.app);

    httpBindingServer.server.listen(httpBindingServer.app.get('port'), httpBindingServer.app.get('host'), callback);
}

function stop(callback) {
    config.getLogger().info(context, 'Stopping Ultralight HTTP Binding: ');

    if (httpBindingServer) {
        httpBindingServer.server.close(function() {
            config.getLogger().info('HTTP Binding Stopped');
            callback();
        });
    } else {
        callback();
    }
}

function sendPushNotifications(device, values, callback) {
    async.series(values.map(generateCommandExecution.bind(null, null, device)), function(error) {
        callback(error);
    });
}

function storePollNotifications(device, values, callback) {
    function addPollNotification(item, innerCallback) {
        iotAgentLib.addCommand(device.service, device.subservice, device.id, item, innerCallback);
    }

    async.map(values, addPollNotification, callback);
}

function notificationHandler(device, values, callback) {
    if (device.endpoint) {
        sendPushNotifications(device, values, callback);
    } else {
        storePollNotifications(device, values, callback);
    }
}

exports.start = start;
exports.stop = stop;
exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.notificationHandler = notificationHandler;
exports.commandHandler = commandHandler;
exports.protocol = 'HTTP';
