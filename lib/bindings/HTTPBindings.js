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

const fs = require('fs');
const http = require('http');
const https = require('https');
const async = require('async');
const apply = async.apply;
const iotAgentLib = require('iotagent-node-lib');
const regenerateTransid = iotAgentLib.regenerateTransid;
const finishSouthBoundTransaction = iotAgentLib.finishSouthBoundTransaction;
const fillService = iotAgentLib.fillService;
const _ = require('underscore');
const intoTrans = iotAgentLib.intoTrans;
const express = require('express');
const utils = require('../iotaUtils');
const bodyParser = require('body-parser');
const constants = require('../constants');
const commonBindings = require('./../commonBindings');
const errors = require('../errors');
const ulParser = require('../ulParser');
let httpBindingServer;
const request = iotAgentLib.request;
const config = require('../configService');
let context = {
    op: 'IOTAUL.HTTP.Binding'
};

/* eslint-disable-next-line no-unused-vars */
function handleError(error, req, res, next) {
    let code = 500;
    context = fillService(context, { service: 'n/a', subservice: 'n/a' });
    config.getLogger().debug(context, 'Error %s handing request: %s', error.name, error.message);

    if (error.code && String(error.code).match(/^[2345]\d\d$/)) {
        code = error.code;
    }

    res.status(code).json({
        name: error.name,
        message: error.message
    });
}

function parseData(req, res, next) {
    let data;
    let error;
    let payload;
    context = fillService(context, { service: 'n/a', subservice: 'n/a' });
    if (req.body) {
        payload = req.body;
    } else {
        payload = req.query.d;
    }
    regenerateTransid(payload);
    config.getLogger().debug(context, 'Parsing payload %s', payload);

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

        config.getLogger().debug(context, 'Parsed data: %j', data);
        next();
    }
}

function addTimestamp(req, res, next) {
    if (req.query.t && req.ulPayload) {
        for (let i = 0; i < req.ulPayload.length; i++) {
            req.ulPayload[i][constants.TIMESTAMP_ATTRIBUTE] = req.query.t;
        }
    }

    next();
}

