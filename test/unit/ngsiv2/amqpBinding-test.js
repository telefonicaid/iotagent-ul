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
 *
 * Modified by: Fernando Méndez, Daniel Calvo - ATOS Research & Innovation
 */

'use strict';

var iotagentUl = require('../../../'),
    config = require('./config-test.js'),
    nock = require('nock'),
    async = require('async'),
    request = require('request'),
    utils = require('../../utils'),
    iotAgentLib = require('iotagent-node-lib'),
    amqp = require('amqplib/callback_api'),
    apply = async.apply,
    contextBrokerMock,
    contextBrokerUnprovMock,
    amqpConn,
    channel;

function startConnection(exchange, callback) {
    amqp.connect(
        'amqp://localhost',
        function(err, conn) {
            amqpConn = conn;

            conn.createChannel(function(err, ch) {
                ch.assertExchange(exchange, 'topic', {});

                channel = ch;
                callback(err);
            });
        }
    );
}

describe('AMQP Transport binding: measures', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDeviceAMQP1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        async.series(
            [
                apply(iotagentUl.start, config),
                apply(request, provisionOptions),
                apply(startConnection, config.amqp.exchange)
            ],
            done
        );
    });

    afterEach(function(done) {
        nock.cleanAll();

        amqpConn.close();

        async.series([iotAgentLib.clearAll, iotagentUl.stop], done);
    });

    describe('When a new single measure arrives to a Device routing key', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });

        it('should send a new update context request to the Context Broker with just that attribute', function(done) {
            channel.publish(config.amqp.exchange, '.1234.MQTT_2.attrs.temperature', new Buffer('23'));

            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 100);
        });
    });

    describe('When a new measure arrives for an unprovisioned Device', function() {
        var groupCreation = {
            url: 'http://localhost:4061/iot/services',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/groupProvisioning/provisionFullGroupAMQP.json'),
            headers: {
                'fiware-service': 'TestService',
                'fiware-servicepath': '/testingPath'
            }
        };

        beforeEach(function(done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerUnprovMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerUnprovMock
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post(
                    '/v2/entities/SensorMachine:UL_UNPROVISIONED/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedMeasure.json')
                )
                .query({ type: 'SensorMachine' })
                .reply(204);

            request(groupCreation, function(error, response, body) {
                done();
            });
        });

        it('should send a new update context request to the Context Broker with just that attribute', function(done) {
            channel.publish(
                config.amqp.exchange,
                '.80K09H324HV8732.UL_UNPROVISIONED.attrs.temperature',
                new Buffer('23')
            );

            setTimeout(function() {
                contextBrokerUnprovMock.done();
                done();
            }, 100);
        });
    });

    describe('When a new multiple measure arrives to a Device routing key with one measure', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });

        it('should send a single update context request with all the attributes', function(done) {
            channel.publish(config.amqp.exchange, '.1234.MQTT_2.attrs', new Buffer('temperature|23'));

            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 100);
        });
    });

    describe('When a new multiple measure arrives to a Device routing key with a faulty payload', function() {
        it('should silently ignore the error (without crashing)', function(done) {
            channel.publish(config.amqp.exchange, '.1234.MQTT_2.attrs', new Buffer('notAULPayload '));

            setTimeout(function() {
                // FIXME: nothing to check in this case except expectations in log file.
                // However, currently we doen't have a mechanism to check expentations in log files,
                // so this marked for future improvement.
                done();
            }, 100);
        });
    });

    describe('When single message with multiple measures arrive to a Device routing key', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasure.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });

        it('should send one update context per measure group to the Contet Broker', function(done) {
            channel.publish(config.amqp.exchange, '.1234.MQTT_2.attrs', new Buffer('temperature|23|humidity|98'));

            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 100);
        });
    });

    describe('When a message with multiple measure groups arrives to a Device routing key', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/secondSingleMeasure.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });

        it('should send a two update context requests to the Context Broker one with each attribute', function(done) {
            channel.publish(config.amqp.exchange, '.1234.MQTT_2.attrs', new Buffer('temperature|23#humidity|98'));

            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 100);
        });
    });
    describe('When multiple groups of measures arrive, with multiple attributes, to a Device routing key', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasure.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities/Second%20UL%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/secondMultipleMeasure.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });

        it('should send a two update context requests to the Context Broker one with each attribute', function(done) {
            channel.publish(
                config.amqp.exchange,
                '.1234.MQTT_2.attrs',
                new Buffer('temperature|23|humidity|98#temperature|16|humidity|34')
            );

            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 100);
        });
    });

    describe('When a measure with a timestamp arrives with an alias to TimeInstant', function() {
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
                .post(
                    '/v2/entities/TimeInstant%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timeInstantDuplicated.json')
                )
                .query({ type: 'clock' })
                .reply(204);

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
            channel.publish(
                config.amqp.exchange,
                '.1234.timestampedDevice.attrs',
                new Buffer('tmp|24.4|tt|2016-09-26T12:19:26.476659Z')
            );

            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 100);
        });
    });
});
