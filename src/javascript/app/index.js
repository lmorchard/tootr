require('timeago');
var $ = require('jquery');
var _ = require('underscore');
var async = require('async');

var publishers = require('../publishers');

var hentry = require('../../templates/hentry');

var author = {
  avatar: "//lmorchard.com/avatar.jpg",
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

  if (publishers.current) {

    var publisher = publishers.current;

    publisher.list('', function (err, resources) {

      if (true || !('index.html' in resources)) {
        var assets = [
          {src: 'site.html', dest: 'index.html', content: ''},
          {src: 'site.css', dest: 'site.css', content: ''},
          {src: 'site.js', dest: 'site.js', content: ''}
        ];
        async.each(assets, function (asset, next) {
          $.get(asset.src, function (content) {
            publisher.put(asset.dest, content, next);
          });
        }, function (err) {
          if (err) {
            console.log("PUT FAILED " + JSON.stringify(err));
          } else {
            console.log("PUT SUCCESS");
          }
        });
      }

    });

  }

};
