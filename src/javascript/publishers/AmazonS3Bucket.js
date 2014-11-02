var $ = require('jquery');
var _ = require('underscore');
var misc = require('../misc');
var S3Ajax = require('S3Ajax');

var AUTH_NAME = 'AmazonS3Bucket';

var config = {
  S3_BASE_URL: 'https://s3.amazonaws.com',
};

module.exports = function (publishers, baseModule) {
  var AmazonS3BucketPublisher = baseModule();

  // Wire up the login form.
  $('#LoginWithAmazonBucket').click(function () {
    var data = {
      type: AUTH_NAME
    };
    $(this).parent('form').serializeArray().forEach(function (item) {
      data[item.name] = item.value;
    });
    AmazonS3BucketPublisher.startLogin(data);
    return false;
  });

  AmazonS3BucketPublisher.startLogin = function (auth) {
    AmazonS3BucketPublisher.refreshAuth(auth, function (err) {
      if (err) {
        var msg = err.Message ? err.Message : JSON.stringify(err, null, '  ');
        window.alert("Login failed: " + msg);
      }
    });
  };

  AmazonS3BucketPublisher.checkAuth = function (cb) {
    var auth = publishers.getProfile();
    if (!auth || auth.type !== AUTH_NAME) { return cb(); }
    AmazonS3BucketPublisher.refreshAuth(auth, cb);
  };

  AmazonS3BucketPublisher.refreshAuth = function (auth, cb) {
    // Try out a publisher with given credentials...
    var publisher = new AmazonS3BucketPublisher(auth);
    publisher.get('profile.json', function (err, profileData) {

      if (err) {
        if ('NoSuchKey' === err.Code) {
          // Credentials worked, but there's no profile...
          return AmazonS3BucketPublisher.startRegistration(publisher, cb);
        } else {
          // Credentials failed, so bail with an error.
          publishers.clearCurrent();
          return cb(err);
        }
      }

      // Credentials worked, so we're good.
      _.extend(auth, JSON.parse(profileData));
      publishers.setCurrent(auth, publisher);
      return cb();

    });
  };

  AmazonS3BucketPublisher.startRegistration = function (publisher, cb) {
    // Get a nickname from the user, bail if not provided.
    // TODO: Rework this to not use a browser dialog.
    var nickname = window.prompt(
        "Login successful, but profile not found.\n" +
        "Enter a nickname to create a new one?");
    if (!nickname) { return cb('Registration cancelled'); }

    var name = window.prompt("Name for your profile? (optional)");
    if (!name) { name = nickname; }

    var email = window.prompt("Email for your profile? (optional)");

    var url = window.prompt("Static hosting URL for your bucket? (optional)");
    if (!url) {
      url = config.S3_BASE_URL + '/' + publisher.options.bucket + '/index.html';
    }

    var profile = JSON.stringify({
      url: url,
      name: name,
      nickname: nickname,
      email: email
    });

    publisher.put('profile.json', profile, function (err, result) {
      if (err) {
        var again = window.confirm(
          "Problem registering: " + err + "\n" +
          "Try again?");
        if (again) {
          AmazonS3BucketPublisher.startRegistration(publisher, cb);
        }
      } else {
        AmazonS3BucketPublisher.refreshAuth(publisher.options, cb);
      }
    });
  };

  AmazonS3BucketPublisher.prototype.init = function (options) {
    AmazonS3BucketPublisher.__base__.init.apply(this, arguments);
    this.client = new S3Ajax({
      base_url: config.S3_BASE_URL,
      key_id: this.options.keyID,
      secret_key: this.options.secret,
      defeat_cache: true
    });
  };

  AmazonS3BucketPublisher.prototype.startLogout = function () {
    publishers.clearCurrent();
  };

  AmazonS3BucketPublisher.prototype.list = function (path, cb) {
    this.client.listKeys(
      this.options.bucket,
      { prefix: path },
      function (req, obj) {
        var out = {};
        if (obj.ListBucketResult && obj.ListBucketResult.Contents) {
          obj.ListBucketResult.Contents.forEach(function (item) {
            var path = item.Key.replace(path, '');
            out[path] = item;
          });
        }
        cb(null, out);
      },
      function (req, obj) { cb(obj.Error, obj); }
    );
  };

  AmazonS3BucketPublisher.prototype.get = function (path, cb) {
    this.client.get(
      this.options.bucket, path,
      function (req, obj) { cb(null, req.responseText); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  AmazonS3BucketPublisher.prototype.rm = function (path, cb) {
    this.client.deleteKey(
      this.options.bucket, path,
      function (req, obj) { cb(null, req.responseText); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  AmazonS3BucketPublisher.prototype.put = function (path, content, cb) {
    var ext = path.substr(path.lastIndexOf('.')+1);
    var types = {
      'html': 'text/html; charset=UTF-8',
      'css': 'text/css; charset=UTF-8',
      'js': 'text/javascript; charset=UTF-8'
    };
    this.client.put(
      this.options.bucket, path, content,
      { content_type: types[ext] },
      function (req, obj) { cb(null, obj); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  return AmazonS3BucketPublisher;
};
