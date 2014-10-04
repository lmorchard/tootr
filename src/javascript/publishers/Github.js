var _ = require('underscore');

module.exports = function (publishers, baseClass, baseProto) {
  var Github = publishers.makeConstructor();

  _.extend(Github, baseClass, {
  });

  _.extend(Github.prototype, baseProto(Github), {
  });

  return Github;
};
