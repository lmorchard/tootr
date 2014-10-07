require('timeago');
var $ = require('jquery');
var _ = require('underscore');
var PubSub = require('pubsub-js');
var async = require('async');

var publishers = require('../publishers');

var hentry = require('../../templates/hentry');

var author = {
  avatar: "https://pbs.twimg.com/profile_images/477182669923422208/pLz1yGWh_400x400.jpeg",
  url: "http://lmorchard.com",
  name: "Les Orchard",
  nickname: "lmorchard"
};

function setup (msg, publisher) {
  var docIndex = document.implementation.createHTMLDocument('');

  publisher.list('', function (err, resources) {

    if ('index.html' in resources) {
      publisher.get('index.html', function (err, content) {
        docIndex.documentElement.innerHTML = content;
      });
    } else {

      var assets = [
        {src: 'site.html', dest: 'index.html'},
        {src: 'site.css', dest: 'site.css'},
        {src: 'site.js', dest: 'site.js'}
      ];

      async.each(assets, function (asset, next) {
        $.get(asset.src, function (content) {
          publisher.put(asset.dest, content, next);
          if (asset.src == 'site.html') {
            docIndex.documentElement.innerHTML = content;
          }
        });
      }, function (err) {
        if (err) {
        } else {
        }
      });

    }

  });

  function addEntry (data) {
    data.author = data.author || author;
    data.published = data.published || (new Date()).toISOString();
    data.permalink = '/posts/' + Date.now();

    var entry = $(hentry(data));

    $('#entries').prepend(entry);
    entry.find('time.timeago').timeago();

    var entries = docIndex.querySelector('#entries');
    var tmp = docIndex.createElement('div');
    tmp.innerHTML = hentry(data);
    entries.insertBefore(tmp.firstChild, entries.firstChild);
    publisher.put('index.html', docIndex.documentElement.outerHTML, function (err) {
      console.log("SAVE");
    });
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
}

module.exports = function () {
  PubSub.subscribe('publishers.setCurrent', setup);

  /*
  var entries = [
    { content: "This is a test", published: "2014-06-12T12:23:34Z" },
    { content: "This is another test", published: "2014-07-12T12:23:34Z" },
    { content: "This is one more test", published: "2014-09-12T12:23:34Z" }
  ];
  entries.forEach(addEntry);
  */
};
