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
var config = {};

config.http = {
    path: '/iot/d',
    port: 7896
};

config.mqtt = {
    host: 'localhost',
    port: 1883,
    options: {
        keepalive: 0,
        connectTimeout: 60 * 60 * 1000
    }
};

config.device = {
    id: 'myDeviceId',
    apikey: '1234'
};

config.defaultBinding = 'mqtt';

module.exports = config;
