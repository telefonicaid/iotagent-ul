/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-ul
 *
 * fiware-iotagent-lib is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * fiware-iotagent-lib is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with fiware-iotagent-lib.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */
'use strict';

var config = require('../../lib/configService'),
    iotAgentConfig = require('../config-test.js'),
    fs = require('fs'),
    sinon = require('sinon');

describe('Startup tests', function() {
    describe('When the MQTT transport is started with environment variables', function() {
        beforeEach(function() {
            sinon.stub(fs, 'statSync');
            process.env.IOTA_MQTT_HOST = '127.0.0.1';
            process.env.IOTA_MQTT_PORT = '1883';
            process.env.IOTA_MQTT_USERNAME = 'usermqtt';
            process.env.IOTA_MQTT_PASSWORD = 'passmqtt';
            process.env.IOTA_MQTT_PROTOCOL = 'xxx';
            process.env.IOTA_MQTT_CA = '/mqtt/xxx/ca';
            process.env.IOTA_MQTT_CERT = '/mqtt/xxx/cert.pem';
            process.env.IOTA_MQTT_KEY = '/mqtt/xxx/key.pem';
            process.env.IOTA_MQTT_REJECT_UNAUTHORIZED = 'true';
            process.env.IOTA_MQTT_QOS = '0';
            process.env.IOTA_MQTT_RETAIN = 'false';
            process.env.IOTA_MQTT_RETRIES = '2';
            process.env.IOTA_MQTT_RETRY_TIME = '5';
            process.env.IOTA_MQTT_KEEPALIVE = '0';
        });

        afterEach(function() {
            fs.statSync.restore();
            delete process.env.IOTA_MQTT_PROTOCOL;
            delete process.env.IOTA_MQTT_HOST;
            delete process.env.IOTA_MQTT_PORT;
            delete process.env.IOTA_MQTT_CA;
            delete process.env.IOTA_MQTT_CERT;
            delete process.env.IOTA_MQTT_KEY;
            delete process.env.IOTA_MQTT_REJECT_UNAUTHORIZED;
            delete process.env.IOTA_MQTT_USERNAME;
            delete process.env.IOTA_MQTT_PASSWORD;
            delete process.env.IOTA_MQTT_QOS;
            delete process.env.IOTA_MQTT_RETAIN;
            delete process.env.IOTA_MQTT_RETRIES;
            delete process.env.IOTA_MQTT_RETRY_TIME;
            delete process.env.IOTA_MQTT_KEEPALIVE;
        });

        it('should load the MQTT environment variables in the internal configuration', function(done) {
            config.setConfig(iotAgentConfig);
            config.getConfig().mqtt.host.should.equal('127.0.0.1');
            config.getConfig().mqtt.port.should.equal('1883');
            config.getConfig().mqtt.username.should.equal('usermqtt');
            config.getConfig().mqtt.password.should.equal('passmqtt');
            config.getConfig().mqtt.ca.should.equal('/mqtt/xxx/ca');
            config.getConfig().mqtt.cert.should.equal('/mqtt/xxx/cert.pem');
            config.getConfig().mqtt.key.should.equal('/mqtt/xxx/key.pem');
            config.getConfig().mqtt.rejectUnauthorized.should.equal(true);
            config.getConfig().mqtt.qos.should.equal('0');
            config.getConfig().mqtt.retain.should.equal(false);
            config.getConfig().mqtt.retries.should.equal('2');
            config.getConfig().mqtt.retryTime.should.equal('5');
            config.getConfig().mqtt.keepalive.should.equal('0');
            done();
        });
    });

    describe('When the AMQP transport is started with environment variables', function() {
        beforeEach(function() {
            process.env.IOTA_AMQP_HOST = 'localhost';
            process.env.IOTA_AMQP_PORT = '9090';
            process.env.IOTA_AMQP_USERNAME = 'useramqp';
            process.env.IOTA_AMQP_PASSWORD = 'passamqp';
            process.env.IOTA_AMQP_EXCHANGE = 'xxx';
            process.env.IOTA_AMQP_QUEUE = '0';
            process.env.IOTA_AMQP_DURABLE = 'true';
            process.env.IOTA_AMQP_RETRIES = '0';
            process.env.IOTA_AMQP_RETRY_TIME = '5';
        });

        afterEach(function() {
            delete process.env.IOTA_AMQP_HOST;
            delete process.env.IOTA_AMQP_PORT;
            delete process.env.IOTA_AMQP_USERNAME;
            delete process.env.IOTA_AMQP_PASSWORD;
            delete process.env.IOTA_AMQP_EXCHANGE;
            delete process.env.IOTA_AMQP_QUEUE;
            delete process.env.IOTA_AMQP_DURABLE;
            delete process.env.IOTA_AMQP_RETRIES;
            delete process.env.IOTA_AMQP_RETRY_TIME;
        });

        it('should load the AMQP environment variables in the internal configuration', function(done) {
            config.setConfig(iotAgentConfig);
            config.getConfig().amqp.host.should.equal('localhost');
            config.getConfig().amqp.port.should.equal('9090');
            config.getConfig().amqp.username.should.equal('useramqp');
            config.getConfig().amqp.password.should.equal('passamqp');
            config.getConfig().amqp.exchange.should.equal('xxx');
            config.getConfig().amqp.queue.should.equal('0');
            config.getConfig().amqp.options.durable.should.equal(true);
            config.getConfig().amqp.retries.should.equal('0');
            config.getConfig().amqp.retryTime.should.equal('5');
            done();
        });
    });

    describe('When the HTTP transport is started with environment variables', function() {
        beforeEach(function() {
            sinon.stub(fs, 'statSync');
            process.env.IOTA_HTTP_HOST = 'localhost';
            process.env.IOTA_HTTP_PORT = '2222';
            process.env.IOTA_HTTP_TIMEOUT = '5';
            process.env.IOTA_HTTP_KEY = '/http/bbb/key.pem';
            process.env.IOTA_HTTP_CERT = '/http/bbb/cert.pem';
        });

        afterEach(function() {
            fs.statSync.restore();
            delete process.env.IOTA_HTTP_HOST;
            delete process.env.IOTA_HTTP_PORT;
            delete process.env.IOTA_HTTP_TIMEOUT;
            delete process.env.IOTA_HTTP_KEY;
            delete process.env.IOTA_HTTP_CERT;
        });

        it('should load the HTTP environment variables in the internal configuration', function(done) {
            config.setConfig(iotAgentConfig);
            config.getConfig().http.host.should.equal('localhost');
            config.getConfig().http.port.should.equal('2222');
            config.getConfig().http.timeout.should.equal('5');
            config.getConfig().http.key.should.equal('/http/bbb/key.pem');
            config.getConfig().http.cert.should.equal('/http/bbb/cert.pem');
            done();
        });
    });
});
