var cozyStub = require('cozy-stub');

var cozyHandler = require('./cozy');

console.log('DNS made cozy..');
var options = {
  port: 8090,
  hostname:'127.0.0.1'
};

cozyStub.stub(cozyHandler, options);
