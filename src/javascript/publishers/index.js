var _ = require('underscore');
var $ = require('jquery');
var PubSub = require('pubsub-js');
var async = require('async');
var MD5 = require('MD5');

var publishers = module.exports = {};

var LOCAL_PROFILE_KEY = 'profile20141102';

publishers.checkAuth = function () {
  var profile = publishers.getProfile();

  var check = [];
  if (profile && profile.type in modules) {
    check.push(publishers[profile.type]);
  } else {
    for (var name in modules) {
      check.push(publishers[name]);
    }
  }

  async.each(check, function (m, next) {
    m.checkAuth(next);
  }, function (err) {
    if (!publishers.current) {
      publishers.clearCurrent();
    }
  });
};

publishers.getProfile = function () {
  var profile = null;
  try {
    profile = JSON.parse(localStorage.getItem(LOCAL_PROFILE_KEY));

    // HACK: Try to ensure we have an avatar, if we have an email address
    // TODO: Should this be done per-publisher?
    if (!profile.avatar) {
      if (!profile.emailHash && profile.email) {
        profile.emailHash = MD5.hex_md5(profile.email);
      }
      if (profile.emailHash) {
        profile.avatar = 'https://www.gravatar.com/avatar/' + profile.emailHash;
      }
    }

  } catch (e) {
    /* No-op */
  }
  return profile;
}

publishers.setCurrent = function (profile, publisher) {
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  publishers.current = publisher;
  PubSub.publish('publishers.setCurrent', publisher);
};

publishers.clearCurrent = function () {
  publishers.current = null;
  localStorage.removeItem(LOCAL_PROFILE_KEY);
  PubSub.publish('publishers.clearCurrent');
}

publishers.logout = function () {
  if (!publishers.current) { return; }
  publishers.current.startLogout();
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

var modules = {
  'AmazonS3Bucket': require('./AmazonS3Bucket'),
  'AmazonS3MultiUser': require('./AmazonS3MultiUser'),
  'Dropbox': require('./Dropbox'),
  'Github': require('./Github')
};

for (var name in modules) {
  publishers[name] = modules[name](publishers, baseModule);
}
