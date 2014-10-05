var $ = require('jquery');
var S3Ajax = require('S3Ajax');
var misc = require('../misc');
var publishers = require('../publishers');

module.exports = function () {
  var qparams = misc.getQueryParameters();

  document.getElementById('LoginWithAmazon').onclick = function() {
    options = { scope : 'profile' };
    amazon.Login.authorize(options, 'https://localhost:3443/login-amazon.html');
    return false;
  };

  document.getElementById('Logout').onclick = function() {
    amazon.Login.logout();
  };

  if (qparams.access_token) {

    var profile;
    $.ajax({
      url: 'https://api.amazon.com/user/profile',
      headers: { 'Authorization': 'bearer ' + qparams.access_token },
      error: function (xhr, status, err) {
        console.log(status, err);
      },
      success: function (data, status, xhr) {
        profile = data;
        console.log(profile);

        $.ajax({
          url: 'https://sts.amazonaws.com/?' +
            'ProviderId=www.amazon.com&DurationSeconds=900&' +
            'Action=AssumeRoleWithWebIdentity&Version=2011-06-15&' +
            'RoleSessionName=web-identity-federation&' +
            'RoleArn=' + publishers.AmazonS3.ROLE_ARN + '&' +
            'WebIdentityToken=' + qparams.access_token
        }).done(function (dataXML, status, xhr) {

          var data = misc.xmlToObj(dataXML);
          var credentials = data.AssumeRoleWithWebIdentityResponse
            .AssumeRoleWithWebIdentityResult.Credentials;

          var s3 = new S3Ajax({
            base_url: 'https://s3.amazonaws.com',
            key_id: credentials.AccessKeyId,
            secret_key: credentials.SecretAccessKey,
            security_token: credentials.SessionToken
          });

          var prefix = 'users/amazon/' + profile.user_id + '/';

          s3.listKeys(
            'tootsr.apps.lmorchard.com',
            {
              prefix: prefix,
              delimiter: '/'
            },
            function (req, obj) {
              console.log("LIST SUCCESS");
              console.log(obj);
            },
            function (req, obj) {
              console.log("ERROR");
              console.log(obj);
            }
          );

          s3.put(
            'tootsr.apps.lmorchard.com',
            prefix + 'TEST-' + Date.now() + '.txt',
            "HELLO WORLD AT " + (new Date()),
            function (req, obj) {
              console.log("PUT SUCCESS");
              console.log(obj);
            },
            function (req, obj) {
              console.log("ERROR");
              console.log(obj);
            }
          );

        });
      }
    });

  }

};
