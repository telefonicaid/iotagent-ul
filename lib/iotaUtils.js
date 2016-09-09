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
    errors = require('./errors'),
    _ = require('underscore'),
    context = {
        op: 'IOTAUL.IoTUtils'
    },
    async = require('async'),
    apply = async.apply,
    config = require('./configService');

/**
 * Get the API Key for the selected service if there is any, or the default API Key if a specific one does not exist.
 *
 * @param {String} service          Name of the service whose API Key we are retrieving.
 * @param {String} subservice       Name of the subservice whose API Key we are retrieving.
 */
function getEffectiveApiKey(service, subservice, callback) {
    logger.debug(context, 'Getting effective API Key');

    iotAgentLib.findConfiguration(service, subservice, function(error, group) {
        if (group) {
            logger.debug('Using found group: %j', group);
            callback(null, group.apikey);
        } else if (config.getConfig().defaultKey) {
            logger.debug('Using default API Key: %s', config.getConfig().defaultKey);
            callback(null, config.getConfig().defaultKey);
        } else {
            logger.error(context, 'COMMANDS-002: Could not find any API Key information for device.');
            callback(new errors.GroupNotFound(service, subservice));
        }
    });
}

function findOrCreate(deviceId, group, callback) {
    iotAgentLib.getDevice(deviceId, group.service, group.subservice, function(error, device) {
        if (!error && device) {
            callback(null, device, group);
        } else if (error.name === 'DEVICE_NOT_FOUND') {
            var newDevice = {
                id: deviceId,
                service: group.service,
                subservice: group.subservice,
                type: group.type
            };

            if (config.getConfig().iota && config.getConfig().iota.iotManager &&
                config.getConfig().iota.iotManager.protocol) {
                newDevice.protocol = config.getConfig().iota.iotManager.protocol;
            }

            iotAgentLib.register(newDevice, function(error, device) {
                callback(error, device, group);
            });
        } else {
            callback(error);
        }
    });
}

function mergeArrays(original, newArray) {
    /* jshint camelcase: false */
    var originalKeys = _.pluck(original, 'object_id'),
        newKeys = _.pluck(newArray, 'object_id'),
        addedKeys = _.difference(newKeys, originalKeys),
        differenceArray = newArray.filter(function(item) {
            return addedKeys.indexOf(item.object_id) >= 0;
        });

    return original.concat(differenceArray);
}

/**
 * If the object_id or the name of the attribute is missing, complete it with the other piece of data.
 *
 * @param {Object} attribute            Device attribute
 * @return {*}                          Completed attribute
 */
function setDefaultAttributeIds(attribute) {
    /* jshint camelcase: false */

    if (!attribute.object_id && attribute.name) {
        attribute.object_id = attribute.name;
    }

    if (!attribute.name && attribute.object_id) {
        attribute.name = attribute.object_id;
    }

    return attribute;
}

/**
 * Complete the information of the device with the information in the configuration group (with precedence of the
 * device).
 *
 * @param {Object} deviceData           Device data.
 * @param {Object} configuration        Configuration data.
 */
function mergeDeviceWithConfiguration(deviceData, configuration, callback) {
    var fields = ['lazy', 'internalAttributes', 'active', 'staticAttributes', 'commands', 'subscriptions'],
        defaults = [null, null, [], [], [], [], []];

    for (var i = 0; i < fields.length; i++) {
        var confField = (fields[i] === 'active') ? 'attributes' : fields[i];

        if (deviceData[fields[i]] && configuration && configuration[confField]) {
            deviceData[fields[i]] = mergeArrays(deviceData[fields[i]], configuration[confField]);
        } else if (!deviceData[fields[i]] && configuration && configuration[confField]) {
            deviceData[fields[i]] = configuration[confField];
        } else if (!deviceData[fields[i]] && (!configuration || !configuration[confField])) {
            deviceData[fields[i]] = defaults[i];
        }

        if (deviceData[fields[i]] && ['active', 'lazy', 'commands'].indexOf(fields[i]) >= 0) {
            deviceData[fields[i]] = deviceData[fields[i]].map(setDefaultAttributeIds);
        }
    }

    callback(null, deviceData);
}

/**
 * Retrieve a device from the device repository based on the given APIKey and DeviceID, creating one if none is
 * found for the given data.
 *
 * @param {String} deviceId         Device ID of the device that wants to be retrieved or created.
 * @param {String} apiKey           APIKey of the Device Group (or default APIKey).
 */
function retrieveDevice(deviceId, apiKey, callback) {
    if (apiKey === config.getConfig().defaultKey) {
        iotAgentLib.getDevicesByAttribute('id', deviceId, undefined, undefined, function(error, devices) {
            if (error) {
                callback(error);
            } else if (devices && devices.length === 1) {
                callback(null, devices[0]);
            } else {
                logger.error(context, 'MEASURES-001: Couldn\'t find device data for APIKey [%s] and DeviceId[%s]',
                    deviceId, apiKey);

                callback(new errors.DeviceNotFound(deviceId));
            }
        });
    } else {
        async.waterfall([
            apply(iotAgentLib.getConfiguration, config.getConfig().iota.defaultResource, apiKey),
            apply(findOrCreate, deviceId),
            mergeDeviceWithConfiguration
        ], callback);
    }
}

exports.getEffectiveApiKey = getEffectiveApiKey;
exports.retrieveDevice = retrieveDevice;
