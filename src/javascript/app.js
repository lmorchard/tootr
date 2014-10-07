var $ = require('jquery');
var PubSub = require('pubsub-js');
var publishers = require('./publishers');

var body = $('body');
if (body.hasClass('index')) {
  require('./app/index')();
}

PubSub.subscribe('publishers.setCurrent', function (msg, publisher) {
  $('body').addClass('logged-in').removeClass('logged-out');
});

PubSub.subscribe('publishers.clearCurrent', function (msg) {
  $('body').removeClass('logged-in').addClass('logged-out');
});

if (location.search.indexOf('loginType=AmazonS3') !== -1) {
  publishers.AmazonS3.finishLogin();
} else {
  publishers.checkAuth();
}
