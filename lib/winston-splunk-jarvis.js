var util = require('util');
var winston = require('winston');
var stream = require('stream');
var https = require('https');
var url = require('url');
var dgram = require('dgram');
var underscore = require('underscore');
//var request = require('request');

var Splunk = exports.Splunk = winston.transports.Splunk = function (options) {
    this.name = 'splunk';
    this.level = options.level || 'info';

    this.splunkProtocol = options.splunkProtocol || 'https';
    this.splunkHost = options.splunkHost || 'localhost';
    this.splunkPort = options.splunkPort || 8089;
    this.splunkHostname = options.splunkHostname || require('os').hostname();
    this.splunkSequence = 0;
    this.splunkSourcetype = options.splunkSourcetype || 'json_predefined_timestamp';
    this.splunkEndpoint = options.splunkEndpoint || '/services/receivers/stream';
    this.splunkIndex = options.splunkIndex || 'jarvis';

    if (this.splunkProtocol === 'https') {
        // HTTPS
        this.httpsQueryParams = { 
            sourcetype: this.splunkSourcetype,
            host: this.splunkHostname,
            index: this.splunkIndex
        };

        var credentials = new Buffer('xxx:yyy').toString('base64');

        this.httpsRequestOptions = {
            method: 'POST',
            headers: {
                'Connection': 'keep-alive',
                'Authorization': 'Basic ' + credentials 
            },
            hostname: this.splunkHost,
            port: 8089,
            path: '/services/receivers/stream' + url.format({query: this.httpsQueryParams}),
            rejectUnauthorized: false
        };      

        this.log = this.logHttps;
    } else {
        this.udpClient = dgram.createSocket('udp4');
        this.udpClient.on('error', function (err) { 
            // Handle any suprise errors
            console.log(err);
            util.error(err); 
        });       

        this.log = this.logUdp; 
    }
};

util.inherits(Splunk, winston.Transport);

Splunk.prototype.logUdp = function (level, msg, meta, callback) {
    var self = this;

    //var t = meta.t || new Date();
    var message = {
        //timestamp: t.toISOString(),
        //source: this.splunkSource,
        sourcetype: this.splunkSourcetype,
        host: this.splunkHostname,
        index: this.splunkIndex,
        level: level,
        logger: meta.logger,
        'event': msg.split(' ')[0]
    };
    underscore.defaults(message, meta);

    if (message.timestamp) {
        message.timestamp = message.timestamp.toISOString();
    } else {
        message.timestamp = new Date().toISOString();
    }

    var jsonMessage = new Buffer(JSON.stringify(message));
    
    this.udpClient.send(jsonMessage, 0, jsonMessage.length, self.splunkPort, self.splunkHost, function (err, bytes) {
        console.log(err);
        console.log(bytes);
    
        if (err) {
            callback(err, null);
        } else {
            callback(null, true);
        }
    });
};

Splunk.prototype.logHttps = function (level, msg, meta, callback) {
    var self = this;

    //console.log('Hit!');

    //var t = meta.t || new Date();
    var message = {
        //timestamp: t.toISOString(),
        //level: level,
        //context: meta.logger,
        'event': msg.split(' ')[0]
    };
    underscore.defaults(message, meta);

    if (message.timestamp) {
        message.timestamp = message.timestamp.toISOString();
    } else {
        message.timestamp = new Date().toISOString();
    }


    var req = https.request(self.httpsRequestOptions, function(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
            console.log('statusCode: ' + res.statusCode);
        }
        return callback(null, true);
    });
    req.on('error', function(err) { 
        console.log(err);
        return callback(err, false); 
    });
    req.write(JSON.stringify(message));
    req.end();
};

exports.Log = Splunk;