var _ = require('underscore');
var S3Ajax = require('S3Ajax');

module.exports = function (publishers, baseClass, baseProto) {
  var AmazonS3 = publishers.makeConstructor();

  _.extend(AmazonS3, baseClass, {
  });

  _.extend(AmazonS3.prototype, baseProto(AmazonS3), {
  });

  return AmazonS3;
};
