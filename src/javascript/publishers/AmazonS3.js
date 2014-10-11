var $ = require('jquery');
var _ = require('underscore');
var misc = require('../misc');
var S3Ajax = require('S3Ajax');

//
// AmazonS3 app config, partially host-based
// TODO: Make this user-configurable - in localstorage?
//
var config = _.extend({
  S3_BASE_URL: 'https://s3.amazonaws.com',
  TOKEN_DURATION: 900
}, {
  "localhost": {
    CLIENT_ID: 'amzn1.application-oa2-client.c64da1621c67449ab764c4cdf2f99761',
    ROLE_ARN: 'arn:aws:iam::197006402464:role/tootr-dev-users',
    BUCKET: 'tootr-dev',
    BUCKET_BASE_URL: 'https://tootr-dev.s3.amazonaws.com/',
    //PRESIGNER_URL: 'https://localhost:9443/amazon/presigned'
    PRESIGNER_URL: 'https://tootr-dev.herokuapp.com/amazon/presigned'
  },
  "tootsr-dev.s3.amazonaws.com": {
    CLIENT_ID: 'amzn1.application-oa2-client.c64da1621c67449ab764c4cdf2f99761',
    ROLE_ARN: 'arn:aws:iam::197006402464:role/tootr-dev-users',
    BUCKET: 'tootr-dev',
    BUCKET_BASE_URL: 'https://tootr-dev.s3.amazonaws.com/',
    PRESIGNER_URL: 'https://localhost:9443/amazon/presigned'
  },
  "tootsr.s3.amazonaws.com": {
    CLIENT_ID: 'amzn1.application-oa2-client.1bb3141cbdfc4c179bc45f6086e7579c',
    ROLE_ARN: 'arn:aws:iam::197006402464:role/tootsr-amazon-user-buckets',
    BUCKET: 'tootr',
    BUCKET_BASE_URL: 'https://tootr.s3.amazonaws.com/',
    PRESIGNER_URL: 'https://localhost:9443/amazon/presigned'
  },
  "lmorchard.github.io": {
    CLIENT_ID: 'amzn1.application-oa2-client.d3ce7b272419457abf84b88a9d7d6bd3',
    ROLE_ARN: 'arn:aws:iam::197006402464:role/tootsr-amazon-user-buckets',
    BUCKET: 'tootr',
    BUCKET_BASE_URL: 'https://tootr.s3.amazonaws.com/',
    PRESIGNER_URL: 'https://tootr-dev.herokuapp.com/amazon/presigned'
  }
}[location.hostname]);

module.exports = function (publishers, baseModule) {
  var AmazonS3 = baseModule();

  //
  // Set up the Login with Amazon button
  // TODO: Maybe do this conditionally / on-demand only when an Amazon login is desired?
  //
  window.onAmazonLoginReady = function() {
    amazon.Login.setClientId(config.CLIENT_ID);
    $('#LoginWithAmazon').click(function () {
      AmazonS3.startLogin();
      return false;
    });
    $('#LogoutWithAmazon').click(function () {
      AmazonS3.startLogout();
      return false;
    });
  };
  (function(d) {
    var a = d.createElement('script'); a.type = 'text/javascript';
    a.async = true; a.id = 'amazon-login-sdk';
    a.src = 'https://api-cdn.amazon.com/sdk/login1.js';
    d.getElementById('amazon-root').appendChild(a);
  })(document);

  AmazonS3.startLogin = function () {
    options = { scope : 'profile' };
    var redir = location.protocol + '//' + location.hostname +
      (location.port ? ':' + location.port : '') +
      location.pathname + '?loginType=AmazonS3';
    amazon.Login.authorize(options, redir);
  },

  AmazonS3.finishLogin = function () {
    var qparams = misc.getQueryParameters();
    if (!qparams.access_token) { return; }
    AmazonS3.refreshCredentials(qparams.access_token);
  };

  AmazonS3.checkAuth = function (auth) {
    var now = new Date();
    var expiration = new Date(auth.credentials.Expiration);
    if (now < expiration) {
      console.log("Amazon token expires in " +
          (expiration.getTime() - now.getTime()) / 1000 +
          " seconds.");
      publishers.setCurrent(new AmazonS3(auth));
    } else {
      AmazonS3.refreshCredentials(auth.access_token, function (err, auth) {
        if (err) {
          publishers.clearCurrent();
        } else {
          publishers.setCurrent(new AmazonS3(auth));
        }
      });
    }
  };

  AmazonS3.refreshCredentials = function (access_token, cb) {
    var auth = {
      type: 'AmazonS3',
      access_token: access_token
    };
    $.ajax({
      url: 'https://api.amazon.com/user/profile',
      headers: { 'Authorization': 'bearer ' + access_token }
    }).then(function (profile, status, xhr) {

      auth.profile = profile;

      return $.ajax('https://sts.amazonaws.com/?' + $.param({
        'Action': 'AssumeRoleWithWebIdentity',
        'Version': '2011-06-15',
        'RoleSessionName': 'web-identity-federation',
        'ProviderId': 'www.amazon.com',
        'DurationSeconds': config.TOKEN_DURATION,
        'RoleArn': config.ROLE_ARN,
        'WebIdentityToken': access_token
      }));

    }).then(function (dataXML, status, xhr) {

      var data = misc.xmlToObj(dataXML);
      var credentials = data
        .AssumeRoleWithWebIdentityResponse
        .AssumeRoleWithWebIdentityResult
        .Credentials;

      auth.credentials = credentials;
      publishers.setAuth(auth);

      if (cb) { cb(null, auth); }

    }).fail(function (xhr, status, err) {

      publishers.clearAuth();
      if (cb) { cb(err, null); }

    });
  },

  AmazonS3.startLogout = function () {
    publishers.clearAuth();
    amazon.Login.logout();
    location.href = location.protocol + '//' + location.hostname +
      (location.port ? ':' + location.port : '') +
      location.pathname;
  };

  AmazonS3.prototype.init = function (options) {
    AmazonS3.__base__.init.apply(this, arguments);

    var profile = this.options.profile;
    var credentials = this.options.credentials;

    this.client = new S3Ajax({
      base_url: config.S3_BASE_URL,
      key_id: credentials.AccessKeyId,
      secret_key: credentials.SecretAccessKey,
      security_token: credentials.SessionToken,
      defeat_cache: true
    });

    this.prefix = 'users/amazon/' + profile.user_id + '/';

    $('body').addClass('logged-in-amazon');

    var link = config.BUCKET_BASE_URL + this.prefix + 'index.html';
    $('header .session .username').attr('href', link)
  };

  AmazonS3.prototype.list = function (path, cb) {
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

  AmazonS3.prototype.get = function (path, cb) {
    this.client.get(
      config.BUCKET, this.prefix + path,
      function (req, obj) { cb(null, req.responseText); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  AmazonS3.prototype.rm = function (path, cb) {
    this.client.deleteKey(
      config.BUCKET, this.prefix + path,
      function (req, obj) { cb(null, req.responseText); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  AmazonS3.prototype.put = function (path, content, cb) {
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
        Bucket: config.BUCKET,
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
        url: 'https://' + config.BUCKET + '.s3.amazonaws.com/',
        type: 'POST',
        data: formdata,
        processData: false,
        contentType: false,
        cache: false
      });

    }).then(function (data, status, xhr) {
      cb(null, true);
    }, function (xhr, status, err) {
      console.log(xhr.responseText);
      cb(err, null);
    });

  };

  return AmazonS3;
};
