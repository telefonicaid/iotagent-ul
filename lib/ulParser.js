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

const errors = require('./errors');
const constants = require('./constants');
const iotAgentLib = require('iotagent-node-lib');
const _ = require('underscore');
const context = {
    op: 'IOTAUL.ulParser'
};
const config = require('./configService');

/**
 * Generates a function that parse the given attribute string, adding it to the previous collection, using the
 * provided separator.
 *
 * @param {String} separator           Character used to separate the key from the value
 * @return {Function}                  The key-pair parsing function for the separator.
 */
function addAttribute(separator) {
    return function (collection, newAttr) {
        const fields = newAttr.split(separator);

        if (!fields || fields.length !== 2) {
            throw new errors.ParseError('Extracting attribute:' + newAttr);
        } else {
            collection[fields[0]] = fields[1];
            return collection;
        }
    };
}

/**
 * Extract a key value pair from a length 2 array and add it as an attribute to the given object.
 *
 * @param {Object} collection          Collection of key value pairs
 * @param {Array} pair                 Key value pair as an array of length 2.
 * @return {Object}                    Resulting object.
 */
function addAttributePair(collection, pair) {
    if (!pair || pair.length !== 2) {
        throw new errors.ParseError('Extracting attribute:' + JSON.stringify(pair));
    } else {
        collection[pair[0]] = pair[1];
        return collection;
    }
}

/**
 * Divide a list into smaller chunks, of the given size.
 *
 * @param {Array}  list         Array to be divided.
 * @param {Number} size         Size of the chunks.
 * @return {Array}              Array containing the chunks.
 */
function chunk(list, size) {
    const chunks = [];

    while (list.length) {
        chunks.push(list.splice(0, size));
    }

    return chunks;
}

function parseMeasure(group, numberOfBars) {
    let timestamp;
    let returnValue;

    if (numberOfBars && numberOfBars.length % 2 === 0) {
        timestamp = group.substr(0, group.indexOf('|'));
        group = group.substr(group.indexOf('|') + 1);
    }

    const attributes = group.split('|');

    if (
        !attributes ||
        attributes.length === 0 ||
        attributes.length % 2 !== 0 ||
        attributes.filter(_.isEmpty).length > 0
    ) {
        throw new errors.ParseError('Parsing group:' + group);
    } else {
        returnValue = chunk(attributes, 2).reduce(addAttributePair, {});

        if (timestamp) {
            returnValue[constants.TIMESTAMP_ATTRIBUTE] = timestamp;
        }

        return returnValue;
    }
}

/**
 * Parse a command execution payload, returning an object containing information about the command. Throws
 * an error if the syntax is not correct.
 *
 * The returned object contains three attributes:
 * - deviceId: ID of the device executing the command.
 * - command: name of the command to execute.
 * - params: object containing the parameters to the command in map format.
 *
 * @param {String} payload          Ultralight 2.0 command execution payload
 * @return {Object}                Object containing the command information
 */
function command(payload) {
    const fields = payload.split('|');
    const result = {};

    if (fields.length < 1 || fields[0].indexOf('@') < 0) {
        throw new errors.ParseError('Parsing command:' + payload);
    }

    const deviceData = fields[0].split('@');

    result.deviceId = deviceData[0];
    result.command = deviceData[1];

    const dataSection = fields.splice(1);

    if (dataSection.length === 1 && dataSection[0].indexOf('=') < 0) {
        result.value = dataSection[0];
    } else {
        result.params = dataSection.reduce(addAttribute('='), {});
    }

    return result;
}

function parseCommand(group) {
    return command(group);
}

/**
 * Parse a measure group, i.e.: a string of key-value pairs sepparated by the '|' character, returning an object with
 * the same information structured as a map.
 *
 * @param {String} group                String containing a UL2.0 codified group.
 * @return {Object}                    Object representing the information in the group.
 */
function parseGroup(group) {
    if (group[0] === '|') {
        group = group.substr(1);
    }

    const numberOfBars = group.match(/\|/g);

    if (group.indexOf('@') > 0) {
        return parseCommand(group);
    }
    return parseMeasure(group, numberOfBars);
}

/**
 * Parse a measure reporting payload, returning an array with all the measure groups restructured as objects. Throws
 * an error if the syntax is not correct.
 *
 * @param {String} payload          Ultralight 2.0 measure reporting payload
 * @return {Array}                 Array containing an object per measure group
 */
function parse(payload) {
    let groups;
    let result;

    if (!payload) {
        throw new errors.ParseError('Empty payload parsing Ultraligh 2.0');
    }

    try {
        groups = payload.split('#');
        result = groups.map(parseGroup);
    } catch (e) {
        throw new errors.ParseError('Unknown error parsing Ultralight 2.0: %s', e);
    }

    return result;
}

function parseConfigurationRequest(payload) {
    const fields = payload.split('|');

    return {
        type: fields[0],
        attributes: fields.slice(1, fields.lenght)
    };
}

