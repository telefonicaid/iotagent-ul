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

const iotAgentLib = require('iotagent-node-lib');
const errors = require('./errors');
const dateFormat = require('dateformat');
const context = {
    op: 'IOTAUL.IoTUtils'
};
const async = require('async');
const apply = async.apply;
const constants = require('./constants');
const config = require('./configService');

/**
 * Get the API Key for the selected service if there is any, or the default API Key if a specific one does not exist.
 *
 * @param {String} service          Name of the service whose API Key we are retrieving.
 * @param {String} subservice       Name of the subservice whose API Key we are retrieving.
 * @param {Json} device             Device object.
 */
function getEffectiveApiKey(service, subservice, device, callback) {
    config.getLogger().debug(context, 'Getting effective API Key');

    if (device && device.apikey) {
        config.getLogger().debug('Using device apikey: %s', device.apikey);
        callback(null, device.apikey);
    } else {
        const type = device.type ? device.type : null;
        iotAgentLib.findConfiguration(service, subservice, type, function (error, group) {
            if (group) {
                config.getLogger().debug('Using found group: %j', group);
                callback(null, group.apikey);
            } else if (config.getConfig().defaultKey) {
                config.getLogger().debug('Using default API Key: %s', config.getConfig().defaultKey);
                callback(null, config.getConfig().defaultKey);
            } else {
                config
                    .getLogger()
                    .error(
                        context,
                        'COMMANDS-002: Could not find any APIKey information for devicein service %s subservice %s and type %s',
                        service,
                        subservice,
                        type
                    );
                callback(new errors.GroupNotFound(service, subservice, type));
            }
        });
    }
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
        iotAgentLib.getDevicesByAttribute('id', deviceId, undefined, undefined, function (error, devices) {
            if (error) {
                callback(error);
            } else if (devices && devices.length === 1) {
                callback(null, devices[0]);
            } else {
                config.getLogger().error(
                    context,

                    "MEASURES-001: Couldn't find device data for APIKey %s and DeviceId %s",

                    apiKey,
                    deviceId
                );

                callback(new errors.DeviceNotFound(deviceId, { apikey: apiKey }));
            }
        });
    } else {
        async.waterfall(
            [
                apply(iotAgentLib.getConfigurationSilently, config.getConfig().iota.defaultResource, apiKey),
                apply(iotAgentLib.findOrCreate, deviceId, apiKey), // group.apikey and apikey are the same
                apply(
                    iotAgentLib.mergeDeviceWithConfiguration,
                    ['lazy', 'active', 'staticAttributes', 'commands', 'subscriptions'],
                    [null, null, [], [], [], [], []]
                )
            ],
            callback
        );
    }
}

/**
 * Update the result of a command with the information given by the client.
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {String} message          UL payload.
 * @param {String} command          Command name.
 * @param {String} status           End status of the command.
 */
function updateCommand(apiKey, device, message, command, status, callback) {
    iotAgentLib.setCommandResult(
        device.name,
        config.getConfig().iota.defaultResource,
        apiKey,
        command,
        message,
        status,
        device,
        function (error) {
            if (error) {
                config.getLogger().error(
                    context,

                    "COMMANDS-003: Couldn't update command status in the Context broker for device %s" +
                        ' with apiKey %s: %s',
                    device.id,
                    apiKey,
                    error
                );

                callback(error);
            } else {
                config
                    .getLogger()
                    .debug(
                        context,
                        'Single measure for device %s with apiKey %s successfully updated',
                        device.id,
                        apiKey
                    );

                callback();
            }
        }
    );
}

function manageConfiguration(apiKey, deviceId, device, objMessage, sendFunction, callback) {
    /* eslint-disable-next-line no-unused-vars */
    function handleSendConfigurationError(error, results) {
        if (error) {
            config.getLogger().error(
                context,

                "CONFIG-001: Couldn't get the requested values from the Context Broker: %s",

                error
            );
        } else {
            config
                .getLogger()
                .debug(context, 'Configuration attributes sent to the device successfully.', deviceId, apiKey);
        }

        callback(error);
    }

    if (objMessage.type === 'configuration') {
        async.waterfall(
            [
                apply(iotAgentLib.query, device.name, device.type, '', objMessage.attributes, device),
                apply(sendFunction, apiKey, {}, deviceId)
            ],
            handleSendConfigurationError
        );
    } else if (objMessage.type === 'subscription') {
        iotAgentLib.subscribe(device, objMessage.attributes, objMessage.attributes, function (error) {
            if (error) {
                config
                    .getLogger()
                    .error(
                        context,
                        'CONFIG-002: There was an error subscribing device %s to attributes %j',
                        device.name,
                        objMessage.attributes
                    );
            } else {
                config
                    .getLogger()
                    .debug(
                        context,
                        'Successfully subscribed device %s to attributes %j',
                        device.name,
                        objMessage.fields
                    );
            }

            callback(error);
        });
    } else {
        config
            .getLogger()
            .error(context, 'CONFIG-003: Unknown command type from device %s: %s', device.name, objMessage.type);
        callback();
    }
}

function createConfigurationNotification(results) {
    const configurations = {};
    const now = new Date();

    // If it is the result of a subscription, results is an array
    if (Array.isArray(results)) {
        for (let i = 0; i < results.length; i++) {
            configurations[results[i].name] = results[i].value;
        }
    } else {
        for (const att in results) {
            configurations[att] = results[att].value;
        }
    }

    configurations.dt = dateFormat(now, constants.DATE_FORMAT);
    return configurations;
}

exports.createConfigurationNotification = createConfigurationNotification;
exports.getEffectiveApiKey = getEffectiveApiKey;
exports.manageConfiguration = manageConfiguration;
exports.retrieveDevice = retrieveDevice;
exports.updateCommand = updateCommand;
