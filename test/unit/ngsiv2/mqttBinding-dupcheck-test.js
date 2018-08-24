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
 * Modified by: Fernando Mendez Requena  - ATOS Research & Innovation
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[iot_support@tid.es]
 *
 * Modified by: Fernando Méndez, Daniel Calvo - ATOS Research & Innovation
 *
 * copy "mqttBinding-test" and edit to test duplication message checker by Nobuyuki Matsui<nobuyuki.matsui@gmail.com>
 */

'use strict';

var iotagentUL = require('../../../'),
    mqtt = require('mqtt'),
    config = require('./config-dupcheck-test.js'),
    nock = require('nock'),
    iotAgentLib = require('iotagent-node-lib'),
    async = require('async'),
    request = require('request'),
    utils = require('../../utils'),
    contextBrokerMock,
    dupCheckerMock,
    mqttClient;


describe('MQTT Transport binding with duplication checker: measures', function() {

    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDeviceMQTT.json'),
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

        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        dupCheckerMock = nock('http://192.168.1.2:5000')
            .post('/distinct/')
            .reply(200, {result: 'success'});

        iotagentUL.start(config, function() {
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
            iotagentUL.stop
        ], done);
    });

    describe('When a new non-duplicateed single measure arrives to a Device topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should send a new update context request to the Context Broker with just that attribute', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs/temperature', '23', null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new duplicateed single measure arrives to a Device topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should not send a new update context request to the Context Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs/temperature', '23', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    describe('When new non-duplicated multiple different format types measures arrives for a Device', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasuresTypeJson.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should send a new update context request to the Context Broker with just this attribute', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs',
                'luminosity|10|humidity|32|pollution|43.4|' +
                'temperature|10|enabled|true|alive|null|tags' +
                '|["iot","device"]|configuration|{"firmware":' +
                '{"version":"1.1.0","hash":"cf23df2207d99a74fbe169e3eba035e633b65d94" } }',
                 null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When new duplicated multiple different format types measures arrives for a Device', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasuresTypeJson.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should not send a new update context request to the Context Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs',
                'luminosity|10|humidity|32|pollution|43.4|' +
                'temperature|10|enabled|true|alive|null|tags' +
                '|["iot","device"]|configuration|{"firmware":' +
                '{"version":"1.1.0","hash":"cf23df2207d99a74fbe169e3eba035e633b65d94" } }',
                 null, function(error) {
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
                json: utils.readExampleFile('./test/unit/ngsiv2/groupProvisioning/provisionFullGroup.json'),
                headers: {
                    'fiware-service': 'TestService',
                    'fiware-servicepath': '/testingPath'
                }
            };

        beforeEach(function(done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v2/entities?options=upsert')
                .reply(204);


            contextBrokerMock
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v2/entities/SensorMachine:UL_UNPROVISIONED/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});

            request(groupCreation, function(error, response, body) {
                done();
            });
        });

        it('should send a new update context request to the Context Broker with just that attribute', function(done) {
            mqttClient.publish('/80K09H324HV8732/UL_UNPROVISIONED/attrs/temperature', '23', null, function(error) {
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
                json: utils.readExampleFile('./test/unit/ngsiv2/groupProvisioning/provisionFullGroup.json'),
                headers: {
                    'fiware-service': 'TestService',
                    'fiware-servicepath': '/testingPath'
                }
            };

        beforeEach(function(done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v2/entities?options=upsert')
                .reply(204);


            contextBrokerMock
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v2/entities/SensorMachine:UL_UNPROVISIONED/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});

            request(groupCreation, function(error, response, body) {
                done();
            });
        });

        it('should not send a new update context request to the Context Broker', function(done) {
            mqttClient.publish('/80K09H324HV8732/UL_UNPROVISIONED/attrs/temperature', '23', null, function(error) {
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
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should send a single update context request with all the attributes', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'temperature|23', null, function(error) {
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
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should not send a single update context request with all the attributes', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'temperature|23', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    describe('When a new non-duplicated multiple measure arrives to a Device topic with a faulty payload', function() {
        beforeEach(function() {
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
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should send one update context per measure group to the Contet Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'temperature|23|humidity|98', null, function(error) {
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
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should not send one update context per measure group to the Contet Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'temperature|23|humidity|98', null, function(error) {
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
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json'))
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20UL%20Device/attrs',
                     utils.readExampleFile('./test/unit/ngsiv2/contextRequests/secondSingleMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should send a two update context requests to the Context Broker one with each attribute', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'temperature|23#humidity|98', null, function(error) {
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
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json'))
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20UL%20Device/attrs',
                     utils.readExampleFile('./test/unit/ngsiv2/contextRequests/secondSingleMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should not send a two update context requests to the Context Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'temperature|23#humidity|98', null, function(error) {
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
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasure.json'))
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/secondMultipleMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});
        });

        it('should send a two update context requests to the Context Broker one with each attribute', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'temperature|23|humidity|' +
                '98#temperature|16|' +
                'humidity|34', null, function(error) {
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
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasure.json'))
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/secondMultipleMeasure.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});
        });

        it('should not send a two update context requests to the Context Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', 'temperature|23|humidity|' +
                '98#temperature|16|' +
                'humidity|34', null, function(error) {
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
                 json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionTimeInstant.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

        beforeEach(function(done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204)
                .post('/v2/entities/TimeInstant%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timeInstantDuplicated.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(200, {result: 'success'});

            config.iota.timestamp = true;

            nock('http://localhost:8082')
                .post('/protocols')
                .reply(200, {});

            iotagentUL.stop(function() {
                iotagentUL.start(config, function(error) {
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
                 json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionTimeInstant.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

        beforeEach(function(done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204)
                .post('/v2/entities/TimeInstant%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timeInstantDuplicated.json'))
                .reply(204);

            dupCheckerMock
                .post('/distinct/')
                .reply(409, {result: 'duplicate'});

            config.iota.timestamp = true;

            nock('http://localhost:8082')
                .post('/protocols')
                .reply(200, {});

            iotagentUL.stop(function() {
                iotagentUL.start(config, function(error) {
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
