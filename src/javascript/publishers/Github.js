var $ = require('jquery');
var _ = require('underscore');
var misc = require('../misc');

var config = _.extend({
  API_BASE: 'https://api.github.com/',
  API_SCOPE: ['user:email', 'repo', 'gist'],
  BRANCH_NAME: 'gh-pages',
  CLIENT_ID: '6d59b16e660e246d3ee5',
  AUTHENTICATE_URL: 'https://localhost:9443/github/authenticate/',
  REPO_NAME: 'toots-dev'
}, {
  "lmorchard.github.io": {
    CLIENT_ID: '62a54438d65933d8dc8d',
    AUTHENTICATE_URL: 'https://tootr.herokuapp.com/github/authenticate/',
    REPO_NAME: 'toots'
  }
}[location.hostname]);

module.exports = function (publishers, baseModule) {
  var GithubPublisher = baseModule();

  $('#LoginWithGithub').click(function () {
    GithubPublisher.startLogin();
  });

  GithubPublisher.startLogin = function () {
    location.href = "https://github.com/login/oauth/authorize?" + $.param({
      client_id: config.CLIENT_ID,
      scope: config.API_SCOPE.join(','),
      state: Date.now() + '-' + Math.random()
    });
  };

  GithubPublisher.checkAuth = function (cb) {
    var profile = publishers.getProfile();

    // If we don't have an auth profile, it's possible that we've just received
    // an access token on the redirect side of login.
    if (!profile) {
      var qparams = misc.getQueryParameters();
      if (qparams.loginType === 'Github') {
        var qparams = misc.getQueryParameters();
        if (qparams.code) {
          $.getJSON(config.AUTHENTICATE_URL + qparams.code, function(data) {
            GithubPublisher.refreshCredentials(data.token);
            // Clean out the auth redirect parameters from location
            history.replaceState({}, '', location.protocol + '//' +
                location.hostname + (location.port ? ':' + location.port : '') +
                location.pathname);
          });
        }
      }
      return cb();
    }

    // We have an auth profile, but it's not ours.
    if (profile.type !== 'Github') { return cb(); }

    // Looks like we have a fresh auth profile, so just go ahead and use it.
    publishers.setCurrent(profile, new GithubPublisher(profile));
    return cb();
  };

  GithubPublisher.refreshCredentials = function (access_token) {
    var profile = {
      access_token: access_token
    };
    $.ajax({
      type: 'GET',
      url: config.API_BASE + 'user',
      headers: { authorization: 'token ' + access_token }
    }).then(function (data, status, xhr) {
      _.extend(profile, data);
      profile.type = 'Github';
      profile.nickname = data.login;
      profile.url = data.html_url;
      profile.avatar = data.avatar_url;
      publishers.setCurrent(profile, new GithubPublisher(profile));
    }).fail(function (xhr, status, err) {
      publishers.clearCurrent();
    });
  };

  GithubPublisher.prototype.init = function (options) {
    GithubPublisher.__base__.init.apply(this, arguments);

    this.contents_base_url = config.API_BASE + 'repos/' + this.options.login +
      '/' + config.REPO_NAME + '/contents/';
  };

  GithubPublisher.prototype.startLogout = function () {
    publishers.clearCurrent();
  };

  GithubPublisher.prototype.list = function (path, cb) {
    $.ajax({
      type: 'GET',
      url: this.contents_base_url + path + '?ref=' + config.BRANCH_NAME,
      headers: { authorization: 'token ' + this.options.access_token }
    }).then(function (data, status, xhr) {
      var out = {};
      if (_.isArray(data)) {
        data.forEach(function (item) {
          out[item.name] = item;
        });
      }
      return cb(null, out);
    }).fail(function (xhr, status, err) {
      return cb(xhr.responseText, null);
    });
  };

  GithubPublisher.prototype.get = function (path, cb) {
    $.ajax({
      type: 'GET',
      url: this.contents_base_url + path + '?ref=' + config.BRANCH_NAME,
      headers: { authorization: 'token ' + this.options.access_token }
    }).then(function (data, status, xhr) {
      if (_.isObject(data)) {
        return cb(null, atob(data.content));
      } else {
        return cb('not a file', null);
      }
    }).fail(function (xhr, status, err) {
      return cb(err, null);
    });
  };

  GithubPublisher.prototype.put = function (path, content, cb) {
    var $this = this;

    // Need to first attempt a GET, to see if the resource exists. If so, then
    // we can use the SHA hash to replace it with PUT. Otherwise, we're
    // creating a new resource.
    $.ajax({
      type: 'GET',
      url: $this.contents_base_url + path + '?ref=' + config.BRANCH_NAME,
      headers: { authorization: 'token ' + $this.options.access_token }
    }).always(function (data, status, xhr) {
      var params = {
        branch: config.BRANCH_NAME,
        message: 'Updated at ' + (new Date().toISOString()),
        content: btoa(content)
      };
      if (status !== 'error' && data.sha) {
        params.sha = data.sha;
      }

      $.ajax({
        type: 'PUT',
        url: $this.contents_base_url + path,
        headers: { authorization: 'token ' + $this.options.access_token },
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify(params)
      }).then(function (data, status, xhr) {
        return cb(null, data);
      }).fail(function (xhr, status, err) {
        return cb(err, null);
      });

    });
  };

  GithubPublisher.prototype.rm = function (path, cb) {
    var $this = this;

    // Again, need to attempt a GET first to find the SHA hash. If found, then
    // we can delete.
    $.ajax({
      type: 'GET',
      url: $this.contents_base_url + path + '?ref=' + config.BRANCH_NAME,
      headers: { authorization: 'token ' + $this.options.access_token }
    }).done(function (data, status, xhr) {
      if (!data.sha) {
        return cb('not found', null);
      }
      var params = {
        branch: config.BRANCH_NAME,
        message: 'Updated at ' + (new Date().toISOString()),
        sha: data.sha
      };
      $.ajax({
        type: 'DELETE',
        url: $this.contents_base_url + path,
        headers: { authorization: 'token ' + $this.options.access_token },
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify(params)
      }).then(function (data, status, xhr) {
        return cb(null, data);
      }).fail(function (xhr, status, err) {
        return cb(err, null);
      });
    });
  };

  return GithubPublisher;
};
