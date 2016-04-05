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

var errors = require('./errors');

function addAttribute(collection, newAttr) {
    var fields = newAttr.split('=');

    if (!fields || fields.length !== 2) {
        throw new errors.ParseError("Extracting attribute:" + newAttr);
    } else {
        collection[fields[0]] = fields[1];
        return collection;
    }
}

function parseGroup(group) {
    var attributes = group.split('|');

    if (!attributes || attributes.length === 0) {
        throw new errors.ParseError("Parsing group:" + group);
    } else {
        return attributes.reduce(addAttribute, {});    
    }
}

function parse(payload) {
    var groups = payload.split('#');

    return groups.map(parseGroup);
}

function command(payload) {
    var fields = payload.split('|'),
        deviceData,
        commandData;

    if ((fields.length < 1)||(fields[0].indexOf('@') < 0)) {
        throw new errors.ParseError("Parsing command:" + payload);
    }

    deviceData = fields[0].split('@');
    commandData = fields.splice(1).reduce(addAttribute, {});

    return {
        deviceId: deviceData[0],
        command: deviceData[1],
        params: commandData
    };
}

function result(payload) {
    var fields = payload.split('|'),
        deviceData,
        commandData;

    if ((fields.length < 1) || (fields[0].indexOf('@') < 0)) {
        throw new errors.ParseError("Parsing command:" + payload);
    }

    deviceData = fields[0].split('@');

    return {
        deviceId: deviceData[0],
        command: deviceData[1],
        result: fields[1]
    };
}

exports.parse = parse;
exports.command = command;
exports.result = result;