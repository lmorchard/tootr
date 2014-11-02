var $ = require('jquery');
var _ = require('underscore');
var misc = require('../misc');
var S3Ajax = require('S3Ajax');

// AmazonS3Publisher app config, partially host-based
// TODO: Make this user-configurable - in localstorage?
var config = _.extend({
  S3_BASE_URL: 'https://s3.amazonaws.com',
  TOKEN_DURATION: 900
}, {
  "localhost": {
    CLIENT_ID: 'amzn1.application-oa2-client.c64da1621c67449ab764c4cdf2f99761',
    ROLE_ARN: 'arn:aws:iam::197006402464:role/tootr-dev-users',
    BUCKET: 'toots-dev.lmorchard.com',
    REGISTER_URL: 'https://localhost:9443/amazon/register',
    PRESIGNER_URL: 'https://localhost:9443/amazon/presigned'
  },
  "lmorchard.github.io": {
    CLIENT_ID: 'amzn1.application-oa2-client.d3ce7b272419457abf84b88a9d7d6bd3',
    ROLE_ARN: 'arn:aws:iam::197006402464:role/tootsr-amazon-user-buckets',
    BUCKET: 'toots.lmorchard.com',
    REGISTER_URL: 'https://tootr.herokuapp.com/amazon/register',
    PRESIGNER_URL: 'https://tootr.herokuapp.com/amazon/presigned'
  }
}[location.hostname]);

