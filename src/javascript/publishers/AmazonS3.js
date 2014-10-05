var _ = require('underscore');
var S3Ajax = require('S3Ajax');

module.exports = function (publishers, baseClass, baseProto) {
  var AmazonS3 = publishers.makeConstructor();

  _.extend(AmazonS3, baseClass, {
    CLIENT_ID: 'amzn1.application-oa2-client.c64da1621c67449ab764c4cdf2f99761',
    ROLE_ARN: 'arn:aws:iam::197006402464:role/tootsr-amazon-user-buckets'
  });

  _.extend(AmazonS3.prototype, baseProto(AmazonS3), {
  });

  window.onAmazonLoginReady = function() {
    amazon.Login.setClientId(AmazonS3.CLIENT_ID);
  };

  (function(d) {
    var a = d.createElement('script'); a.type = 'text/javascript';
    a.async = true; a.id = 'amazon-login-sdk';
    a.src = 'https://api-cdn.amazon.com/sdk/login1.js';
    d.getElementById('amazon-root').appendChild(a);
  })(document);

  return AmazonS3;
};
