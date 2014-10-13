var $ = require('jquery');
var PubSub = require('pubsub-js');
var misc = require('./misc');
var publishers = require('./publishers');

var body = $('body');
if (body.hasClass('index')) {
  require('./app/index')();
}

PubSub.subscribe('publishers.setCurrent', function (msg, publisher) {
  $('body')
    .addClass('logged-in')
    .removeClass('logged-out');
});

PubSub.subscribe('publishers.clearCurrent', function (msg) {
  $('body')
    .removeClass('logged-in')
    .addClass('logged-out');
});

$('button#logout').click(publishers.logout);

publishers.checkAuth();
