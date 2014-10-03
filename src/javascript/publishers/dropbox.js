var _ = require('underscore');

module.exports = function (publishers, baseClass, baseProto) {
  var Dropbox = publishers.makeConstructor();

  _.extend(Dropbox, baseClass, {
  });

  _.extend(Dropbox.prototype, baseProto(Dropbox), {
  });

  return Dropbox;
};
