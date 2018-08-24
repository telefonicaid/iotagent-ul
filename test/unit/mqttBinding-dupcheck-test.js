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
 *
 * copy "mqttBinding-test" and edit to test duplication message checker by Nobuyuki Matsui<nobuyuki.matsui@gmail.com>
 */

'use strict';

var iotagentMqtt = require('../../'),
    mqtt = require('mqtt'),
    config = require('./config-dupcheck-test.js'),
    nock = require('nock'),
    iotAgentLib = require('iotagent-node-lib'),
    async = require('async'),
    request = require('request'),
    utils = require('../utils'),
    contextBrokerMock,
    dupCheckerMock,
    mqttClient;

describe('MQTT Transport binding with duplication checker: measures', function() {
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

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

        dupCheckerMock = nock('http://192.168.1.2:5000')
            .post('/distinct/')
            .reply(200, {result: 'success'});

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

    describe('When a new non-duplicated single measure arrives to a Device topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should send a new update context request to the Context Broker with just that attribute', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs/a', '23', null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new duplicated single measure arrives to a Device topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should not send a new update context request to the Context Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs/a', '23', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    describe('When a new non-duplicated measure arrives for an unprovisioned Device', function() {
        var groupCreation = {
                url: 'http://localhost:4041/iot/services',
                method: 'POST',
                json: utils.readExampleFile('./test/groupProvisioning/provisionFullGroup.json'),
                headers: {
                    'fiware-service': 'TestService',
                    'fiware-servicepath': '/testingPath'
                }
            };

        beforeEach(function(done) {
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));


            contextBrokerMock
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/unprovisionedMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/unprovisionedSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});

            request(groupCreation, function(error, response, body) {
                done();
            });
        });

        it('should send a new update context request to the Context Broker with just that attribute', function(done) {
            mqttClient.publish('/80K09H324HV8732/MQTT_UNPROVISIONED/attrs/a', '23', null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new duplicated measure arrives for an unprovisioned Device', function() {
        var groupCreation = {
                url: 'http://localhost:4041/iot/services',
                method: 'POST',
                json: utils.readExampleFile('./test/groupProvisioning/provisionFullGroup.json'),
                headers: {
                    'fiware-service': 'TestService',
                    'fiware-servicepath': '/testingPath'
                }
            };

        beforeEach(function(done) {
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));


            contextBrokerMock
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/unprovisionedMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/unprovisionedSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});

            request(groupCreation, function(error, response, body) {
                done();
            });
        });

        it('should not send a new update context request to the Context Broker', function(done) {
            mqttClient.publish('/80K09H324HV8732/MQTT_UNPROVISIONED/attrs/a', '23', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    describe('When a new non-duplicated multiple measure arrives to a Device topic with one measure', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should send a single update context request with all the attributes', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'a|23', null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new duplicated multiple measure arrives to a Device topic with one measure', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should not send a single update context request with all the attributes', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'a|23', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    describe('When a new non-duplicated multiple measure arrives to a Device topic with a faulty payload', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should silently ignore the error (without crashing)', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'notAULPayload ', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    describe('When a new duplicated multiple measure arrives to a Device topic with a faulty payload', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should silently ignore the error (without crashing)', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'notAULPayload ', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    describe('When non-duplicated single message with multiple measures arrive to a Device topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/multipleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should send one update context per measure group to the Contet Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'a|23|b|98', null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When duplicated single message with multiple measures arrive to a Device topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/multipleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should not send one update context per measure group to the Contet Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'a|23|b|98', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    describe('When a non-duplicated message with multiple measure groups arrives to a Device topic', function() {
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

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should send a two update context requests to the Context Broker one with each attribute', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'a|23#b|98', null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a duplicated message with multiple measure groups arrives to a Device topic', function() {
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

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should not send a update context requests to the Context Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'a|23#b|98', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    describe('When non-duplicated multiple groups of measures arrive, with multiple attributes, to a Device topic',
        function() {
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

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should send a two update context requests to the Context Broker one with each attribute', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'a|23|b|98#a|16|b|34', null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When duplicated multiple groups of measures arrive, with multiple attributes, to a Device topic',
        function() {
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

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should not send a two update context requests to the Context Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'a|23|b|98#a|16|b|34', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    describe('When a non-duplicated measure with a timestamp arrives with an alias to TimeInstant', function() {
        var provisionProduction = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionTimeInstant.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

        beforeEach(function(done) {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/timeInstantDuplicatedSuccess.json'))
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/timeInstantDuplicated.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/timeInstantDuplicatedSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});

            config.iota.timestamp = true;

            nock('http://localhost:8082')
                .post('/protocols')
                .reply(200, {});

            iotagentMqtt.stop(function() {
                iotagentMqtt.start(config, function(error) {
                    request(provisionProduction, function(error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function() {
            config.iota.timestamp = false;
        });

        it('should use the provided TimeInstant as the general timestamp for the measures', function(done) {
            mqttClient.publish(
                '/1234/timestampedDevice/attrs',
                'tmp|24.4|tt|2016-09-26T12:19:26.476659Z', null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a duplicated measure with a timestamp arrives with an alias to TimeInstant', function() {
        var provisionProduction = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionTimeInstant.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

        beforeEach(function(done) {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/timeInstantDuplicatedSuccess.json'))
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/timeInstantDuplicated.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/timeInstantDuplicatedSuccess.json'));

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});

            config.iota.timestamp = true;

            nock('http://localhost:8082')
                .post('/protocols')
                .reply(200, {});

            iotagentMqtt.stop(function() {
                iotagentMqtt.start(config, function(error) {
                    request(provisionProduction, function(error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function() {
            config.iota.timestamp = false;
        });

        it('should not send a update context request to the Context Broker', function(done) {
            mqttClient.publish(
                '/1234/timestampedDevice/attrs',
                'tmp|24.4|tt|2016-09-26T12:19:26.476659Z', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });
});
