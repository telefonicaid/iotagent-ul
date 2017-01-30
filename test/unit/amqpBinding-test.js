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
 */

'use strict';

var iotagentMqtt = require('../../'),
    config = require('../config-test.js'),
    nock = require('nock'),
    async = require('async'),
    request = require('request'),
    utils = require('../utils'),
    iotAgentLib = require('iotagent-node-lib'),
    amqp = require('amqplib/callback_api'),
    apply = async.apply,
    contextBrokerMock,
    amqpConn,
    channel;

function startConnection(exchange, callback) {
    amqp.connect('amqp://localhost', function(err, conn) {
        amqpConn = conn;

        conn.createChannel(function(err, ch) {
            ch.assertExchange(exchange, 'topic', {});

            channel = ch;
            callback(err);
        });
    });
}

describe.only('AMQP Transport binding: measures', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDeviceAMQP1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

        async.series([
            apply(iotagentMqtt.start, config),
            apply(request, provisionOptions),
            apply(startConnection, config.amqp.exchange)
        ], done);
    });

    afterEach(function(done) {
        nock.cleanAll();

        amqpConn.close();

        async.series([
            iotAgentLib.clearAll,
            iotagentMqtt.stop
        ], done);
    });

    describe('When a new single measure arrives to a Device routing key', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should send a new update context request to the Context Broker with just that attribute', function(done) {
            channel.publish(config.amqp.exchange, '/1234/MQTT_2/attrs/a', new Buffer('23'));
            
            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 100)
        });
    });

    describe('When a new measure arrives for an unprovisioned Device', function() {
        it('should send a new update context request to the Context Broker with just that attribute');
    });

    describe('When a new multiple measure arrives to a Device routing key with one measure', function() {
        it('should send a single update context request with all the attributes');
    });

    describe('When a new multiple measure arrives to a Device routing key with a faulty payload', function() {
        it('should silently ignore the error (without crashing)');
    });

    describe('When single message with multiple measures arrive to a Device routing key', function() {
        it('should send one update context per measure group to the Contet Broker');
    });

    describe('When a message with multiple measure groups arrives to a Device routing key', function() {
        it('should send a two update context requests to the Context Broker one with each attribute');
    });
    describe('When multiple groups of measures arrive, with multiple attributes, to a Device routing key', function() {
        it('should send a two update context requests to the Context Broker one with each attribute');
    });

    describe('When a measure with a timestamp arrives with an alias to TimeInstant', function() {
        it('should use the provided TimeInstant as the general timestamp for the measures');
    });
});
