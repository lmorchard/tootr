var $ = require('jquery');
var PubSub = require('pubsub-js');
var misc = require('./misc');
var publishers = require('./publishers/index');
var microformats = require('microformat-shiv').microformats;
window.microformats = microformats;
var MD5 = require('MD5');

var _ = require('underscore');
var PubSub = require('pubsub-js');
var async = require('async');
var $ = require('jquery');
require('timeago');

var config = _.extend({
  HUB_PING_URL: 'https://localhost:4040/api/ping'
}, {
  "lmorchard.github.io": {
    HUB_PING_URL: 'https://toothub.herokuapp.com/api/ping'
  }
}[location.hostname]);

var publishers = require('./publishers');
var hentry = require('../templates/hentry');

PubSub.subscribe('publishers.setCurrent', setup);
PubSub.subscribe('publishers.clearCurrent', teardown);

$('#showAdvancedLogin').click(function () {
  $('section.login').toggleClass('advanced');
  return false;
});

$('button#logout').click(publishers.logout);

$('button#profileEdit').click(profileEdit);
$('button#profileEditDone').click(profileEditDone);

publishers.checkAuth();

var author = { };

// Hidden document used to produce HTML for publishing
var docIndex = document.implementation.createHTMLDocument('');

function setup (msg, publisher) {
  $('body').addClass('logged-in').removeClass('logged-out');

  var profile = publishers.getProfile();

  if (profile.avatar) {
    author.avatar = profile.avatar;
  } else if (profile.emailHash) {
    author.avatar = 'https://www.gravatar.com/avatar/' + profile.emailHash;
  } else if (profile.email) {
    var hash = MD5.hex_md5(profile.email);
    author.avatar = 'https://www.gravatar.com/avatar/' + hash;
  }

  author.email = profile.email;
  author.nickname = profile.nickname;
  author.name = profile.name;
  author.url = profile.url;

  $('.h-card')
    .addClass('ready')
    .find('.p-name').text(profile.name).end()
    .find('.u-url').attr('href', profile.url).end()
    .find('.p-nickname').text(profile.nickname).end();

  $('.session')
    .find('a.home').attr('href', author.url).end()
    .find('a.username').text(author.nickname).end()
    .find('.avatar img').attr('src', author.avatar)
      .attr('title', author.name).attr('alt', author.name);

  $('form#toot').each(function () {
    var f = $(this);
    f.submit(function () {
      var textarea = f.find('[name=content]');
      var content = textarea.val().trim();
      if (!content) { return; }
      addToot(publisher, { content: content });
      saveToots(publisher);
      textarea.val('');
      return false;
    });
  });

  publisher.list('', function (err, resources) {
    if (err) {
      console.log("LIST ERR " + JSON.stringify(err, null, '  '));
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
  $('body').removeClass('logged-in').addClass('logged-out');
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

function addToot (publisher, data) {
  data.author = data.author || author;
  data.published = data.published || (new Date()).toISOString();
  data.id = 'toot-' + Date.now() + '-' + _.random(0, 100);
  data.permalink = '#' + data.id;

  var entry = $(hentry(data));
  $('#entries').prepend(entry);
  entry.find('time.timeago').timeago();
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
      pingTootHub();
    }
  });

}

function pingTootHub () {
  $.ajax({
    type: 'POST',
    url: config.HUB_PING_URL,
    json: true,
    data: { url: author.url }
  }).then(function (data, status, xhr) {
    console.log('Ping sent');
  }).fail(function (xhr, status, err) {
    console.error(err);
  });
}

var elAbout = $('section#about');
var hcard = elAbout.find('dl.h-card');

function profileEdit () {
  elAbout.addClass('editing');

  hcard.find('dd').each(function () {
    var dd = $(this);
    var field;
    if (dd.hasClass('readonly')) {
      return;
    } else if (dd.hasClass('textarea')) {
      field = $('<textarea class="ui-only form-control"></textarea>');
    } else {
      field = $('<input type="text" class="ui-only form-control">');
    }
    dd.after(field);
    field.val(dd.html().trim());
    field.change(function (ev) {
      dd.html(field.val());
    });
  });

  hcard.find('input, textarea').eq(0).focus();
}

function profileEditDone () {
  elAbout.find('.ui-only').remove();
  elAbout.removeClass('editing');
}
