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
    should = require('should'),
    iotAgentLib = require('iotagent-node-lib'),
    async = require('async'),
    request = require('request'),
    utils = require('../utils'),
    contextBrokerMock,
    mqttClient;

describe('MQTT Transport binding: configurations', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/configurationRetrieval/provisionDeviceWithConfiguration.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        config.logLevel = 'INFO';

        nock.cleanAll();

        mqttClient = mqtt.connect(
            'mqtt://' + config.mqtt.host,
            {
                keepalive: 0,
                connectTimeout: 60 * 60 * 1000
            }
        );

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/provisionDeviceWithConfigurationSuccess.json'));

        iotagentMqtt.start(config, function() {
            request(provisionOptions, function(error, response, body) {
                done();
            });
        });
    });

    afterEach(function(done) {
        nock.cleanAll();
        mqttClient.end();

        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe(
        'When a configuration request is received in the topic ' + '"/{{apikey}}/{{deviceid}}/configuration/commands"',
        function() {
            // var values = {
            //         type: 'configuration',
            //         fields: ['pollingInterval', 'publishInterval']
            //     },
            //     configurationReceived;

            var values = 'configuration|pollingInterval|publishInterval',
                configurationReceived;

            beforeEach(function() {
                contextBrokerMock
                    .matchHeader('fiware-service', 'smartGondor')
                    .matchHeader('fiware-servicepath', '/gardens')
                    .post('/v1/queryContext', utils.readExampleFile('./test/contextRequests/getConfiguration.json'))
                    .reply(200, utils.readExampleFile('./test/contextResponses/getConfigurationSuccess.json'));

                mqttClient.subscribe('/1234/MQTT_device_1/configuration/values', null);

                configurationReceived = false;
            });

            afterEach(function(done) {
                mqttClient.unsubscribe('/1234/MQTT_device_1/configuration/values', null);

                done();
            });

            it('should ask the Context Broker for the request attributes', function(done) {
                mqttClient.publish('/1234/MQTT_device_1/configuration/commands', values, null, function(error) {
                    setTimeout(function() {
                        contextBrokerMock.done();
                        done();
                    }, 100);
                });
            });

            it('should return the requested attributes to the client in /1234/MQTT_device_1/configuration/values', function(done) {
                mqttClient.on('message', function(topic, data) {
                    var result = utils.parseConfigurationResponse(data.toString());

                    configurationReceived =
                        result.pollingInterval &&
                        result.pollingInterval === '200' &&
                        result.publishInterval &&
                        result.publishInterval === '80';
                });

                mqttClient.publish('/1234/MQTT_device_1/configuration/commands', values, null, function(error) {
                    setTimeout(function() {
                        configurationReceived.should.equal(true);
                        done();
                    }, 100);
                });
            });

            it('should add the system timestamp in compressed format to the request', function(done) {
                mqttClient.on('message', function(topic, data) {
                    var result = utils.parseConfigurationResponse(data.toString());

                    configurationReceived = result.dt && result.dt.should.match(/^\d{8}T\d{6}Z$/);
                });

                mqttClient.publish('/1234/MQTT_device_1/configuration/commands', values, null, function(error) {
                    setTimeout(function() {
                        should.exist(configurationReceived);
                        done();
                    }, 100);
                });
            });
        }
    );
});
