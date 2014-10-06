var $ = require('jquery');
var _ = require('underscore');
var misc = require('../misc');
var S3Ajax = require('S3Ajax');

var config = _.extend({
  S3_BASE_URL: 'https://s3.amazonaws.com',
  ROLE_ARN: 'arn:aws:iam::197006402464:role/tootsr-amazon-user-buckets',
}, {
  "localhost": {
    CLIENT_ID: 'amzn1.application-oa2-client.c64da1621c67449ab764c4cdf2f99761',
    BUCKET: 'tootsr',
    BUCKET_BASE_URL: 'https://tootsr.s3.amazonaws.com/'
  },
  "tootsr.s3.amazonaws.com": {
    CLIENT_ID: 'amzn1.application-oa2-client.1bb3141cbdfc4c179bc45f6086e7579c',
    BUCKET: 'tootsr',
    BUCKET_BASE_URL: 'https://tootsr.s3.amazonaws.com/'
  }
}[location.hostname]);

window.onAmazonLoginReady = function() {
  amazon.Login.setClientId(config.CLIENT_ID);
};

(function(d) {
  var a = d.createElement('script'); a.type = 'text/javascript';
  a.async = true; a.id = 'amazon-login-sdk';
  a.src = 'https://api-cdn.amazon.com/sdk/login1.js';
  d.getElementById('amazon-root').appendChild(a);
})(document);

module.exports = function (publishers, makeConstructor, baseClass, baseProto) {
  var AmazonS3 = makeConstructor();

  _.extend(AmazonS3, baseClass, {

    startLogin: function () {
      options = { scope : 'profile' };
      var redir = location.protocol + '//' + location.hostname +
        (location.port ? ':' + location.port : '');
      amazon.Login.authorize(options, redir + 'index.html?loginType=AmazonS3');
      return false;
    },

    finishLogin: function () {
      var qparams = misc.getQueryParameters();
      if (!qparams.access_token) { return; }

      var profile;
      $.ajax({
        url: 'https://api.amazon.com/user/profile',
        headers: { 'Authorization': 'bearer ' + qparams.access_token }
      }).then(function (data, status, xhr) {
        profile = data
        return $.ajax({
            url: 'https://sts.amazonaws.com/?' +
              'ProviderId=www.amazon.com&DurationSeconds=900&' +
              'Action=AssumeRoleWithWebIdentity&' +
              'Version=2011-06-15&' +
              'RoleSessionName=web-identity-federation&' +
              'RoleArn=' + config.ROLE_ARN + '&' +
              'WebIdentityToken=' + qparams.access_token
        });
      }).then(function (dataXML, status, xhr) {
        var data = misc.xmlToObj(dataXML);
        var credentials = data
          .AssumeRoleWithWebIdentityResponse
          .AssumeRoleWithWebIdentityResult
          .Credentials;
        publishers.setAuth({
          type: 'AmazonS3',
          profile: profile,
          credentials: credentials
        });
      }).fail(function (xhr, status, err) {
        window.alert("ERROR LOGGING IN " + status + " " + err);
      });
    },

    startLogout: function () {
      publishers.clearAuth();
      amazon.Login.logout();
      location.href = location.protocol + '//' + location.hostname +
        (location.port ? ':' + location.port : '') + '/';
    },

  });

  var __super__ = baseProto(AmazonS3);
  _.extend(AmazonS3.prototype, __super__, {

    init: function (options) {
      __super__.init.apply(this, arguments);

      var profile = this.options.profile;
      var credentials = this.options.credentials;

      this.client = new S3Ajax({
        base_url: config.S3_BASE_URL,
        key_id: credentials.AccessKeyId,
        secret_key: credentials.SecretAccessKey,
        security_token: credentials.SessionToken
      });

      this.prefix = 'users/amazon/' + profile.user_id + '/';

      var link = config.BUCKET_BASE_URL + this.prefix;
      $('body').addClass('logged-in-amazon');
      $('section#wrapper > header .session .username')
        .attr('href', link).text(profile.name);
    },

    list: function (cb) {
      this.client.listKeys(
        config.BUCKET, { prefix: prefix },
        function (req, obj) {
          console.log("LIST SUCCESS");
          console.log(obj);
        },
        function (req, obj) {
          console.log("ERROR");
          console.log(obj);
        }
      );
    },

    get: function (path, cb) {
      this.client.get(
        config.BUCKET, this.prefix + path,
        function (req, obj) {
          console.log("PUT SUCCESS");
          console.log(obj);
        },
        function (req, obj) {
          console.log("ERROR");
          console.log(obj);
        }
      );
    },

    put: function (path, content, cb) {
      this.client.put(
        AmazonS3.BUCKET, this.prefix + path, content,
        function (req, obj) {
          console.log("PUT SUCCESS");
          console.log(obj);
        },
        function (req, obj) {
          console.log("ERROR");
          console.log(obj);
        }
      );
    },

    rm: function (path, cb) {
      this.client.deleteKey(
        AmazonS3.BUCKET, this.prefix + path,
        function (req, obj) {
        },
        function (req, obj) {
        }
      );
    }

  });

  return AmazonS3;
};
