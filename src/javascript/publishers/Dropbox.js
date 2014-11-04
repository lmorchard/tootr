var $ = require('jquery');
var _ = require('underscore');

var config = _.extend({
  APP_KEY: 'ovvlu8dh78f0j2m'
}, {
  "lmorchard.github.io": {
    APP_KEY: 'w9p1vvnppuhsqzk'
  }
}[location.hostname]);

var client = new Dropbox.Client({ key: config.APP_KEY });

module.exports = function (publishers, baseModule) {
  var DropboxPublisher = baseModule();

  $('#LoginWithDropbox').click(function () {
    DropboxPublisher.startLogin();
  });

  DropboxPublisher.startLogin = function () {
    client.authenticate(function(error, client) {
      if (error) {
        publishers.clearAuth();
      } else {
        DropboxPublisher.loadProfile(client);
      }
    });
  };

  DropboxPublisher.checkAuth = function (cb) {
    client.authenticate({interactive: false}, function(error, client) {
      if (error) {
        publishers.clearAuth();
        return cb(error, null);
      }
      if (client.isAuthenticated()) {
        var profile = publishers.getProfile();
        if (!profile) {
          DropboxPublisher.loadProfile(client);
        } else {
          var publisher = new DropboxPublisher({ client: client });
          publishers.setCurrent(profile, publisher);
        }
      }
      return cb(null);
    });
  };

  DropboxPublisher.loadProfile = function (client) {
    client.getAccountInfo({}, function (err, profile) {
      profile.type = 'Dropbox';
      profile.nickname = profile.uid;

      var publisher = new DropboxPublisher({ client: client });
      publishers.setCurrent(profile, publisher);
    });
  };

  DropboxPublisher.prototype.init = function (options) {
    DropboxPublisher.__base__.init.apply(this, arguments);
    this.client = this.options.client;
    this.profile = this.options.profile;
  };

  DropboxPublisher.prototype.startLogout = function () {
    if (!publishers.current) { return; }
    publishers.current.client.signOut();
    publishers.clearCurrent();
  };

  DropboxPublisher.prototype.list = function (path, cb) {
    this.client.readdir('/'+path, function (err, entries) {
      if (err) { return cb(err, null); }
      var out = {};
      for (var i=0; i<entries.length; i++) {
        out[entries[i]] = true;
      }
      cb(null, out);
    });
  };

  DropboxPublisher.prototype.get = function (path, cb) {
    this.client.readFile(path, cb);
  };

  DropboxPublisher.prototype.put = function (path, content, cb) {
    this.client.writeFile(path, content, cb);
  };

  DropboxPublisher.prototype.rm = function (path, cb) {
    this.client.remove(path, cb);
  };

  return DropboxPublisher;
};
