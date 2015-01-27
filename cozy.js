// Declare the cozy app handler
'use strict';

var pathExtra = require('path-extra');
var express = require('express');
var http = require('http');


var cozyHandler = {
  // put your own properties there
  start: function(options, done) {

    var hostname = options.hostname || '127.0.0.1';

    var dnsPort = options.getPort(); // Get another port if needed

    var app = express();
    app.use(express.static(pathExtra.join(__dirname, '/public') ) );
    app.get('/some', function( /*req, res*/ ){
      // put app logic
    });

    var server = http.createServer(app);
    server.listen(options.port, hostname);

    var dns = require('dns-native'),
      dServer = dns.createServer();

    dServer.on('request', function (request, response) {
      //console.log(request)
      response.answer.push(dns.A({
        name: request.question[0].name,
        address: '127.0.0.1',
        ttl: 600,
      }));
      response.answer.push(dns.A({
        name: request.question[0].name,
        address: '127.0.0.2',
        ttl: 600,
      }));
      response.additional.push(dns.A({
        name: 'hostA.example.org',
        address: '127.0.0.3',
        ttl: 600,
      }));
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
