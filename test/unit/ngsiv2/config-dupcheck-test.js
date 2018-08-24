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
 *
 * Modified by: Fernando Méndez, Daniel Calvo - ATOS Research & Innovation
 *
 * copy "config-test" and edit to test duplication message checker by Nobuyuki Matsui<nobuyuki.matsui@gmail.com>
 */
var config = {};

config.mqtt = {
    host: 'localhost',
    port: 1883,
    username: 'guest',
    password: 'guest',
    extensions: [
        {
            name: 'distinctMessage',
            description: 'distinct mqtt message',
            providerUrl: 'http://192.168.1.2:5000/distinct/'
        }
    ]
};

config.http = {
    port: 7896
};

config.amqp = {
    port: 5672,
    exchange: 'amq.topic',
    queue: 'iota_queue',
    options: {durable: true}
};

config.iota = {
    logLevel: 'FATAL',
    autocast: true,
    contextBroker: {
        host: '192.168.1.1',
        port: '1026',
        ngsiVersion: 'v2'
    },
    server: {
        port: 4041
    },
    deviceRegistry: {
        type: 'memory'
    },

    types: {},
    service: 'howtoService',
    subservice: '/howto',
    providerUrl: 'http://localhost:4041',
    deviceRegistrationDuration: 'P1M',
    defaultType: 'Thing',
    defaultResource: '/iot/d'
};

config.defaultKey = '1234';
config.defaultTransport = 'HTTP';

module.exports = config;
