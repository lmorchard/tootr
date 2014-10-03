require('timeago');
var $ = require('jquery');

var publishers = require('../publishers');

var hentry = require('../../templates/hentry');

var author = {
  avatar: "http://lmorchard.com/avatar.jpg",
  url: "http://lmorchard.com",
  name: "Les Orchard",
  nickname: "lmorchard"
};

module.exports = function () {

  function addEntry (data) {
    data.author = data.author || author;
    data.published = data.published || (new Date()).toISOString();
    data.permalink = '/posts/' + Date.now();

    var entry = $(hentry(data));

    $('.h-feed').prepend(entry);
    entry.find('time.timeago').timeago();
  }

  $('button#login').click(function () {
    location.href = "https://github.com/login/oauth/authorize?" + $.param({
      client_id: gh_oauth.client_id,
      redirect_uri: gh_oauth.redirect_uri,
      scope: gh_oauth.scope.join(','),
      state: Date.now() + '-' + Math.random()
    });
  });

  $('form#toot').each(function () {

    var f = $(this);
    f.submit(function () { return false; });

    f.find('[name=commit]').click(function (ev) {
      var textarea = f.find('[name=content]');
      addEntry({
        content: textarea.val()
      });
      textarea.val('');
      return false;
    });

  });

  var entries = [
    { content: "This is a test", published: "2014-06-12T12:23:34Z" },
    { content: "This is another test", published: "2014-07-12T12:23:34Z" },
    { content: "This is one more test", published: "2014-09-12T12:23:34Z" }
  ];

  entries.forEach(addEntry);

};
