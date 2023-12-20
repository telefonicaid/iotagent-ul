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
 * Modified by: Fernando Méndez, Daniel Calvo - ATOS Research & Innovation
 */

/* eslint-disable no-unused-vars */
/* eslint-disable no-prototype-builtins */

const iotagentUl = require('../../../');
const config = require('./config-test.js');
const nock = require('nock');
const iotAgentLib = require('iotagent-node-lib');
const should = require('should');
const async = require('async');

const utils = require('../../utils');
const request = utils.request;
const requestText = utils.requestText;
let contextBrokerUnprovMock;
let contextBrokerMock;
let iotamMock;

describe('HTTP Transport binding: measures', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDevice1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        iotamMock = nock('http://localhost:8082').post('/protocols').reply(200, {});

        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://192.168.1.1:1026');

        config.iota.iotManager = {
            host: 'localhost',
            port: 8082,
            path: '/protocols',
            protocol: 'HTTP_UL',
            description: 'HTTP Ultralight 2.0 IoT Agent (Node.js version)'
        };

        iotagentUl.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        nock.cleanAll();

        delete config.iota.iotManager;

        async.series([iotAgentLib.clearAll, iotagentUl.stop], done);
    });

    describe('When a new single measure arrives for a Device, via HTTP GET', function () {
        const getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'GET',
            qs: {
                i: 'HTTP_2',
                k: '1234',
                d: 'temperature|23'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json')
                )
                .reply(204);
        });

        it('should end up with a 200OK status code', function (done) {
            requestText(getOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a new update context request to the Context Broker with just that attribute', function (done) {
            requestText(getOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When new multiple differents format types measures arrives for a Device, via HTTP POST', function () {
        const getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'HTTP_2',
                k: '1234',
                d:
                    'luminosity|10|humidity|32|' +
                    'pollution|43.4|temperature|10|' +
                    'enabled|true|alive|None|tags|["iot","device"]|' +
                    'configuration|{"firmware":{"version":"1.1.0","hash":"cf23df2207d99a74fbe169e3eba035e633b65d94" } }'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasuresTypeJson.json')
                )
                .reply(204);
        });

        it('should end up with a 200OK status code', function (done) {
            requestText(getOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a new update context request to the Context Broker with just that attribute', function (done) {
            requestText(getOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a new measure arrives for an unprovisioned Device, via HTTP GET', function () {
        const getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'GET',
            qs: {
                i: 'UL_UNPROVISIONED',
                k: '80K09H324HV8732',
                d: 'temperature|23'
            }
        };
        const groupCreation = {
            url: 'http://localhost:4061/iot/services',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/groupProvisioning/provisionFullGroup.json'),
            headers: {
                'fiware-service': 'TestService',
                'fiware-servicepath': '/testingPath'
            }
        };

        beforeEach(function (done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerUnprovMock = nock('http://192.168.1.1:1026');

            contextBrokerUnprovMock
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedMeasure.json')
                )
                .reply(204);

            request(groupCreation, function (error, response, body) {
                done();
            });
        });

        it('should end up with a 200OK status code', function (done) {
            requestText(getOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a new update context request to the Context Broker with just that attribute', function (done) {
            requestText(getOptions, function (error, response, body) {
                contextBrokerUnprovMock.done();
                done();
            });
        });

        it('should add a protocol to the registered devices', function (done) {
            const getDeviceOptions = {
                url: 'http://localhost:4061/iot/devices/UL_UNPROVISIONED',
                method: 'GET',
                headers: {
                    'fiware-service': 'TestService',
                    'fiware-servicepath': '/testingPath'
                }
            };

            requestText(getOptions, function (error, response, body) {
                request(getDeviceOptions, function (error, response, body) {
                    should.not.exist(error);

                    response.statusCode.should.equal(200);
                    should.exist(body.protocol);
                    body.protocol.should.equal('HTTP_UL');
                    done();
                });
            });
        });
        it('should not add a transport to the registered devices', function (done) {
            const getDeviceOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices/UL_UNPROVISIONED',
                method: 'GET',
                headers: {
                    'fiware-service': 'TestService',
                    'fiware-servicepath': '/testingPath'
                }
            };

            requestText(getOptions, function (error, response, body) {
                request(getDeviceOptions, function (error, response, body) {
                    should.not.exist(error);
                    response.statusCode.should.equal(200);
                    should.not.exist(body.transport);
                    done();
                });
            });
        });
    });

    describe('When a measure with timestamp arrives for a Device, via HTTP GET', function () {
        const getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'GET',
            qs: {
                i: 'HTTP_2',
                k: '1234',
                t: '2016-05-30T16:25:22Z',
                d: 'temperature|23'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timestampMeasure.json')
                )
                .reply(204);
        });

        it('should end up with a 200OK status code', function (done) {
            requestText(getOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a new update context request to the Context Broker with just that attribute', function (done) {
            requestText(getOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When multiple mesasures arrive for a device via HTTP GET', function () {
        const getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'GET',
            qs: {
                i: 'HTTP_2',
                k: '1234',
                d: 'temperature|23|humidity|98'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasure.json')
                )
                .reply(204);
        });

        it('should end up with a 200OK status code', function (done) {
            requestText(getOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a new update context request to the Context Broker with those attributes', function (done) {
            requestText(getOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a new single measure arrives for a Device, via HTTP POST', function () {
        const getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'HTTP_2',
                k: '1234'
            },
            headers: {
                'Content-type': 'text/plain'
            },
            body: 'temperature|23'
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json')
                )
                .reply(204);
        });

        it('should end up with a 200OK status code', function (done) {
            requestText(getOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a new update context request to the Context Broker with just that attribute', function (done) {
            requestText(getOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When multiple groups of measures arrive, via HTTP POST', function () {
        const getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'HTTP_2',
                k: '1234'
            },
            headers: {
                'Content-type': 'text/plain'
            },
            body: 'temperature|23#humidity|98'
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json')
                )
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/secondSingleMeasure.json')
                )
                .reply(204);
        });

        it('should end up with a 200OK status code', function (done) {
            requestText(getOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a two update context requests to the Context Broker one with each attribute', function (done) {
            requestText(getOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When multiple groups of measures arrive, with multiple attributes, via HTTP POST', function () {
        const getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'HTTP_2',
                k: '1234'
            },
            headers: {
                'Content-type': 'text/plain'
            },
            body: 'temperature|23|humidity|98#temperature|16|humidity|34'
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasure.json')
                )
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/secondMultipleMeasure.json')
                )
                .reply(204);
        });

        it('should end up with a 200OK status code', function (done) {
            requestText(getOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should send a two update context requests to the Context Broker one with each attribute', function (done) {
            requestText(getOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a request arrives to the IoT Agent without Content-type header', function () {
        const postOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'urn:x-iot:smartsantander:u7jcfa:fixed:t311',
                k: '1234',
                t: '2016-05-11T10:12:26.476659Z'
            },
            body: 'bat|75.0'
        };
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDeviceProduction.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            nock.cleanAll();
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock
                .post('/v2/entities?options=upsert')
                .reply(204)
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasureProduction.json')
                )
                .reply(204);

            request(provisionOptions, function (error, response, body) {
                done();
            });
        });

        it('should end up with a 200OK status code', function (done) {
            request(postOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);

                done();
            });
        });
    });

    describe('When a measure arrives to the IoTA for a device belonging to a configuration', function () {
        const getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'HTTP_2',
                k: '80K09H324HV8732',
                d: 'Correlation|23'
            }
        };
        const groupCreation = {
            url: 'http://localhost:4061/iot/services',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/groupProvisioning/provisionAliasGroup.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedAliasMeasure.json')
                )
                .reply(204);

            request(groupCreation, function (error, response, body) {
                done();
            });
        });

        it('should use the configuration values for the attributes alias not included in the device', function (done) {
            requestText(getOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When there is a conflict between configuration and devices', function () {
        const getOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'HTTP_2',
                k: '80K09H324HV8732',
                d: 'Correlation|23'
            }
        };
        const deviceCreation = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDevice2.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };
        const groupCreation = {
            url: 'http://localhost:4061/iot/services',
            method: 'POST',
            json: utils.readExampleFile('./test/groupProvisioning/provisionAliasGroup.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedAliasMeasure2.json')
                )
                .reply(204);

            request(groupCreation, function (error, response, body) {
                request(deviceCreation, function (error, response, body) {
                    done();
                });
            });
        });

        it('should use the device preference', function (done) {
            requestText(getOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a real production request arrives to the IoTA', function () {
        const postOptions = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'urn:x-iot:smartsantander:u7jcfa:fixed:t311',
                k: '1234'
            },
            headers: {
                'Content-type': 'text/plain'
            },
            body:
                'tmp|24.4#hum|58.0#aco|0.1#apa|0.38#ao3|121.0#' +
                'no2|115.0#pla|43.4551#plo|-3.83381#poa|28.0#spi|0.0#dia|0.0#mit|1492.0#pos|43.4630608,-3.8345434'
        };
        const provisionProduction = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDeviceProduction.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                // Note: The expected body payload is not set explicitly since this mock will be used to
                // intercept requests from the IOTA to the CB for each one of the different observations.
                // Therefore, instead of introducing 13 different mocks, we have decided to have a single one
                // and just check the structure of the payload programmatically.
                .post('/v2/entities?options=upsert', function (body) {
                    let i = 0;
                    let attributes = 0;

                    for (const attribute in body) {
                        // checks that all attributes has metadata
                        if (body.hasOwnProperty(attribute)) {
                            attributes++;
                            for (const metadata in body[attribute].metadata) {
                                if (body[attribute].metadata.hasOwnProperty(metadata)) {
                                    i++;
                                }
                            }
                        }
                    }
                    return i === attributes - 1 - 2;
                })
                .times(13)
                .reply(204);

            config.iota.timestamp = true; // forces to add timestamp att and  metadata with timeinstant to all attributes

            nock('http://localhost:8082').post('/protocols').reply(200, {});

            iotagentUl.stop(function () {
                iotagentUl.start(config, function (error) {
                    request(provisionProduction, function (error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function () {
            config.iota.timestamp = false;
        });

        it('should end up with a 200 OK status code', function (done) {
            request(postOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);

                done();
            });
        });

        it('should send all the requests to the CB', function (done) {
            request(postOptions, function (error, response, body) {
                should.not.exist(error);
                contextBrokerMock.done();

                done();
            });
        });
    });

    describe('When a measure with a timestamp arrives with an alias to TimeInstant', function () {
        const timeInstantRequest = {
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
        };
        const provisionProduction = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionTimeInstant.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timeInstantDuplicated.json')
                )
                .reply(204);

            nock('http://localhost:8082').post('/protocols').reply(200, {});

            iotagentUl.stop(function () {
                iotagentUl.start(config, function (error) {
                    request(provisionProduction, function (error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function () {
            config.iota.timestamp = false;
        });

        it('should use the provided TimeInstant as the general timestamp for the measures', function (done) {
            request(timeInstantRequest, function (error, response, body) {
                should.not.exist(error);
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a POST measure arrives with a TimeInstant attribute in the body for a device with explicitAttrs:false', function () {
        const timeInstantRequest = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'timestampedDevice',
                k: '1234'
            },
            headers: {
                'Content-type': 'text/plain'
            },
            body: 'tmp|24.4|humidity|32|tt|2020-06-14T12:19:26.476659Z'
        };
        const provisionProduction = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDeviceTimeinstant.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timeInstantMeasures.json')
                )
                .reply(204);

            nock('http://localhost:8082').post('/protocols').reply(200, {});

            iotagentUl.stop(function () {
                iotagentUl.start(config, function (error) {
                    request(provisionProduction, function (error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function () {
            config.iota.timestamp = false;
        });

        it('should use the provided TimeInstant as the general timestamp for the measures', function (done) {
            request(timeInstantRequest, function (error, response, body) {
                should.not.exist(error);
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a POST measure arrives with a TimeInstant attribute in the body for a device with explicitAttrs:true', function () {
        const timeInstantRequest = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'timestampedDevice',
                k: '1234'
            },
            headers: {
                'Content-type': 'text/plain'
            },
            body: 'tmp|24.4|humidity|32|tt|2020-06-14T12:19:26.476659Z'
        };
        const provisionProduction = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDeviceTimeinstant2.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timeInstantMeasures2.json')
                )
                .reply(204);

            nock('http://localhost:8082').post('/protocols').reply(200, {});

            iotagentUl.stop(function () {
                iotagentUl.start(config, function (error) {
                    request(provisionProduction, function (error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function () {
            config.iota.timestamp = false;
        });

        it('should use the provided TimeInstant as the general timestamp for the measures', function (done) {
            request(timeInstantRequest, function (error, response, body) {
                should.not.exist(error);
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a POST measure arrives with a TimeInstant query parameter in the body for a device with explicitAttrs:false', function () {
        const timeInstantRequest = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'timestampedDevice',
                k: '1234',
                d: 'tmp|24.4|humidity|32|tt|2020-06-14T12:19:26.476659Z'
            },
            headers: {
                'Content-type': 'text/plain'
            }
        };
        const provisionProduction = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDeviceTimeinstant.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timeInstantMeasures.json')
                )
                .reply(204);

            nock('http://localhost:8082').post('/protocols').reply(200, {});

            iotagentUl.stop(function () {
                iotagentUl.start(config, function (error) {
                    request(provisionProduction, function (error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function () {
            config.iota.timestamp = false;
        });

        it('should use the provided TimeInstant as the general timestamp for the measures', function (done) {
            request(timeInstantRequest, function (error, response, body) {
                should.not.exist(error);
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a POST measure arrives with a TimeInstant query parameter in the body for a device with explicitAttrs:true', function () {
        const timeInstantRequest = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            qs: {
                i: 'timestampedDevice',
                k: '1234',
                d: 'tmp|24.4|humidity|32|tt|2020-06-14T12:19:26.476659Z'
            },
            headers: {
                'Content-type': 'text/plain'
            }
        };
        const provisionProduction = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDeviceTimeinstant2.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timeInstantMeasures2.json')
                )
                .reply(204);

            nock('http://localhost:8082').post('/protocols').reply(200, {});

            iotagentUl.stop(function () {
                iotagentUl.start(config, function (error) {
                    request(provisionProduction, function (error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function () {
            config.iota.timestamp = false;
        });

        it('should use the provided TimeInstant as the general timestamp for the measures', function (done) {
            request(timeInstantRequest, function (error, response, body) {
                should.not.exist(error);
                contextBrokerMock.done();
                done();
            });
        });
    });
});
