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

var ulParser = require('../../lib/ulParser'),
    should = require('should');

describe('Ultralight 2.0 Parser: commands', function() {
    describe('When a command execution with multiple parameters is parsed', function() {
        it('should extract the deviceId, the command name, and the parameters', function() {
            var result = ulParser.command('weatherStation167@ping|param1=1|param2=2');

            should.exist(result);
            (typeof result).should.equal('object');
            should.exist(result.deviceId);
            result.deviceId.should.equal('weatherStation167');
            should.exist(result.command);
            result.command.should.equal('ping');
            should.exist(result.params);
            should.exist(result.params.param2);
            result.params.param2.should.equal('2');
        });
    });
    describe('When a command execution with no params and a value is parsed', function() {
        it('should extract the deviceId, the command name, and the plain text of the value', function() {
            var result = ulParser.command('weatherStation167@ping|theValue');

            should.exist(result);
            (typeof result).should.equal('object');
            should.exist(result.deviceId);
            result.deviceId.should.equal('weatherStation167');
            should.exist(result.command);
            result.command.should.equal('ping');
            should.exist(result.value);
            result.value.should.equal('theValue');
        });
    });
    describe('When a command result is parsed', function() {
        describe('should extract the deviceId, the command name, and the result', function() {
            it('should extract the deviceId, the command name, and the parameters', function() {
                var result = ulParser.result('weatherStation167@ping|Ping ok');

                should.exist(result);
                (typeof result).should.equal('object');
                should.exist(result.deviceId);
                result.deviceId.should.equal('weatherStation167');
                should.exist(result.command);
                result.command.should.equal('ping');
                should.exist(result.result);
                result.result.should.equal('Ping ok');
            });
        });
    });
});
