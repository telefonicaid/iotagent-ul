/*
 * Copyright 2015 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-mqtt
 *
 * iotagent-mqtt is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-mqtt is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-mqtt.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */

/* eslint-disable no-unused-vars */

const fs = require('fs');
const got = require('got');

function readExampleFile(name, raw) {
    let text = null;
    try {
        text = fs.readFileSync(name, 'UTF8');
    } catch (e) {
        /* eslint-disable no-console */
        console.error(JSON.stringify(e));
    }
    return raw ? text : JSON.parse(text);
}

function delay(ms) {
    return function (callback) {
        setTimeout(callback, ms);
    };
}

function parseConfigurationResponse(payload) {
    const _device = payload.split('@');
    const _fields = _device[1].split('|');
    const _attributes = _fields.slice(1, _fields.lenght);
    const _result = {};

    _result.device = _device[0];
    _result.type = _fields[0];

    _attributes.forEach(function (item, index) {
        const _attribute = item.split('=');
        _result[_attribute[0]] = _attribute[1];
    });

    return _result;
}

function request(options, callback) {
    const httpOptions = {
        method: options.method,
        searchParams: options.searchParams,
        headers: options.headers,
        throwHttpErrors: false,
        retry: 0
    };

    if (options.method !== 'GET') {
        httpOptions.json = options.json;
        httpOptions.body = options.body;
    }

    got(options.url, httpOptions)
        .then((response) => {
            return callback(null, response, response.body);
        })
        .catch((error) => {
            return callback(error);
        });
}

exports.readExampleFile = readExampleFile;
exports.parseConfigurationResponse = parseConfigurationResponse;
exports.delay = delay;
exports.request = request;
