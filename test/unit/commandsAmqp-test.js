/*
 * Copyright 2017 Telefonica Investigación y Desarrollo, S.A.U
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

describe('MQTT Transport binding: commands', function() {

    describe('When a command arrive to the Agent for a device with the MQTT_UL protocol', function() {
        it('should return a 200 OK without errors');
        it('should reply with the appropriate command information');
        it('should update the status in the Context Broker');
        it('should publish the command information in the MQTT topic');
    });

    describe('When a command update arrives to the MQTT command topic', function() {
        it('should send an update request to the Context Broker');
    });

    describe('When a command update arrives with a single text value', function() {
        it('should publish the command information in the MQTT topic');
    });
});
