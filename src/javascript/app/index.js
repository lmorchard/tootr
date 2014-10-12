var MD5 = require('MD5');

var $ = require('jquery');
require('timeago');
var _ = require('underscore');
var PubSub = require('pubsub-js');
var async = require('async');

var publishers = require('../publishers');

var hentry = require('../../templates/hentry');

var author = {
  url: "http://lmorchard.com",
  name: "Les Orchard",
  nickname: "lmorchard"
};

module.exports = function () {
  PubSub.subscribe('publishers.setCurrent', setup);
};

var docIndex = document.implementation.createHTMLDocument('');

function setup (msg, publisher) {
  var hash = MD5.hex_md5(publishers.auth.profile.email);

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
      var content = textarea.val().trim();
      if (!content) { return; }
      addEntry(publisher, { content: content });
      textarea.val('');
      return false;
    });
  });
}

function firstRun (publisher) {
  console.log("Performing first run");
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

function addEntry (publisher, data) {

  if (publishers.auth.profile.email) {
    var hash = MD5.hex_md5(publishers.auth.profile.email);
    author.avatar = 'https://www.gravatar.com/avatar/' + hash;
  }
  author.email = publishers.auth.profile.email;
  author.nickname = publishers.auth.profile.user_id;
  author.name = publishers.auth.profile.name;
  author.url = $('header .session .username').attr('href');

  data.author = data.author || author;

  data.published = data.published || (new Date()).toISOString();
  data.id = Date.now() + '-' + _.random(0, 100);
  data.permalink = '#' + data.id;

  var entry = $(hentry(data));
  $('#entries').prepend(entry);
  entry.find('time.timeago').timeago();

  saveToots(publisher);
}

function loadToots (publisher) {
  publisher.get('index.html', function (err, content) {
    docIndex.documentElement.innerHTML = content;
    var dest = document.querySelector('#entries');
    var src = docIndex.querySelector('#entries');
    for (var i=0; i<src.childNodes.length; i++) {
      dest.appendChild(src.childNodes[i].cloneNode(true));
    }
    $('time.timeago').timeago();
  });
}

function saveToots (publisher) {
  var dest = docIndex.querySelector('#entries');
  while (dest.firstChild) {
    dest.removeChild(dest.firstChild);
  }
  var src = document.querySelector('#entries');
  for (var i=0; i<src.childNodes.length; i++) {
    dest.appendChild(src.childNodes[i].cloneNode(true));
  }
  var content = docIndex.documentElement.outerHTML;
  publisher.put('index.html', content, function (err) {
    console.log("Saved toots " + err);
  });
}