module.exports = function (publishers, baseModule) {
  var AmazonS3Publisher = baseModule();

  setupAmazonLoginButton();

  AmazonS3Publisher.startLogin = function () {
    options = { scope : 'profile' };
    var redir = location.protocol + '//' + location.hostname +
      (location.port ? ':' + location.port : '') +
      location.pathname + '?loginType=AmazonS3';
    amazon.Login.authorize(options, redir);
  };

  AmazonS3Publisher.checkAuth = function (cb) {
    var auth = publishers.getProfile();

    // If we don't have an auth profile, it's possible that we've just received
    // an access token on the redirect side of login.
    if (!auth) {
      var qparams = misc.getQueryParameters();
      if (qparams.loginType === 'AmazonS3') {
        var qparams = misc.getQueryParameters();
        if (qparams.access_token) {
          AmazonS3Publisher.refreshAuth(qparams.access_token);
          // Clean out the auth redirect parameters from location
          history.replaceState({}, '', location.protocol + '//' +
              location.hostname + (location.port ? ':' + location.port : '') +
              location.pathname);
        }
      }
      return cb();
    }

    // We have an auth profile, but it's not ours.
    if (auth.type !== 'AmazonS3') { return cb(); }

    // We have an auth profile, but it could have expired. Refresh, if so.
    var now = new Date();
    var expiration = new Date(auth.credentials.Expiration);
    if (now >= expiration) {
      AmazonS3Publisher.refreshAuth(auth.access_token);
      return cb();
    }

    // Looks like we have a fresh auth profile, so just go ahead and use it.
    publishers.setCurrent(auth, new AmazonS3Publisher(auth));
    return cb();
  };

  AmazonS3Publisher.refreshAuth = function (access_token) {
    var auth = {
      type: 'AmazonS3',
      access_token: access_token
    };
    $.ajax({
      url: 'https://api.amazon.com/user/profile',
      headers: { 'Authorization': 'bearer ' + access_token }
    }).fail(function (xhr, status, err) {
      publishers.clearCurrent();
    }).then(function (data, status, xhr) {
      return $.ajax({
        url: config.S3_BASE_URL + '/' + config.BUCKET +
          '/users/amazon/' + data.user_id + '.json',
        cache: false
      });
    }).fail(function (xhr, status, err) {
      AmazonS3Publisher.startRegistration(access_token);
    }).then(function (profile, status, xhr) {
      _.extend(auth, profile);
      return $.ajax('https://sts.amazonaws.com/?' + $.param({
        'Action': 'AssumeRoleWithWebIdentity',
        'Version': '2011-06-15',
        'RoleSessionName': 'web-identity-federation',
        'ProviderId': 'www.amazon.com',
        'DurationSeconds': config.TOKEN_DURATION,
        'RoleArn': config.ROLE_ARN,
        'WebIdentityToken': access_token
      }));
    }).fail(function (xhr, status, err) {
      publishers.clearCurrent();
    }).then(function (dataXML, status, xhr) {
      auth.credentials = misc.xmlToObj(dataXML)
        .AssumeRoleWithWebIdentityResponse
        .AssumeRoleWithWebIdentityResult
        .Credentials;
      publishers.setCurrent(auth, new AmazonS3Publisher(auth));
    });
  };

  AmazonS3Publisher.startRegistration = function (access_token) {
    // Get a nickname from the user.
    // TODO: Rework this to not use a browser dialog.
    var nickname = window.prompt(
        "Login successful, but profile not found.\n" +
        "Enter a nickname to create a new one?");

    // Bail, if no nickname provided.
    if (!nickname) { return; }

    // Attempt to register the account with given nickname
    $.ajax({
      url: config.REGISTER_URL,
      type: 'POST',
      dataType: 'json',
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify({
        AccessToken: access_token,
        nickname: nickname
      })
    }).fail(function (xhr, status, err) {
      var again = window.confirm(
        "Problem registering: " + xhr.responseText + "\n" +
        "Try again?");
      if (again) {
        AmazonS3Publisher.startRegistration(access_token);
      }
    }).done(function (data, status, xhr) {
      AmazonS3Publisher.refreshAuth(access_token);
    });
  };

  AmazonS3Publisher.prototype.init = function (options) {
    AmazonS3Publisher.__base__.init.apply(this, arguments);

    var credentials = this.options.credentials;
    this.prefix = this.options.prefix;
    this.client = new S3Ajax({
      base_url: config.S3_BASE_URL,
      key_id: credentials.AccessKeyId,
      secret_key: credentials.SecretAccessKey,
      security_token: credentials.SessionToken,
      defeat_cache: true
    });
  };

  AmazonS3Publisher.prototype.startLogout = function () {
    amazon.Login.logout();
    publishers.clearCurrent();
  };

  AmazonS3Publisher.prototype.list = function (path, cb) {
    var prefix = this.prefix + path;
    this.client.listKeys(
      config.BUCKET,
      {prefix: prefix},
      function (req, obj) {
        var out = {};
        if (obj.ListBucketResult && obj.ListBucketResult.Contents) {
          obj.ListBucketResult.Contents.forEach(function (item) {
            var path = item.Key.replace(prefix, '');
            out[path] = item;
          });
        }
        cb(null, out);
      },
      function (req, obj) { cb(obj.Error, obj); }
    );
  };

  AmazonS3Publisher.prototype.get = function (path, cb) {
    this.client.get(
      config.BUCKET, this.prefix + path,
      function (req, obj) { cb(null, req.responseText); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  AmazonS3Publisher.prototype.rm = function (path, cb) {
    this.client.deleteKey(
      config.BUCKET, this.prefix + path,
      function (req, obj) { cb(null, req.responseText); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  AmazonS3Publisher.prototype.put = function (path, content, cb) {
    var ext = path.substr(path.lastIndexOf('.')+1);
    var types = {
      'html': 'text/html; charset=UTF-8',
      'css': 'text/css; charset=UTF-8',
      'js': 'text/javascript; charset=UTF-8'
    };
    var access_token = this.options.access_token;

    /*
     * Note: This is the straightforward way to do it, if the access policy
     * allows the temporary credentials to write to the subpath in the bucket.
     * Problem is, there is no limitation on what this user can write with
     * those credentials. So, someone could upload lots of huge files on my S3
     * dime, and I don't like that.

    this.client.put(
      config.BUCKET,
      this.prefix + path,
      content,
      {content_type: types[ext]},
      function (req, obj) { cb(null, obj); },
      function (req, obj) { cb(obj.Error, null); }
    );
    */

    /*
     * To keep some control over uploads, I use a presigner service that
     * imposes a policy. Then, I need to rework this as a form POST instead of
     * an S3 REST API request.
     */
    $.ajax({
      url: config.PRESIGNER_URL,
      type: 'POST',
      dataType: 'json',
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify({
        AccessToken: access_token,
        Path: path,
        ContentType: types[ext]
      })
    }).then(function (data, status, xhr) {

      var formdata = new FormData();
      for (var k in data) {
        formdata.append(k, data[k]);
      }
      formdata.append('file', content);

      return $.ajax({
        // url: 'https://' + config.BUCKET + '.s3.amazonaws.com/',
        url: config.S3_BASE_URL +  '/' + config.BUCKET + '/',
        type: 'POST',
        data: formdata,
        processData: false,
        contentType: false,
        cache: false
      });

    }).then(function (data, status, xhr) {
      cb(null, true);
    }, function (xhr, status, err) {
      cb(err, null);
    });

  };

  function setupAmazonLoginButton () {
    // Set up the Login with Amazon button
    // TODO: Maybe do this conditionally / on-demand only when an Amazon login is desired?
    window.onAmazonLoginReady = function() {
      amazon.Login.setClientId(config.CLIENT_ID);
      $('#LoginWithAmazon').click(function () {
        AmazonS3Publisher.startLogin();
        return false;
      });
    };
    (function(d) {
      var a = d.createElement('script'); a.type = 'text/javascript';
      a.async = true; a.id = 'amazon-login-sdk';
      a.src = 'https://api-cdn.amazon.com/sdk/login1.js';
      d.getElementById('amazon-root').appendChild(a);
    })(document);
  }

  return AmazonS3Publisher;
};
