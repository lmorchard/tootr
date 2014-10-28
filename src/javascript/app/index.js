var MD5 = require('MD5');

var _ = require('underscore');
var PubSub = require('pubsub-js');
var async = require('async');
var $ = require('jquery');
require('timeago');

var publishers = require('../publishers');
var hentry = require('../../templates/hentry');

module.exports = function () {
  PubSub.subscribe('publishers.setCurrent', setup);
  PubSub.subscribe('publishers.clearCurrent', teardown);
};

var author = { };

// Hidden document used to produce HTML for publishing
var docIndex = document.implementation.createHTMLDocument('');

function setup (msg, publisher) {
  var profile = publishers.getProfile();

  if (profile.avatar) {
    author.avatar = profile.avatar;
  } else {
    var hash = MD5.hex_md5(profile.email);
    author.avatar = 'https://www.gravatar.com/avatar/' + hash;
  }
  author.email = profile.email;
  author.nickname = profile.nickname;
  author.name = profile.name;
  author.url = profile.url;

  $('header .session .username').attr('href', author.url)
  $('header .session img.avatar').attr('src', author.avatar);
  $('header .session .username').text(author.name);

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

  publisher.list('', function (err, resources) {
    if (err) {
      console.log("LIST ERR " + err);
      return;
    }
    if ('index.html' in resources) {
      return loadToots(publisher);
    } else {
      return firstRun(publisher);
    }
  });
}

function teardown (msg) {
  $('#entries').empty();
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
  data.author = data.author || author;
  data.published = data.published || (new Date()).toISOString();
  data.id = 'toot-' + Date.now() + '-' + _.random(0, 100);
  data.permalink = '#' + data.id;

  var entry = $(hentry(data));
  $('#entries').prepend(entry);
  entry.find('time.timeago').timeago();

  saveToots(publisher);
}

function loadToots (publisher) {

  // Fetch the toots from the publisher.
  publisher.get('index.html', function (err, content) {

    // Load the toot source into hidden source document
    docIndex.documentElement.innerHTML = content;

    // Clean out the destination.
    var dest = document.querySelector('#entries');
    while (dest.firstChild) {
      dest.removeChild(dest.firstChild);
    }

    // Copy entry nodes from source to destination.
    var src = docIndex.querySelector('#entries');
    for (var i=0; i<src.childNodes.length; i++) {
      dest.appendChild(src.childNodes[i].cloneNode(true));
    }

    // Make the timestamps all fancy!
    $('time.timeago').timeago();

  });

}

function saveToots (publisher) {

  // Clean out the destination
  var dest = docIndex.querySelector('#entries');
  while (dest.firstChild) {
    dest.removeChild(dest.firstChild);
  }

  // Copy entry nodes from source to destination
  var src = document.querySelector('#entries');
  for (var i=0; i<src.childNodes.length; i++) {
    dest.appendChild(src.childNodes[i].cloneNode(true));
  }

  // Clean up any .ui-only elements used for editing & etc.
  var ui = docIndex.querySelectorAll('.ui-only');
  for (var i=0; i<ui.length; i++) {
    ui[i].parentNode.removeChild(ui[i]);
  };

  // Serialize the HTML and publish it!
  var content = docIndex.documentElement.outerHTML;
  publisher.put('index.html', content, function (err) {
    if (err) {
      console.log("ERROR SAVING TOOTS " + err);
    } else {
      console.log("Saved toots");

      $.ajax({
        type: 'POST',
        url: 'https://127.0.0.1:4443/api/ping',
        data: { url: author.url }
      }).then(function (data, status, xhr) {
        console.log('Ping sent');
      }).fail(function (xhr, status, err) {
        console.error(err);
      });

    }
  });

}
