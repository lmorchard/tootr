var PubSub = require('pubsub-js');
var misc = require('./misc');
var publishers = require('./publishers/index');
var microformats = require('microformat-shiv').microformats;

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

var elAbout = $('section#about');
var hcard = elAbout.find('dl.h-card');

$('button#logout').click(publishers.logout);
$('button#profileEdit').click(handleProfileEdit);
$('button#profileEditDone').click(handleProfileEditDone);
$('form#toot').submit(handleTootFormSubmit);
$('#entries')
  .delegate('.h-entry', 'click', handleEntryClick)
  .delegate('button.entry-delete', 'click', handleEntryDelete)
  .delegate('button.entry-undo-delete', 'click', handleEntryUndoDelete)
  .delegate('button.entry-edit', 'click', handleEntryEdit)
  .delegate('button.entry-edit-done', 'click', handleEntryEditDone);

PubSub.subscribe('publishers.setCurrent', handleSignIn);
PubSub.subscribe('publishers.clearCurrent', handleSignOut);

publishers.checkAuth();

var publisher = null;
var profile = null;

function handleSignIn (msg, currentPublisher) {
  publisher = currentPublisher;
  profile = publishers.getProfile();

  $('body').addClass('logged-in').removeClass('logged-out');
  $('.session').fillOut({
    'a.home @href': profile.url,
    'a.username': profile.nickname,
    '.avatar img @src': profile.avatar,
    '.avatar img @title': profile.name,
    '.avatar img @alt': profile.name
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

function handleProfileEdit (ev) {
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

function handleProfileEditDone (ev) {
  elAbout.find('.ui-only').remove();
  elAbout.removeClass('editing');
  saveToots(publisher);
}

function handleTootFormSubmit (ev) {
  // React to toot form submission by adding a new toot
  var textarea = $(this).find('[name=content]');
  var content = textarea.val().trim();
  if (!content) { return; }
  textarea.val('');
  addToot(publisher, { content: content });
  saveToots(publisher);
  return false;
}

function handleEntryClick (ev) {
  // Toggle per-entry editing UI on click
  var entry = $(this);
  if (entry.hasClass('editing')) {
    return false;
  }
  if (entry.hasClass('show-ui')) {
    entry.find('footer.entry-edit-footer').remove();
  } else {
    $('.templates .entry-edit-footer').clone().appendTo(entry);
  }
  entry.toggleClass('show-ui');

  return false;
}

function handleEntryDelete (ev) {
  // Delete with undo by tucking the entry into panel
  var button = $(this);
  var entry = button.parents('.h-entry');

  entry.fadeOut(function () {
    entry.removeClass('h-entry').addClass('deleted-h-entry');
    $('.templates .entry-undo-delete-panel').clone()
      .insertAfter(entry).append(entry);
    saveToots(publisher);
  });

  return ev.stopPropagation();
}

function handleEntryUndoDelete (ev) {
  // Undo delete by unpacking entry from the panel
  var button = $(this);
  var panel = button.parents('.entry-undo-delete-panel');
  var entry = panel.find('.deleted-h-entry');

  panel.fadeOut(function () {
    entry.insertAfter(panel).fadeIn(function () {
      panel.remove();
      saveToots(publisher);
    }).addClass('h-entry').removeClass('deleted-h-entry');
  });

  ev.stopPropagation();
}

function handleEntryEdit (ev) {
  // Set up entry editor and hide the content
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

function handleEntryEditDone (ev) {
  // Remove the editor and save changes
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
  data.profile = data.profile || profile;
  data.published = data.published || (new Date()).toISOString();
  data.id = 'toot-' + Date.now() + '-' + _.random(0, 100);
  data.permalink = '#' + data.id;

  $('.templates .h-entry').clone().fillOut({
    '@id': data.id,
    '.e-content': data.content,
    '.dt-published': data.published,
    '.dt-published @datetime': data.published,
    '.u-url @href': data.permalink,
    '.h-card .u-photo @src': data.profile.avatar,
    '.h-card .u-url @href': data.profile.url,
    '.h-card .p-nickname': data.profile.nickname,
    '.h-card .p-name': data.profile.name
  }).prependTo('#entries').find('time').timeago();
}

function loadToots (publisher) {
  publisher.get('index.html', function (err, content) {
    // TODO: Retain etag here to detect changes since we loaded
    var docIndex = document.implementation.createHTMLDocument('');
    docIndex.documentElement.innerHTML = content;
    copyToots(docIndex, document);
    $('time').timeago();
  });
}

function saveToots (publisher) {
  $.get('site.html', function (content) {
    var docIndex = document.implementation.createHTMLDocument('');
    docIndex.documentElement.innerHTML = content;
    copyToots(document, docIndex);
    var content = docIndex.documentElement.outerHTML;
    // TODO: Check etag here to detect changes since we loaded
    publisher.put('index.html', content, function (err) {
      if (err) {
        console.log("ERROR SAVING TOOTS " + err);
      } else {
        pingTootHub();
      }
    });
  });

  // TODO: Find a better way to ensure JS/CSS stays updated after first run
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

  var card = _.extend({}, profile);

  var cards = microformats.getItems({
    filters: ['h-card'],
    document: docFrom,
    node: docFrom.querySelector('#about')
  });
  if (cards.items.length && cards.items[0].properties) {
    _.extend(card, misc.flatten(cards.items[0].properties));
  }

  $('.h-card', docTo).fillOut({
    '.u-url @href': card.url,
    '.u-photo @src': card.avatar,
    '.p-nickname': card.nickname,
    '.p-name': card.name,
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
      '.h-card .p-name': card.name,
      '.h-card .u-photo @src': card.avatar,
      '.h-card .u-url @href': card.url
    }).appendTo($('#entries', docTo));
  });

}

function pingTootHub () {
  $.ajax({
    type: 'POST',
    url: config.HUB_PING_URL,
    json: true,
    data: { url: profile.url }
  }).then(function (data, status, xhr) {
    console.log('Ping sent');
  }).fail(function (xhr, status, err) {
    console.error(err);
  });
}
