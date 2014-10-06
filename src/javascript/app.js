var $ = require('jquery');
var publishers = require('./publishers');

if (location.search.indexOf('loginType=AmazonS3') !== -1) {
  publishers.AmazonS3.finishLogin();
} else {
  publishers.checkAuth();
}

var body = $('body');
if (body.hasClass('index')) {
  require('./app/index')();
}
