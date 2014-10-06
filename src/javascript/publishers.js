var _ = require('underscore');
var $ = require('jquery');

var publishers = module.exports = {};

var makeConstructor = function () {
  return function () {
    this.init.apply(this, arguments);
  };
};

var baseClass = {
  defaults: {},
};

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
  publishers[name] = modules[name](publishers, makeConstructor, baseClass, baseProto);
}

var LOCAL_AUTH_KEY = 'localauth20141005';

publishers.clearAuth = function () {
  localStorage.removeItem(LOCAL_AUTH_KEY);
  publishers.checkAuth();
};

publishers.setAuth = function (auth) {
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(auth));
  publishers.checkAuth();
};

publishers.checkAuth = function () {
  publishers.publisher = null;
  var auth = null;
  var auth_data = localStorage.getItem(LOCAL_AUTH_KEY);
  if (auth_data) {
    try {
      var auth = JSON.parse(auth_data);
      if (auth.type in publishers) {
        $('body').addClass('logged-in');
        $('body').removeClass('logged-out');
        publishers.publisher = new publishers[auth.type](auth);
      }
    } catch (e) {
      // No-op
      console.log("AUTH LOAD ERR " + e);
    }
  }
  if (!auth) {
    $('body').removeClass('logged-in');
    $('body').addClass('logged-out');
    publishers.publisher = null;
  }
}
