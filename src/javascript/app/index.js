var crypto = require('crypto');

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

module.exports = function () {
  PubSub.subscribe('publishers.setCurrent', setup);
};

var docIndex = document.implementation.createHTMLDocument('');

function setup (msg, publisher) {

  var hash = crypto.createHash('md5')
    .update(publishers.auth.profile.email).digest('hex');

  $('header section.session img.avatar')
    .attr('src', 'https://www.gravatar.com/avatar/' + hash);
  $('header .session .username')
    .text(publishers.auth.profile.name);

  publisher.list('', function (err, resources) {
    if ('index.html' in resources) {
      return loadToots(publisher);
    } else {
      return firstRun(publisher);
    }
  });

  $('form#toot').each(function () {
    var f = $(this);
    f.submit(function () { return false; });
    f.find('[name=commit]').click(function (ev) {
      var textarea = f.find('[name=content]');
      addEntry(publisher, {
        content: textarea.val()
      });
      textarea.val('');
      return false;
    });
  });

}

function addEntry (publisher, data) {

  if (publishers.auth.profile.email) {
    var hash = crypto.createHash('md5')
      .update(publishers.auth.profile.email).digest('hex');
    author.avatar = 'https://www.gravatar.com/avatar/' + hash;
  }
  data.author = data.author || author;

  data.published = data.published || (new Date()).toISOString();
  data.id = Date.now() + '-' + _.random(0, 100);
  data.permalink = '#' + data.id;

  var entry = $(hentry(data));
  $('#entries').prepend(entry);
  entry.find('time.timeago').timeago();

  var entries = docIndex.querySelector('#entries');
  var tmp = docIndex.createElement('div');
  tmp.innerHTML = hentry(data);
  entries.insertBefore(tmp.firstChild, entries.firstChild);
  publisher.put('index.html', docIndex.documentElement.outerHTML, function (err) {
    console.log("Saved toots " + err);
  });

}

function firstRun (publisher) {
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
      console.log("First run error: " + err);
    }
  });
}

function loadToots (publisher) {
  publisher.get('index.html', function (err, content) {
    docIndex.documentElement.innerHTML = content;
    var entriesSrc = docIndex.querySelector('#entries');
    var entriesDest = document.querySelector('#entries');
    for (var i=0; i<entriesSrc.childNodes.length; i++) {
      entriesDest.appendChild(entriesSrc.childNodes[i].cloneNode(true));
    }
  });
}
