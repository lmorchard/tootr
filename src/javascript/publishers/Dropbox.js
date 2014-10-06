var _ = require('underscore');

module.exports = function (publishers, makeConstructor, baseClass, baseProto) {
  var Dropbox = makeConstructor();

  _.extend(Dropbox, baseClass, {
  });

  _.extend(Dropbox.prototype, baseProto(Dropbox), {
  });

  return Dropbox;
};