/**
 * Parse a command result payload, returning an object containing information about the command result. Throws
 * an error if the syntax is not correct.
 *
 * The returned object contains three attributes:
 * - deviceId: ID of the device executing the command.
 * - command: name of the command to execute.
 * - result: a string representing the output of the command.
 *
 * @param {String} payload          Ultralight 2.0 command result payload
 * @return {Object}                Object containing the result information
 */
function result(payload) {
    const fields = payload.split('|');

    if (fields.length < 1 || fields[0].indexOf('@') < 0) {
        throw new errors.ParseError('Parsing command:' + payload);
    }

    const deviceData = fields[0].split('@');

    return {
        deviceId: deviceData[0],
        command: deviceData[1],
        result: fields[1]
    };
}

/**
 * Serializes a payload for a command depending on its payloadType if provided
 *
 * @param {String} payload          Payload to serialized
 * @param {Object} command          Command attribute
 * @return {Function}               Returns a serialized payload
 */
function serializedPayloadCommand(payload, command) {
    let serialized;
    if (command && command.payloadType) {
        switch (command.payloadType.toLowerCase()) {
            case 'binaryfromstring':
                serialized = Buffer.from(payload.toString());
                break;
            case 'binaryfromhex':
                serialized = Buffer.from(payload, 'HEX');
                break;
            case 'binaryfromjson':
                serialized = Buffer.from(JSON.stringify(payload));
                break;
            case 'json':
                serialized = JSON.stringify(payload);
                break;
            default:
                // passthrough
                serialized = payload;
        }
    } else {
        serialized = payload;
    }
    return serialized;
}

/**
 * Creates the command payload string, based on the device information and command attributes.
 *
 * @param {Object} device           Object containing all the information about a device.
 * @param {String} command          Name of the command to execute.
 * @param {Object} attributes       Object containing the command parameters as attributes of the object.
 * @return {String}                 String with the codified command.
 */
function createCommandPayload(device, command, attributes) {
    function addAttributes(current, key) {
        let cmd = device && device.commands.find((att) => att.name === current.split('@')[1]);
        let value = attributes[key];
        if (cmd && cmd.expression) {
            let parser = iotAgentLib.dataPlugins.expressionTransformation;
            // The context for the JEXL expression should be the ID, TYPE, S, SS
            let attrList = [
                { name: 'id', type: 'String', value: device.id },
                { name: 'type', type: 'String', value: device.type },
                { name: 'service', type: 'String', value: device.service },
                { name: 'subservice', type: 'String', value: device.subservice }
            ];
            attrList = device.staticAttributes
                ? attrList.concat(device.staticAttributes).concat({ key: value })
                : attrList.concat({ key: value });
            config.getLogger().debug(context, 'attrList [%j] for device %j', attrList, device);
            let ctxt = parser.extractContext(attrList, device);
            let valueRes = null;
            try {
                valueRes = parser.applyExpression(cmd.expression, ctxt, device);
            } catch (e) {
                // nothing to report
            }
            value = valueRes ? valueRes : cmd.expression;
            return current + '|' + value;
        } else {
            return current + '|' + key + '=' + value;
        }
    }
    if (typeof attributes === 'object') {
        return Object.keys(attributes).reduce(addAttributes, device.id + '@' + command, command);
    }
    let cmd = device && device.commands.find((att) => att.name === command);
    if (cmd && cmd.expression) {
        let parser = iotAgentLib.dataPlugins.expressionTransformation;
        // The context for the JEXL expression should be the ID, TYPE, S, SS
        let attrList = [
            { name: 'id', type: 'String', value: device.id },
            { name: 'type', type: 'String', value: device.type },
            { name: 'service', type: 'String', value: device.service },
            { name: 'subservice', type: 'String', value: device.subservice }
        ];
        attrList = device.staticAttributes
            ? attrList.concat(device.staticAttributes).concat({ command: attributes })
            : attrList.concat({ command: attributes });
        config.getLogger().debug(context, 'attrList [%j] for device %j', attrList, device);
        let ctxt = parser.extractContext(attrList, device);
        let valueRes = null;
        try {
            valueRes = parser.applyExpression(cmd.expression, ctxt, device);
        } catch (e) {
            // nothing to report
        }
        attributes = valueRes ? valueRes : cmd.expression;
    }
    let payload = device.id + '@' + command + '|' + attributes;
    return serializedPayloadCommand(payload, cmd);
}

/**
 * Creates the configuration payload string, based on the device information.
 *
 * @param {Object} device           Object containing all the information about a device.
 * @param {Object} attributes       Object containing the command parameters as attributes of the object.
 * @return {String}                 String with the codified command.
 */
function createConfigurationPayload(deviceId, attributes) {
    function addAttributes(current, key) {
        return current + '|' + key + '=' + attributes[key];
    }

    return Object.keys(attributes).reduce(addAttributes, deviceId + '@configuration');
}

exports.parse = parse;
exports.parseConfigurationRequest = parseConfigurationRequest;
exports.command = command;
exports.result = result;
exports.createCommandPayload = createCommandPayload;
exports.createConfigurationPayload = createConfigurationPayload;
