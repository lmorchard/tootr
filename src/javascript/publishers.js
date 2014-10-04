var _ = require('underscore');

var publishers = module.exports = {};

publishers.makeConstructor = function () {
  return function () {
    this._init.apply(this, arguments);
  };
};

var baseClass = {
  defaults: {}
};

var baseProto = function (cls) {
  return {
    _init: function baseInit (options) {
      this.options = _.defaults(options || {}, cls.defaults);
    },
    login: function (cb) {
    },
    format: function (cb) {
    },
    list: function (path, cb) {
    },
    get: function (path, cb) {
    },
    put: function (path, cb) {
    },
    rm: function (path, cb) {
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
