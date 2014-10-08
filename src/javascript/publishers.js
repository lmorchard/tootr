var _ = require('underscore');
var $ = require('jquery');
var PubSub = require('pubsub-js');

var publishers = module.exports = {};

var LOCAL_AUTH_KEY = 'localauth20141005';

publishers.clearAuth = function () {
  publishers.auth = null;
  localStorage.removeItem(LOCAL_AUTH_KEY);
  publishers.clearCurrent();
};

publishers.setAuth = function (auth) {
  publishers.auth = auth;
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(auth));
  publishers.checkAuth();
};

publishers.checkAuth = function () {
  var auth = null;
  try {
    var auth_data = localStorage.getItem(LOCAL_AUTH_KEY);
    var auth = JSON.parse(auth_data);
    if (auth.type in publishers) {
      publishers.auth = auth;
      publishers[auth.type].checkAuth(auth);
    }
  } catch (e) { /* No-op */ }
  if (!auth) { publishers.clearCurrent(); }
};

var baseModule = function () {
  var constructor = function () {
    this.init.apply(this, arguments);
  };
  constructor.defaults = {};
  constructor.__base__ = {
    init: function (options) {
      this.options = _.defaults(options || {}, constructor.defaults);
    }
  };
  _.extend(constructor.prototype, constructor.__base__);
  return constructor;
};

publishers.setCurrent = function (publisher) {
  publishers.current = publisher;
  PubSub.publish('publishers.setCurrent', publisher);
};

publishers.clearCurrent = function () {
  publishers.current = null;
  PubSub.publish('publishers.clearCurrent');
}

var modules = {
  'AmazonS3': require('./publishers/AmazonS3'),
  'Dropbox': require('./publishers/Dropbox'),
  'Github': require('./publishers/Github')
};
for (var name in modules) {
  publishers[name] = modules[name](publishers, baseModule);
}
