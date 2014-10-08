var $ = require('jquery');
var misc = require('./misc');
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

var qparams = misc.getQueryParameters();
if ('loginType' in qparams && qparams.loginType in publishers) {

  publishers[qparams.loginType].finishLogin();

  var clean_loc = location.protocol + '//' + location.hostname +
    (location.port ? ':' + location.port : '') + location.pathname;
  history.replaceState({}, '', clean_loc);

} else {
  publishers.checkAuth();
}
