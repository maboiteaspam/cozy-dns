var cozyStub = require('cozy-stub');

var cozyHandler = require('./cozy');

console.log('DNS made cozy..');
var options = {
  port: 8090
};

cozyStub.stub(cozyHandler, options);
