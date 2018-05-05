'use strict';
/*
 * Copyright 2018 Nobuyuki Matsui
 *
 * This file is extension of iotagent-ul
 * call 'extension' REST API when receiving message from mqtt if 'config.mqtt.extensions' is set
 */

var async = require('async');
var request = require('request');
var config = require('../configService');

function execute(callback) {
    return function(topic, message) {
        async.eachSeries(config.getConfig().mqtt.extensions, function(extension, next) {
            if (extension.providerUrl && extension.name) {
                request.post({
                    uri: extension.providerUrl,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    json: {
                        'payload': topic + '::' + message.toString()
                    },
                    timeout: 500
                }).on('response', function(response) {
                    if (response.statusCode === 200) {
                        next(null);
                    } else {
                        next(extension.name + ' returned statusCode = ' + String(response.statusCode));
                    }
                }).on('error', function(error) {
                    next(error);
                });
            } else {
                next('invalid config.mqtt.extension');
            }
        }, function(error) {
            if (!error) {
                callback(topic, message);
            } else {
                config.getLogger().info(error);
            }
        });
    };
}
exports.execute = execute;
