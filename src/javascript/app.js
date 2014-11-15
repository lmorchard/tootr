var PubSub = require('pubsub-js');
var misc = require('../misc');
var publishers = require('../publishers/index');
var hentry = require('../../templates/hentry');
var microformats = require('microformat-shiv').microformats;
var MD5 = require('MD5');

var async = require('async');
var _ = require('underscore');
var $ = require('jquery');

require('timeago');

var config = _.extend({
  HUB_PING_URL: 'https://localhost:4040/api/ping'
}, {
  "lmorchard.github.io": {
    HUB_PING_URL: 'https://toothub.herokuapp.com/api/ping'
  }
}[location.hostname]);

var author = { };
var publisher = null;

var elAbout = $('section#about');
var hcard = elAbout.find('dl.h-card');

$('button#logout').click(publishers.logout);
$('button#profileEdit').click(handleProfileEdit);
$('button#profileEditDone').click(handleProfileEditDone);
$('form#toot').submit(handleTootFormSubmit);
$('#entries')
  .delegate('.h-entry', 'click', handleHEntryClick)
  .delegate('button.entry-delete', 'click', handleEntryDelete)
  .delegate('button.entry-undo-delete', 'click', handleEntryUndoDelete)
  .delegate('button.entry-edit', 'click', handleEntryEdit)
  .delegate('button.entry-edit-done', 'click', handleEntryEditDone);

PubSub.subscribe('publishers.setCurrent', handleSignIn);
PubSub.subscribe('publishers.clearCurrent', handleSignOut);
publishers.checkAuth();

function handleSignIn (msg, currentPublisher) {
  publisher = currentPublisher;

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

  $('.session').fillOut({
    'a.home @href': author.url,
    'a.username': author.nickname,
    '.avatar img @src': author.avatar,
    '.avatar img @title': author.name,
    '.avatar img @alt': author.name
  });

  publisher.list('', function (err, resources) {
    if (err) {
      return console.log("LIST ERR " + JSON.stringify(err, null, '  '));
    } else if ('index.html' in resources) {
      return loadToots(publisher);
    } else {
      return firstRun(publisher);
    }
  });
}

function handleSignOut (msg) {
  $('body').removeClass('logged-in').addClass('logged-out');
  $('#entries').empty();
}

function handleProfileEdit () {
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

function handleProfileEditDone () {
  elAbout.find('.ui-only').remove();
  elAbout.removeClass('editing');
}

// React to toot form submission by adding a new toot
function handleTootFormSubmit (ev) {
  var textarea = $(this).find('[name=content]');
  var content = textarea.val().trim();
  if (!content) { return; }
  textarea.val('');
  addToot(publisher, { content: content });
  saveToots(publisher);
  return false;
}

// Toggle per-entry editing UI on click
function handleHEntryClick (ev) {
  var entry = $(this);

  if (entry.hasClass('show-ui')) {
    entry.find('footer.entry-edit-footer').remove();
  } else {
    $('.templates .entry-edit-footer').clone().appendTo(entry);
  }
  entry.toggleClass('show-ui');

  return false;
}

// Delete with undo by tucking the entry into panel
function handleEntryDelete (ev) {
  var button = $(this);
  var entry = button.parents('.h-entry');

  entry.fadeOut(function () {
    $('.templates .entry-undo-delete-panel').clone()
      .insertAfter(entry).append(entry);
    saveToots(publisher);
  });

  return ev.stopPropagation();
}

// Undo delete by unpacking entry from the panel
function handleEntryUndoDelete (ev) {
  var button = $(this);
  var panel = button.parents('.entry-undo-delete-panel');
  var entry = panel.find('.h-entry');

  panel.fadeOut(function () {
    entry.insertAfter(panel).fadeIn(function () {
      panel.remove();
      saveToots(publisher);
    });
  });

  ev.stopPropagation();
}

// Set up entry editor and hide the content
function handleEntryEdit (ev) {
  var button = $(this);
  var entry = button.parents('.h-entry');
  var content = entry.find('.e-content');
  var field = $('.templates .entry-editor').clone();

  entry.addClass('editing');
  field.insertAfter(content)
    .val(content.html())
    .change(function () {
      content.html(field.val());
    });

  ev.stopPropagation();
}

// Remove the editor and save changes
function handleEntryEditDone (ev) {
  var button = $(this);
  var entry = button.parents('.h-entry');
  var field = entry.find('textarea');
  var content = entry.find('.e-content');

  entry.removeClass('editing');
  content.html(field.val());
  saveToots(publisher);
  field.remove();

  ev.stopPropagation();
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
  publisher.get('index.html', function (err, content) {
    var docIndex = document.implementation.createHTMLDocument('');
    docIndex.documentElement.innerHTML = content;
    copyToots(docIndex, document);
    $('time.dt-published').timeago();
  });
}

function saveToots (publisher) {
  $.get('site.html', function (content) {
    var docIndex = document.implementation.createHTMLDocument('');
    docIndex.documentElement.innerHTML = content;
    copyToots(document, docIndex);

    // Serialize the HTML and publish it!
    var content = docIndex.documentElement.outerHTML;
    publisher.put('index.html', content, function (err) {
      if (err) {
        console.log("ERROR SAVING TOOTS " + err);
      } else {
        pingTootHub();
      }
    });
  });

  var assets = [
    {src: 'site.css', dest: 'site.css'},
    {src: 'site.js', dest: 'site.js'}
  ];
  async.each(assets, function (asset, next) {
    $.get(asset.src, function (content) {
      publisher.put(asset.dest, content, next);
    });
  }, function (err) {
    if (err) {
      console.log("Upgrade error: " + err);
    }
  });
}

function copyToots (docFrom, docTo) {

  var cards = microformats.getItems({
    filters: ['h-card'],
    document: docFrom,
    node: docFrom.querySelector('#about')
  });
  var card = cards.items.length ?
    misc.flatten(cards.items[0].properties) : {};

  if (!card) { card = publishers.getProfile(); }

  $('.h-card', docTo).fillOut({
    '.p-name': card.name,
    '.u-url @href': card.url,
    '.p-nickname': card.nickname,
    '.p-note': card.note
  });

  var entries = microformats.getItems({
    filters: ['h-entry'],
    document: docFrom,
    node: docFrom.querySelector('#entries')
  });

  $('#entries', docTo).empty();

  var tmpl = $('.templates .h-entry', docTo);
  if (!tmpl.length) {
    tmpl = $('.templates .h-entry', docFrom);
  }

  entries.items.forEach(function (item) {
    var props = misc.flatten(item.properties);
    tmpl.clone().fillOut({
      '.e-content': props.content,
      '.dt-published': props.published,
      '.dt-published @datetime': props.published,
      '.u-url @href': props.url,
      '.h-card .p-nickname': card.nickname,
      '.h-card .p-name': card.name
    }).appendTo($('#entries', docTo));
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
