var _ = require('underscore');

var publishers = module.exports = {};

publishers.makeConstructor = function () {
  return function () {
    this.init.apply(this, arguments);
  };
}

var baseClass = {
  defaults: {}
}

var baseProto = function (cls) {
  return {
    init: function baseInit (options) {
      this.options = _.defaults(options || {}, cls.defaults);
    }
  };
};

var modules = {
  'AmazonS3': require('./publishers/AmazonS3'),
  'Dropbox': require('./publishers/Dropbox'),
  'Github': require('./publishers/Github')
};
for (var name in modules) {
  publishers[name] = modules[name](publishers, baseClass, baseProto);
}
