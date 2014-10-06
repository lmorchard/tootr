var _ = require('underscore');

module.exports = function (publishers, baseModule) {
  var Dropbox = baseModule();

  return Dropbox;
};
