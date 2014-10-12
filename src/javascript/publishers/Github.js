var $ = require('jquery');
var _ = require('underscore');

module.exports = function (publishers, baseModule) {
  var GithubPublisher = baseModule();

  $('#LoginWithGithub').click(function () {
  /*
    location.href = "https://github.com/login/oauth/authorize?" + $.param({
      client_id: gh_oauth.client_id,
      redirect_uri: gh_oauth.redirect_uri,
      scope: gh_oauth.scope.join(','),
      state: Date.now() + '-' + Math.random()
    });
  */
  });

  GithubPublisher.startLogin = function () {
  };

  GithubPublisher.checkAuth = function (cb) {
    cb(null);
  };

  GithubPublisher.startLogout = function () {
  };

  GithubPublisher.prototype.init = function (options) {
  };

  GithubPublisher.prototype.list = function (path, cb) {
  };

  GithubPublisher.prototype.get = function (path, cb) {
  };

  GithubPublisher.prototype.put = function (path, content, cb) {
  };

  GithubPublisher.prototype.rm = function (path, cb) {
  };

  return GithubPublisher;
};
