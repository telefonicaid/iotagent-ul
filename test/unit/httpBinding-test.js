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

var iotagentUl = require('../../'),
    config = require('../config-test.js'),
    nock = require('nock'),
    iotAgentLib = require('iotagent-node-lib'),
    should = require('should'),
    async = require('async'),
    request = require('request'),
    utils = require('../utils'),
    contextBrokerMock;

describe('HTTP Transport binding', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        contextBrokerMock = nock('http://10.11.128.16:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

        iotagentUl.start(config, function() {
            request(provisionOptions, function(error, response, body) {
                done();
            });
        });
    });

    afterEach(function(done) {
        nock.cleanAll();

        async.series([
            iotAgentLib.clearAll,
            iotagentUl.stop
        ], done);
    });

    describe('When a new single measure arrives for a Device, via HTTP GET', function() {
        var getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'GET',
            qs: {
                i: 'MQTT_2',
                k: '1234',
                d: 'a|23'
            }
        };

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should end up with a 200OK status code', function(done) {
            request(getOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a new update context request to the Context Broker with just that attribute', function(done) {
            request(getOptions, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });
    describe('When multiple mesasures arrive for a device via HTTP GET', function() {
        var getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'GET',
            qs: {
                i: 'MQTT_2',
                k: '1234',
                d: 'a|23|b|98'
            }
        };

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/multipleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));
        });

        it('should end up with a 200OK status code', function(done) {
            request(getOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a new update context request to the Context Broker with those attributes', function(done) {
            request(getOptions, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });
    describe('When a new single measure arrives for a Device, via HTTP POST', function() {
        var getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'MQTT_2',
                k: '1234'
            },
            headers: {
                'Content-type': 'text/plain'
            },
            body: 'a|23'
        };

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should end up with a 200OK status code', function(done) {
            request(getOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a new update context request to the Context Broker with just that attribute', function(done) {
            request(getOptions, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });
    describe('When multiple groups of measures arrive, via HTTP POST', function() {
        var getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'MQTT_2',
                k: '1234'
            },
            headers: {
                'Content-type': 'text/plain'
            },
            body: 'a|23#b|98'
        };

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/secondSingleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/secondSingleMeasureSuccess.json'));
        });

        it('should end up with a 200OK status code', function(done) {
            request(getOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a two update context requests to the Context Broker one with each attribute', function(done) {
            request(getOptions, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });
    describe('When multiple groups of measures arrive, with multiple attributes, via HTTP POST', function() {
        var getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'MQTT_2',
                k: '1234'
            },
            headers: {
                'Content-type': 'text/plain'
            },
            body: 'a|23|b|98#a|16|b|34'
        };

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/multipleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/secondMultipleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));
        });

        it('should end up with a 200OK status code', function(done) {
            request(getOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a two update context requests to the Context Broker one with each attribute', function(done) {
            request(getOptions, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });
});