function checkMandatoryParams(queryPayload) {
    return function (req, res, next) {
        const notFoundParams = [];
        let error;

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

/* eslint-disable-next-line no-unused-vars */
function returnCommands(req, res, next) {
    function updateCommandStatus(device, commandList) {
        context = fillService(context, device);
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

        const updates = commandList.map(createCommandUpdate);
        const cleanCommands = commandList.map(cleanCommand);

        /* eslint-disable-next-line no-unused-vars */
        async.parallel(updates.concat(cleanCommands), function (error, results) {
            if (error) {
                // prettier-ignore
                config.getLogger().error(
                    context,
                    'Error updating command status after delivering commands for device %s',
                    device.id
                );
            } else {
                // prettier-ignore
                config.getLogger().debug(
                    context,
                    'Command status updated successfully after delivering command list to device %s',
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
        }
        return previous + '|' + current;
    }

    if (req.query && req.query.getCmd === '1') {
        iotAgentLib.commandQueue(req.device.service, req.device.subservice, req.deviceId, function (error, list) {
            if (error || !list || list.count === 0) {
                res.set('Content-Type', 'text/plain');
                res.status(200).send('');
            } else {
                res.set('Content-Type', 'text/plain');
                res.status(200).send(list.commands.map(parseCommand).reduce(concatCommand, ''));
                process.nextTick(updateCommandStatus.bind(null, req.device, list.commands));
            }
        });
    } else {
        res.set('Content-Type', 'text/plain');
        res.status(200).send('');
    }
}

function handleIncomingMeasure(req, res, next) {
    let updates = [];
    context = fillService(context, { service: 'n/a', subservice: 'n/a' });
    // prettier-ignore
    config.getLogger().debug(context, 'Processing multiple HTTP measures for device %s with apiKey %j',
        req.deviceId, req.apiKey);

    function processHTTPWithDevice(device) {
        context = fillService(context, device);
        if (req.ulPayload) {
            updates = req.ulPayload.reduce(commonBindings.processMeasureGroup.bind(null, device, req.apiKey), []);
        }

        async.series(updates, function (error) {
            if (error) {
                next(error);
                // prettier-ignore
                config.getLogger().error(
                    context,
                    "MEASURES-002: Couldn't send the updated values to the Context Broker due to an error: %j",
                    error
                );
            } else {
                // prettier-ignore
                config.getLogger().info(
                    context,
                    'Multiple measures for device %s with apiKey %s successfully updated',
                    req.deviceId,
                    req.apiKey
                );
                finishSouthBoundTransaction(next);
            }
        });
    }

    function processDeviceMeasure(error, device) {
        if (error) {
            next(error);
        } else {
            const localContext = _.clone(context);

            req.device = device;

            localContext.service = device.service;
            localContext.subservice = device.subservice;

            intoTrans(localContext, processHTTPWithDevice)(device);
        }
    }

    utils.retrieveDevice(req.deviceId, req.apiKey, processDeviceMeasure);
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
    context = fillService(context, device);
    const options = {
        url: device.endpoint,
        method: 'POST',
        body: ulParser.createCommandPayload(device, cmdName, cmdAttributes),
        headers: {
            'fiware-service': device.service,
            'fiware-servicepath': device.subservice,
            'content-type': 'text/plain'
        },
        responseType: 'text'
    };

    if (device.endpoint) {
        // device.endpoint or another field like device.endpointExp ?
        const parser = iotAgentLib.dataPlugins.expressionTransformation;
        let attrList = iotAgentLib.dataPlugins.utils.getIdTypeServSubServiceFromDevice(device);
        attrList = device.staticAttributes ? attrList.concat(device.staticAttributes) : attrList.concat([]);
        const ctxt = parser.extractContext(attrList, device);
        config.getLogger().debug(context, 'attrList %j for device %j', attrList, device);
        // expression result will be the full command payload
        let endpointRes = null;
        try {
            endpointRes = parser.applyExpression(device.endpoint, ctxt, device);
        } catch (e) {
            // no error should be reported
        }
        options.url = endpointRes ? endpointRes : device.endpoint;
    }

    if (config.getConfig().http.timeout) {
        options.timeout = config.getConfig().http.timeout;
    }

    return function sendUlCommandHTTP(callback) {
        let commandObj;

        request(options, function (error, response, body) {
            if (error) {
                callback(new errors.HTTPCommandResponseError('', error, cmdName));
            } else if (response && response.statusCode !== 200) {
                let errorMsg;

                try {
                    commandObj = ulParser.result(body);
                    errorMsg = commandObj.result;
                } catch (e) {
                    errorMsg = body;
                }

                callback(new errors.HTTPCommandResponseError(response.statusCode, errorMsg, cmdName));
            } else if (apiKey) {
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
    context = fillService(context, device);
    utils.getEffectiveApiKey(device.service, device.subservice, device, function (error, apiKey) {
        async.series(attributes.map(generateCommandExecution.bind(null, apiKey, device)), function (error) {
            if (error) {
                // prettier-ignore
                config.getLogger().error(context, 
                    'COMMANDS-004: Error handling incoming command for device %s', device.id);

                utils.updateCommand(
                    apiKey,
                    device,
                    error.message,
                    error.command,
                    constants.COMMAND_STATUS_ERROR,
                    function (error) {
                        if (error) {
                            // prettier-ignore
                            config.getLogger().error(
                                context,
                                ' COMMANDS-005: Error updating error information for device %s',
                                device.id
                            );
                        }
                    }
                );
            } else {
                config.getLogger().debug(context, 'Incoming command for device %s', device.id);
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
 * Just fills in the transport protocol in case there is none.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function setPollingAndDefaultTransport(device, group, callback) {
    context = fillService(context, device);
    config.getLogger().debug(context, 'httpbinding.setPollingAndDefaultTransport device %j group %j', device, group);
    if (!device.transport) {
        device.transport = group && group.transport ? group.transport : 'HTTP';
    }

    if (device.transport === 'HTTP') {
        if (device.endpoint) {
            device.polling = false;
        } else {
            device.polling = !(group && group.endpoint);
        }
    }

    callback(null, device);
}

/**
 * Device provisioning handler.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceProvisioningHandler(device, callback) {
    context = fillService(context, device);
    config.getLogger().debug(context, 'httpbinding.deviceProvisioningHandler %j', device);
    let group = {};
    iotAgentLib.getConfigurationSilently(config.getConfig().iota.defaultResource || '', device.apikey, function (
        error,
        foundGroup
    ) {
        if (!error) {
            group = foundGroup;
        }
        config.getLogger().debug(context, 'httpbinding.deviceProvisioningHandler group %j', group);
        setPollingAndDefaultTransport(device, group, callback);
    });
}

/**
 * Device updating handler. This handler just fills in the transport protocol in case there is none.
 *
 * @param {Object} device           Device object containing all the information about the updated device.
 */
function deviceUpdatingHandler(device, callback) {
    context = fillService(context, device);
    config.getLogger().debug(context, 'httpbinding.deviceUpdatingHandler %j', device);
    let group = {};
    iotAgentLib.getConfigurationSilently(config.getConfig().iota.defaultResource || '', device.apikey, function (
        error,
        foundGroup
    ) {
        if (!error) {
            group = foundGroup;
        }
        config.getLogger().debug(context, 'httpbinding.deviceUpdatingHandler group %j', group);
        setPollingAndDefaultTransport(device, group, callback);
    });
}

function start(callback) {
    const baseRoot = '/';

    httpBindingServer = {
        server: null,
        app: express(),
        router: express.Router()
    };

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

    if (config.getConfig().http && config.getConfig().http.privateKey && config.getConfig().http.certificate) {
        const privateKey = fs.readFileSync(config.getConfig().http.key, 'utf8');
        const certificate = fs.readFileSync(config.getConfig().http.cert, 'utf8');
        const credentials = { key: privateKey, cert: certificate };

        config.getLogger().info(context, 'HTTPS Binding listening on port %s', config.getConfig().http.port);
        httpBindingServer.server = https.createServer(credentials, httpBindingServer.app);
    } else {
        config.getLogger().info(context, 'HTTP Binding listening on port %s', config.getConfig().http.port);
        httpBindingServer.server = http.createServer(httpBindingServer.app);
    }
    httpBindingServer.server.listen(httpBindingServer.app.get('port'), httpBindingServer.app.get('host'), callback);
}

function stop(callback) {
    config.getLogger().info(context, 'Stopping Ultralight HTTP Binding: ');

    if (httpBindingServer) {
        httpBindingServer.server.close(function () {
            config.getLogger().info(context, 'HTTP Binding Stopped');
            callback();
        });
    } else {
        callback();
    }
}

function sendPushNotifications(device, values, callback) {
    async.series(values.map(generateCommandExecution.bind(null, null, device)), function (error) {
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
exports.deviceUpdatingHandler = deviceUpdatingHandler;
exports.notificationHandler = notificationHandler;
exports.commandHandler = commandHandler;
exports.protocol = 'HTTP';
