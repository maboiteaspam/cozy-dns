// Declare the cozy app handler
'use strict';

//process.env['DEBUG'] = 'bittorrent-dht';

var pathExtra = require('path-extra');
var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var parse = require('domain-name-parser');
var dns = require('native-dns');
var DHT = require('bittorrent-dht');
var createTorrent = require('create-torrent');
var parseTorrent = require('parse-torrent');


// reduce K nodes requirements
DHT.K = 1;


var is_valid_dns = function(dns_name){
  var parsedDomain = parse(dns_name);
  return ! parsedDomain.tokenized.length < 2;
};

var queryDns = function(dnsQuery, dnsSolver, then){
  var question = dns.Question({
    name: dnsQuery,
    type: 'A'
  });

  console.log('Starts a new dns query ' + dnsQuery);
  console.log('DNS Server is ');
  console.log(dnsSolver);

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
  var transactions = {};

  this.listDns = function(){
    return localDns;
  };

  this.addDns = function(newDns){
    if ( is_valid_dns(newDns) && localDns.indexOf(newDns) === -1) {
      localDns.push(newDns);
      createTorrent(new Buffer(newDns), {name:newDns}, function (err, torrent) {
        torrent = parseTorrent(torrent);
        dhTable.announce(torrent.infoHash, opts.dhtPort);
      });
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

  this.announceAllDns = function(){
    localDns.forEach(function(dns){
     // console.log('announcing ' + dns);
      createTorrent(new Buffer(dns), {name:dns}, function (err, torrent) {
        torrent = parseTorrent(torrent);
        dhTable.announce(torrent.infoHash, opts.dhtPort);
      });
    });
  };

  this.setup = function(){
    dnsServer.on('request', function (request, response) {

      if (!request.question.length || !request.question[0]) {
        return response.send();
      }

      var qDomain = request.question[0].name;
      if (localDns.indexOf(qDomain) > -1 ) {
        response.answer.push(dns.A({
          name: qDomain,
          address: opts.hostname,
          ttl: 1
        }));
        response.send();
      } else {
        // search via DHT table
        createTorrent(new Buffer(qDomain), {name:qDomain}, function (err, torrent) {
          torrent = parseTorrent(torrent);
          dhTable.lookup(torrent.infoHash );
          transactions[torrent.infoHash] = {
            name:qDomain,
            response:response
          };
        });
      }
    });
    dnsServer.on('error', function (err) {
      console.log(err.stack);
    });
    dnsServer.serve(opts.dnsPort);

    var dhtAddress = this.getDhtAddress();
    dhTable.listen(opts.dhtPort, opts.hostname, function () {
      console.log(dhtAddress + ' listening ');
    });
    dhTable.on('ready', function () {
      console.log(dhtAddress + ' ready ');
    });
    dhTable.on('peer', function (addr, hash, from) {
      console.log(dhtAddress + ' peer ');
      console.log(addr, from)
    });
    dhTable.on('node', function (addr, hash, from) {
      //console.log(dhtAddress + ' node ');
      //console.log(addr, from)
    });
    dhTable.on('error', function (err) {
      console.log(dhtAddress + ' error ');
      console.log(err)
    });
    dhTable.on('warning', function (err) {
      console.log(dhtAddress + ' warning ');
    });
    dhTable.on('announce', function (addr, hash, from) {
      console.log(dhtAddress + ' announce ');
      console.log(addr, hash, from)
    });
    dhTable.on('peer', function (addr, infoHash, from) {
      var transaction = transactions[infoHash];
      if (transaction) {
        var response = transaction.response;
        var name = transaction.name;
        response.answer.push(dns.A({
          name: name,
          address: from.split(':')[0],
          ttl: 1
        }));
        response.send();
        delete transactions[infoHash];
      }
    });
  };

  this.getDnsAddress = function(){
    return opts.hostname + ':' + opts.dnsPort;
  };
  this.getDhtAddress = function(){
    return opts.hostname + ':' + opts.dhtPort;
  };
  this.getDhTable = function(){
    return dhTable;
  };
  this.getDhStatus = function(){
    var nodes = [];
    dhTable.nodes.toArray().forEach(function(node) {
      nodes.push({
        addr: node.addr,
        distance: node.distance===undefined?-1:node.distance
      })
    });

    return {
      dhtAddress:this.getDhtAddress(),
      dnsAddress:this.getDnsAddress(),
      isReady: dhTable.ready,
      nodes: nodes,
      nodesCount: nodes.length,
      peersCount: Object.keys(dhTable.peers).length,
      announcesCount:Object.keys(dhTable.tables).length
    };
  };
  this.getDnsServer = function(){
    return dnsServer;
  };

};

var lastPeerIndex = 0;
var cozyHandler = {
  peers: {},
  // put your own properties there
  start: function(options, done) {

    var hostname = options.hostname || '127.0.0.1';

    var app = express();
    app.use(express.static(pathExtra.join(__dirname, '/public') ) );
    app.use(bodyParser.urlencoded({ extended: false }));
    app.get('/peers', function( req, res ){
      var peerList = [];
      Object.keys(cozyHandler.peers).forEach(function(peerIndex){
        peerList.push(peerIndex);
      });
      res.send(peerList);
    });
    app.post('/peers/add', function( req, res ){

      var peerIndex = 'peer' + lastPeerIndex;
      lastPeerIndex++;

      var peerOpts = {
        hostname: options.hostname || '127.0.0.1',
        dnsPort: lastPeerIndex==1?53:options.getPort(),
        dhtPort: options.getPort()
      };
      var peer = new DDnsConsumer(peerOpts);
      peer.setup();

      cozyHandler.peers[peerIndex] = peer;
      if(Object.keys(cozyHandler.peers).length>1) {
        var firstPeer = cozyHandler.peers[ Object.keys(cozyHandler.peers)[0] ];
        peer.getDhTable()._bootstrap([firstPeer.getDhtAddress()]);
      }
      res.status(200).send( peerIndex );
    });
    app.get('/peers/dht_status', function( req, res ){
      var peersDhtStatus = {};
      Object.keys(cozyHandler.peers).forEach(function(peerIndex){
        peersDhtStatus[peerIndex] = cozyHandler.peers[peerIndex].getDhStatus();
      });
      return res.send( peersDhtStatus );
    });
    app.post('/peers/dht_announce', function( req, res ){
      Object.keys(cozyHandler.peers).forEach(function(peerIndex){
        cozyHandler.peers[peerIndex].announceAllDns();
      });
      return res.send( true );
    });
    app.get('/:peer/dht_status', function( req, res ){

      var peerId = req.params.peer;

      var peer = cozyHandler.peers[peerId];

      if ( peer ) {
        return res.send( peer.getDhStatus() );
      }
      res.status(404).send(false);
    });
    app.get('/:peer/list', function( req, res ){

      var peerId = req.params.peer;

      var peer = cozyHandler.peers[peerId];

      if ( peer ) {
        return res.send( peer.listDns() );
      }
      res.status(404).send(false);
    });
    app.post('/:peer/add', function( req, res ){
      var newDns = req.body.domain;

      var peerId = req.params.peer;

      var peer = cozyHandler.peers[peerId];

      if ( peer ) {
        return res.send( peer.addDns(newDns) );
      }
      res.status(404).send(false);
    });
    app.post('/:peer/remove', function( req, res ){

      var peerId = req.params.peer;

      var peer = cozyHandler.peers[peerId];

      if ( peer ) {
        peer.getDnsServer().close();
        peer.getDhTable().destroy();
        delete cozyHandler.peers[peerId];
        return res.send( true );
      }
      res.status(404).send(false);
    });
    app.post('/:peer/resolve', function( req, res ){
      var dnsToSolve = req.body.domain;

      var peerId = req.params.peer;

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
    Object.keys(cozyHandler.peers).forEach(function(peerIndex){
      var peer = cozyHandler.peers[peerIndex];
      peer.getDnsServer().close();
      peer.getDhTable().destroy();
    });
    done();
  }
};

module.exports = cozyHandler;
