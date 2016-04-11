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
    express = require('express'),
    bodyParser = require('body-parser'),
    constants = require('../constants'),
    commonBindings = require('./../commonBindings'),
    errors = require('../errors'),
    ulParser = require('../ulParser'),
    httpBindingServer,
    logger = require('logops'),
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

    iotAgentLib.getDevice(req.deviceId, function(error, device) {
        if (error) {
            next(error);
        } else {
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
    });
}

function start(config, callback) {
    var baseRoot = '/';

    httpBindingServer = {
        server: null,
        app: express(),
        router: express.Router()
    };

    logger.info(context, 'HTTP Binding listening on port [%s]', config.http.port);

    httpBindingServer.app.set('port', config.http.port);
    httpBindingServer.app.set('host', '0.0.0.0');

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
    logger.info(context, 'Stopping Ultralight HTTP Binding');

    if (httpBindingServer) {
        httpBindingServer.server.close(callback);
    } else {
        callback();
    }
}

exports.start = start;
exports.stop = stop;
exports.protocol = 'HTTP_UL';
