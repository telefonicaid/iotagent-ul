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

/* eslint-disable no-unused-vars */

const iotagentMqtt = require('../../../');
const mqtt = require('mqtt');
const config = require('./config-test.js');
const nock = require('nock');
const should = require('should');
const iotAgentLib = require('iotagent-node-lib');
const async = iotAgentLib.async;
const request = require('request');
const utils = require('../../utils');
let contextBrokerMock;
let oldConfigurationFlag;
let mqttClient;

describe('MQTT Transport binding: configurations', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/configurationRetrieval/provisionDeviceWithConfiguration.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        config.logLevel = 'INFO';

        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        oldConfigurationFlag = config.configRetrieval;
        config.configRetrieval = true;

        iotagentMqtt.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        config.configRetrieval = oldConfigurationFlag;

        nock.cleanAll();
        mqttClient.end();

        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe('When a configuration request is received in the topic "/{{apikey}}/{{deviceid}}/configuration/commands"', function () {
        const values = 'configuration|pollingInterval|publishInterval';
        let configurationReceived;

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .get('/v2/entities/MQTT%20Device%201/attrs?attrs=pollingInterval,publishInterval&type=AnMQTTDevice')
                .reply(200, utils.readExampleFile('./test/unit/ngsiv2/contextResponses/getConfigurationSuccess.json'));

            mqttClient.subscribe('/1234/MQTT_device_1/configuration/values', null);

            configurationReceived = false;
        });

        afterEach(function (done) {
            mqttClient.unsubscribe('/1234/MQTT_device_1/configuration/values', null);

            done();
        });

        it('should ask the Context Broker for the request attributes', function (done) {
            mqttClient.publish('/1234/MQTT_device_1/configuration/commands', values, null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });

        it('should return the requested attributes to the client in /1234/MQTT_device_1/configuration/values', function (done) {
            mqttClient.on('message', function (topic, data) {
                const result = utils.parseConfigurationResponse(data.toString());

                configurationReceived =
                    result.pollingInterval &&
                    result.pollingInterval === '200' &&
                    result.publishInterval &&
                    result.publishInterval === '80';
            });

            mqttClient.publish('/1234/MQTT_device_1/configuration/commands', values, null, function (error) {
                setTimeout(function () {
                    configurationReceived.should.equal(true);
                    done();
                }, 100);
            });
        });

        it('should add the system timestamp in compressed format to the request', function (done) {
            mqttClient.on('message', function (topic, data) {
                const result = utils.parseConfigurationResponse(data.toString());

                configurationReceived = result.dt && result.dt.should.match(/^\d{8}T\d{6}Z$/);
            });

            mqttClient.publish('/1234/MQTT_device_1/configuration/commands', values, null, function (error) {
                setTimeout(function () {
                    should.exist(configurationReceived);
                    done();
                }, 100);
            });
        });
    });

    describe('When a subscription request is received in the IoT Agent', function () {
        const values = 'subscription|pollingInterval|publishInterval';
        let configurationReceived;

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/subscriptions',
                    utils.readExampleFile('./test/unit/ngsiv2/subscriptionRequests/configurationsMqttRequest.json')
                )
                .reply(201, null, { Location: '/v2/subscriptions/51c0ac9ed714fb3b37d7d5a8' });

            mqttClient.subscribe('/1234/MQTT_device_1/configuration/values', null);

            configurationReceived = false;
        });

        afterEach(function (done) {
            mqttClient.unsubscribe('/1234/MQTT_device_1/configuration/values', null);

            done();
        });

        it('should create a subscription in the ContextBroker', function (done) {
            mqttClient.publish('/1234/MQTT_device_1/configuration/commands', values, null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });

        it('should update the values in the MQTT topic when a notification is received', function (done) {
            const optionsNotify = {
                url: 'http://localhost:' + config.iota.server.port + '/notify',
                method: 'POST',
                json: utils.readExampleFile(
                    './test/unit/ngsiv2/subscriptionRequests/configurationsMqttNotification.json'
                ),
                headers: {
                    'fiware-service': 'smartgondor',
                    'fiware-servicepath': '/gardens'
                }
            };

            mqttClient.on('message', function (topic, data) {
                const result = utils.parseConfigurationResponse(data.toString());

                configurationReceived = result.pollingInterval === '60' && result.publishInterval === '600';
            });

            mqttClient.publish('/1234/MQTT_device_1/configuration/commands', values, null, function (error) {
                setTimeout(function () {
                    request(optionsNotify, function (error, response, body) {
                        setTimeout(function () {
                            configurationReceived.should.equal(true);
                            done();
                        }, 100);
                    });
                }, 100);
            });
        });
    });

    describe('When a configuration request type is other than "configuration" or "subscription"', function () {
        const values = 'notallowedtype|pollingInterval|publishInterval';

        it('should silently ignore the error (without crashing)', function (done) {
            mqttClient.publish('/1234/MQTT_device_1/configuration/commands', values, null, function (error) {
                setTimeout(function () {
                    done();
                }, 100);
            });
        });
    });
});
