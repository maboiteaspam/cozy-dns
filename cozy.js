// Declare the cozy app handler
'use strict';

var pathExtra = require('path-extra');
var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var parse = require('domain-name-parser');

var cozyHandler = {
  // put your own properties there
  start: function(options, done) {

    var hostname = options.hostname || '127.0.0.1';

    var dnsPort = options.getPort(); // Get another port if needed

    var domains = [];

    var app = express();
    app.use(express.static(pathExtra.join(__dirname, '/public') ) );
    app.use(bodyParser.urlencoded({ extended: false }));
    app.post('/add', function( req, res ){
      var parsed_domain = parse(req.body.domain);

      if ( parsed_domain.tokenized.length < 2 ) {
        res.send(false);
      } else {
        console.log('added ' + req.body.domain);
        domains.push(req.body.domain);
        res.send(true);
      }
    });
    app.post('/resolve', function( req, res ){

      var question = dns.Question({
        name: req.body.domain,
        type: 'A'
      });

      var dReq = dns.Request({
        question: question,
        server: { address: '127.0.0.1', port: dnsPort, type: 'udp' },
        timeout: 1000
      });

      dReq.on('timeout', function () {
        console.log('Timeout in making request');
        res.send(false);
      });

      dReq.on('message', function (err, answer) {
        var ips = [];
        answer.answer.forEach(function (a) {
          ips.push(a.address);
        });
        res.send(ips);
      });

      dReq.send();

    });

    var server = http.createServer(app);
    server.listen(options.port, hostname);

    var dns = require('native-dns'),
      dServer = dns.createServer();

    dServer.on('request', function (request, response) {
      var qDomain = request.question[0].name;
      if (domains.indexOf(qDomain)>-1 ) {
        response.answer.push(dns.A({
          name: request.question[0].name,
          address: '127.0.0.1',
          ttl: 1
        }));
      }
      response.send();
    });

    dServer.on('error', function (err, buff, req, res) {
      console.log(err.stack);
    });

    dServer.serve(dnsPort);

    done(null, app, server);

  },
  stop: function(done) {
    // put stop logic here
    done();
  }
};

module.exports = cozyHandler;
