// Declare the cozy app handler
'use strict';

var pathExtra = require('path-extra');
var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var parse = require('domain-name-parser');
var dns = require('native-dns');
var DHT = require('bittorrent-dht');

var is_valid_dns = function(dns_name){
  var parsedDomain = parse(dns_name);
  return ! parsedDomain.tokenized.length < 2;
};

var queryDns = function(dnsQuery, dnsSolver, then){
  var question = dns.Question({
    name: dnsQuery,
    type: 'A'
  });

  console.error(dnsQuery)
  console.error(dnsSolver)

  var dReq = dns.Request({
    question: question,
    server: dnsSolver,
    timeout: 1000
  });

  dReq.on('timeout', function () {
    console.log('Timeout in making request');
    then(null, []);
  });

  dReq.on('message', function (err, answer) {
    var ips = [];
    answer.answer.forEach(function (a) {
      ips.push(a.address);
    });
    then(null, ips);
  });

  dReq.send();
};

var DDnsConsumer = function(opts){

  var localDns = [];
  var dnsSolver = {
    address: opts.hostname,
    port: opts.dnsPort,
    type: 'udp'
  };
  var dhtOpts = {
    bootstrap: false
// ,debug: '*' // display debug messages
  };

  var dnsServer = dns.createServer();
  var dhTable = new DHT(dhtOpts);

  this.listDns = function(){
    return localDns;
  };

  this.addDns = function(newDns){
    if ( is_valid_dns(newDns) ) {
      localDns.push(newDns);
      return true;
    }
    return false;
  };

  this.resolveDns = function(dnsToSolve, then){
    if ( is_valid_dns(dnsToSolve) ) {
      return queryDns(dnsToSolve, dnsSolver, then);
    }
    then('invalid dns', false);
  };

  this.setup = function(){
    dnsServer.on('request', function (request, response) {

      if (!request.question.length || !request.question[0]) {
        return response.send();
      }

      var qDomain = request.question[0].name;
      if (localDns.indexOf(qDomain) === -1 ) {
        return response.send();
      }

      response.answer.push(dns.A({
        name: qDomain,
        address: opts.hostname,
        ttl: 1
      }));
      response.send();
    });
    dnsServer.on('error', function (err) {
      console.log(err.stack);
    });
    dnsServer.serve(opts.dnsPort);


    dhTable.listen(opts.dhtPort, opts.hostname, function () {
      console.log('now listening')
    });
  };

  this.getDhTable = function(){
    return dhTable;
  };
  this.getDnsServer = function(){
    return dnsServer;
  };

};

var cozyHandler = {
  peers: [],
  // put your own properties there
  start: function(options, done) {

    var hostname = options.hostname || '127.0.0.1';

    var app = express();
    app.use(express.static(pathExtra.join(__dirname, '/public') ) );
    app.use(bodyParser.urlencoded({ extended: false }));
    app.get('/peers', function( req, res ){
      var peerList = [];
      cozyHandler.peers.forEach(function(peer, index){
        peerList.push('peer'+index);
      });
      res.send(peerList);
    });
    app.post('/peers/add', function( req, res ){
      var peerOpts = {
        hostname: options.hostname || '127.0.0.1',
        dnsPort: options.getPort(),
        dhtPort: options.getPort()
      };
      var peer = new DDnsConsumer(peerOpts);
      peer.setup();
      cozyHandler.peers.push(peer);
      res.status(200).send('peer'+ (cozyHandler.peers.length-1));
    });
    app.get('/:peer/list', function( req, res ){

      var peerId = req.params.peer;
      peerId = peerId.replace(/[^0-9]+/, '');

      var peer = cozyHandler.peers[peerId];

      if ( peer ) {
        return res.send( peer.listDns() );
      }
      res.status(404).send(false);
    });
    app.post('/:peer/add', function( req, res ){
      var newDns = req.body.domain;

      var peerId = req.params.peer;
      peerId = peerId.replace(/[^0-9]+/, '');

      var peer = cozyHandler.peers[peerId];

      if ( peer ) {
        return res.send( peer.addDns(newDns) );
      }
      res.status(404).send(false);
    });
    app.post('/:peer/remove', function( req, res ){

      var peerId = req.params.peer;
      peerId = peerId.replace(/[^0-9]+/, '');

      var peer = cozyHandler.peers[peerId];

      if ( peer ) {
        peer.getDnsServer().close();
        peer.getDhTable().destroy();
        cozyHandler.peers.splice(peerId,1);
        return res.send( true );
      }
      res.status(404).send(false);
    });
    app.post('/:peer/resolve', function( req, res ){
      var dnsToSolve = req.body.domain;

      var peerId = req.params.peer;
      peerId = peerId.replace(/[^0-9]+/, '');

      var peer = cozyHandler.peers[peerId];

      if ( peer ) {
        return peer.resolveDns(dnsToSolve, function(err, ips){
          if (err) {
            return res.status(500).send(err);
          }
          res.send(ips);
        });
      }
      res.status(404).send(false);
    });

    var server = http.createServer(app);
    server.listen(options.port, hostname);

    done(null, app, server);

  },
  stop: function(done) {
    // put stop logic here
    cozyHandler.peers.forEach(function(peer){
      peer.getDnsServer().close();
      peer.getDhTable().destroy();
    });
    done();
  }
};

module.exports = cozyHandler;
