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

var iotagentMqtt = require('../../'),
    mqtt = require('mqtt'),
    config = require('../config-test.js'),
    nock = require('nock'),
    iotAgentLib = require('iotagent-node-lib'),
    async = require('async'),
    request = require('request'),
    utils = require('../utils'),
    contextBrokerMock,
    mqttClient;

describe('MQTT Transport binding: commands', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommand1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        contextBrokerMock = nock('http://10.11.128.16:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));

        iotagentMqtt.start(config, function() {
            request(provisionOptions, function(error, response, body) {
                done();
            });
        });
    });

    afterEach(function(done) {
        nock.cleanAll();
        mqttClient.end();

        async.series([
            iotAgentLib.clearAll,
            iotagentMqtt.stop
        ], done);
    });

    describe.only('When a command arrive to the Agent for a device with the MQTT_UL protocol', function() {
        var commandOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/v1/updateContext',
                method: 'POST',
                json: utils.readExampleFile('./test/contextRequests/updateCommand1.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            },
            provisionOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice1.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/updateStatus1.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));
        });

        it('should return a 200 OK without errors', function(done) {
            request(commandOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });

        it('should reply with the appropriate command information', function(done) {
            request(commandOptions, function(error, response, body) {
                should.exist(body);
                done();
            });
        });

        it('should update the status in the Context Broker', function(done) {
            request(commandOptions, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });

        it('should publish the command information in the MQTT topic', function(done) {
            var commandMsg = 'device_id@ping6|data=22';

            mqttClient.on('message', function(topic, data) {
                should.exist(data);
                data.should.equal(commandMsg);
                done();
            });

            request(commandOptions, function(error, response, body) {
                should.not.exist(error);
            });
        });
    });

    describe('When a command update arrives to the MQTT command topic', function() {
        it('should send an update request to the Context Broker');
    });
});