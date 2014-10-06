var _ = require('underscore');

module.exports = function (publishers, baseModule) {
  var Github = baseModule();

  /*
  $('button#login').click(function () {
    location.href = "https://github.com/login/oauth/authorize?" + $.param({
      client_id: gh_oauth.client_id,
      redirect_uri: gh_oauth.redirect_uri,
      scope: gh_oauth.scope.join(','),
      state: Date.now() + '-' + Math.random()
    });
  });
  */

  return Github;
};
