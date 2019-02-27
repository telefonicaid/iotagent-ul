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
    contextBrokerMock,
    contextBrokerUnprovMock,
    iotamMock;

describe('HTTP Transport binding: measures', function() {
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

        iotamMock = nock('http://localhost:8082')
            .post('/protocols')
            .reply(200, {});

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

        config.iota.iotManager = {
            host: 'localhost',
            port: 8082,
            path: '/protocols',
            protocol: 'MQTT_UL',
            description: 'MQTT Ultralight 2.0 IoT Agent (Node.js version)'
        };

        iotagentUl.start(config, function() {
            request(provisionOptions, function(error, response, body) {
                done();
            });
        });
    });

    afterEach(function(done) {
        nock.cleanAll();

        delete config.iota.iotManager;

        async.series([iotAgentLib.clearAll, iotagentUl.stop], done);
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

    describe('When a new measure arrives for an unprovisioned Device, via HTTP GET', function() {
        var getOptions = {
                url: 'http://localhost:' + config.http.port + '/iot/d',
                method: 'GET',
                qs: {
                    i: 'MQTT_UNPROVISIONED',
                    k: '80K09H324HV8732',
                    d: 'a|23'
                }
            },
            groupCreation = {
                url: 'http://localhost:4061/iot/services',
                method: 'POST',
                json: utils.readExampleFile('./test/groupProvisioning/provisionFullGroup.json'),
                headers: {
                    'fiware-service': 'TestService',
                    'fiware-servicepath': '/testingPath'
                }
            };

        beforeEach(function(done) {
            contextBrokerUnprovMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerUnprovMock
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/unprovisionedMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/unprovisionedSuccess.json'));

            request(groupCreation, function(error, response, body) {
                done();
            });
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
                contextBrokerUnprovMock.done();
                done();
            });
        });
        it('should add a protocol to the registered devices', function(done) {
            var getDeviceOptions = {
                url: 'http://localhost:4061/iot/devices/MQTT_UNPROVISIONED',
                method: 'GET',
                headers: {
                    'fiware-service': 'TestService',
                    'fiware-servicepath': '/testingPath'
                }
            };

            request(getOptions, function(error, response, body) {
                request(getDeviceOptions, function(error, response, body) {
                    var parsedBody;

                    should.not.exist(error);

                    parsedBody = JSON.parse(body);

                    response.statusCode.should.equal(200);
                    should.exist(parsedBody.protocol);
                    parsedBody.protocol.should.equal('MQTT_UL');
                    done();
                });
            });
        });
        it('should add a transport to the registered devices', function(done) {
            var getDeviceOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices/MQTT_UNPROVISIONED',
                method: 'GET',
                headers: {
                    'fiware-service': 'TestService',
                    'fiware-servicepath': '/testingPath'
                }
            };

            request(getOptions, function(error, response, body) {
                request(getDeviceOptions, function(error, response, body) {
                    var parsedBody;

                    should.not.exist(error);

                    parsedBody = JSON.parse(body);

                    response.statusCode.should.equal(200);
                    should.exist(parsedBody.transport);
                    parsedBody.transport.should.equal('HTTP');
                    done();
                });
            });
        });
    });

    describe('When a measure with timestamp arrives for a Device, via HTTP GET', function() {
        var getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'GET',
            qs: {
                i: 'MQTT_2',
                k: '1234',
                t: '2016-05-30T16:25:22.304Z',
                d: 'a|23'
            }
        };

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/timestampMeasure.json'))
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

    describe('When a request arrives to the IoT Agent without Content-type header', function() {
        var postOptions = {
                url: 'http://localhost:' + config.http.port + '/iot/d',
                method: 'POST',
                qs: {
                    i: 'urn:x-iot:smartsantander:u7jcfa:fixed:t311',
                    k: '1234',
                    t: '2016-05-11T10:12:26.476659Z'
                },
                body: 'bat|75.0'
            },
            provisionOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionDeviceProduction.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

        beforeEach(function(done) {
            nock.cleanAll();

            contextBrokerMock = nock('http://192.168.1.1:1026')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerMock
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            request(provisionOptions, function(error, response, body) {
                done();
            });
        });

        it('should end up with a 200OK status code', function(done) {
            request(postOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);

                done();
            });
        });
    });

    describe('When a measure arrives to the IoTA for a device belonging to a configuration', function() {
        var getOptions = {
                url: 'http://localhost:' + config.http.port + '/iot/d',
                method: 'GET',
                qs: {
                    i: 'MQTT_2',
                    k: '80K09H324HV8732',
                    d: 'c|23'
                }
            },
            groupCreation = {
                url: 'http://localhost:4061/iot/services',
                method: 'POST',
                json: utils.readExampleFile('./test/groupProvisioning/provisionAliasGroup.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

        beforeEach(function(done) {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v1/updateContext',
                    utils.readExampleFile('./test/contextRequests/unprovisionedAliasMeasure.json')
                )
                .reply(200, utils.readExampleFile('./test/contextResponses/unprovisionedAliasSuccess.json'));

            request(groupCreation, function(error, response, body) {
                done();
            });
        });

        it('should use the configuration values for the attributes alias not included in the device', function(done) {
            request(getOptions, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When there is a conflict between configuration and devices', function() {
        var getOptions = {
                url: 'http://localhost:' + config.http.port + '/iot/d',
                method: 'GET',
                qs: {
                    i: 'MQTT_3',
                    k: '80K09H324HV8732',
                    d: 'c|23'
                }
            },
            deviceCreation = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice2.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            },
            groupCreation = {
                url: 'http://localhost:4061/iot/services',
                method: 'POST',
                json: utils.readExampleFile('./test/groupProvisioning/provisionAliasGroup.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

        beforeEach(function(done) {
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v1/updateContext',
                    utils.readExampleFile('./test/contextRequests/unprovisionedAliasMeasure2.json')
                )
                .reply(200, utils.readExampleFile('./test/contextResponses/unprovisionedAliasSuccess.json'));

            request(groupCreation, function(error, response, body) {
                request(deviceCreation, function(error, response, body) {
                    done();
                });
            });
        });

        it('should use the device preference', function(done) {
            request(getOptions, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a real production request arrives to the IoTA', function() {
        var postOptions = {
                url: 'http://localhost:' + config.http.port + '/iot/d',
                method: 'POST',
                qs: {
                    i: 'urn:x-iot:smartsantander:u7jcfa:fixed:t311',
                    k: '1234',
                    t: '2016-05-11T10:12:26.476659Z'
                },
                headers: {
                    'Content-type': 'text/plain'
                },
                body:
                    'tmp|24.4#hum|58.0#aco|0.1#apa|0.38#ao3|121.0#' +
                    'no2|115.0#pla|43.4551#plo|-3.83381#poa|28.0#spi|0.0#dia|0.0#mit|1492.0#pos|43.4630608,-3.8345434'
            },
            provisionProduction = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionDeviceProduction.json'),
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
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'))
                .post('/v1/updateContext')
                .times(12)
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'))
                .post('/v1/updateContext', function(body) {
                    var metadatas = 0;

                    for (var i = 0; i < body.contextElements[0].attributes.length; i++) {
                        if (body.contextElements[0].attributes[i].metadatas) {
                            metadatas += body.contextElements[0].attributes[i].metadatas.length;
                        }
                    }
                    return metadatas === body.contextElements[0].attributes.length - 1;
                })
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            config.iota.timestamp = true;

            nock('http://localhost:8082')
                .post('/protocols')
                .reply(200, {});

            iotagentUl.stop(function() {
                iotagentUl.start(config, function(error) {
                    request(provisionProduction, function(error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function() {
            config.iota.timestamp = false;
        });

        it('should end up with a 200 OK status code', function(done) {
            request(postOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });

        it('should send all the requests to the CB', function(done) {
            request(postOptions, function(error, response, body) {
                should.not.exist(error);
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure with a timestamp arrives with an alias to TimeInstant', function() {
        var timeInstantRequest = {
                url: 'http://localhost:' + config.http.port + '/iot/d',
                method: 'POST',
                qs: {
                    i: 'timestampedDevice',
                    k: '1234'
                },
                headers: {
                    'Content-type': 'text/plain'
                },
                body: 'tmp|24.4|tt|2016-09-26T12:19:26.476659Z'
            },
            provisionProduction = {
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

            config.iota.timestamp = true;

            nock('http://localhost:8082')
                .post('/protocols')
                .reply(200, {});

            iotagentUl.stop(function() {
                iotagentUl.start(config, function(error) {
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
            request(timeInstantRequest, function(error, response, body) {
                should.not.exist(error);
                contextBrokerMock.done();
                done();
            });
        });
    });
});
