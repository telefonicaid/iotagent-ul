/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-json
 *
 * iotagent-json is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-json is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-json.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 *
 * Modified by: Daniel Calvo - ATOS Research & Innovation
 * Modified by: Fermin Galan - Telefónica
 */

/* eslint-disable no-unused-vars */

const iotagentMqtt = require('../../../');
const config = require('./config-test.js');
const nock = require('nock');
const should = require('should');
const iotAgentLib = require('iotagent-node-lib');
const async = require('async');
const request = require('request');
const utils = require('../../utils');
let mockedClientServer;
let contextBrokerMock;

describe('HTTP: Commands', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommand2.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        config.logLevel = 'INFO';

        nock.cleanAll();

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/registrations')
            .reply(201, null, { Location: '/v2/registrations/6319a7f5254b05844116584d' });

        contextBrokerMock
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        iotagentMqtt.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe('When a command arrive to the Agent for a device with the HTTP protocol', function () {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v2/op/update',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs?type=AnMQTTDevice',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus1.json')
                )
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs?type=AnMQTTDevice',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus6.json')
                )
                .reply(204);

            mockedClientServer = nock('http://localhost:9876')
                .post('/command', function (body) {
                    return body === 'MQTT_2@PING|data=22';
                })
                .reply(200, 'MQTT_2@PING|data=22');
        });

        it('should return a 204 OK without errors', function (done) {
            request(commandOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(204);
                done();
            });
        });
        it('should update the status in the Context Broker', function (done) {
            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
        it('should publish the command information in the MQTT topic', function (done) {
            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    mockedClientServer.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a command arrive to the Agent and the device answers with an error', function () {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v2/op/update',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function () {
            nock.cleanAll();

            mockedClientServer = nock('http://localhost:9876')
                .post('/command', 'MQTT_2@PING|data=22')
                .reply(500, 'MQTT_2@ping|ping ERROR, Command error');

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs?type=AnMQTTDevice',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatusError2.json')
                )
                .reply(204);

        });

        it('should update the status in the Context Broker', function (done) {
            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a command arrive with a wrong endpoint', function () {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v1/updateContext',
            method: 'POST',
            json: utils.readExampleFile('./test/contextRequests/updateCommandWrongEndpoint.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };
        const provisionWrongEndpoint = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommandWrongEndpoint.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            nock.cleanAll();

            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/registrations')
                .reply(201, null, { Location: '/v2/registrations/6319a7f5254b05844116584d' });

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs?type=AnMQTTDevice',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus1.json')
                )
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs?type=AnMQTTDevice',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus1.json')
                )
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs?type=AnMQTTDevice',
                    function (body) {
                        return body.contextElements['0'].attributes['0'].value === 'ERROR';
                    })
                .reply(204);

            request(provisionWrongEndpoint, function (error, response, body) {
                setTimeout(function () {
                    done();
                }, 50);
            });
        });

        it('should return a 204 OK without errors', function (done) {
            request(commandOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(204);
                done();
            });
        });

        it('should update the status in the Context Broker', function (done) {
            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });
});
