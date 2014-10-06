var $ = require('jquery');
var publishers = require('./publishers');

$('#LoginWithAmazon').click(function () {
  return publishers.AmazonS3.startLogin();
});
$('#LogoutWithAmazon').click(function () {
  return publishers.AmazonS3.startLogout();
});
if (location.search.indexOf('loginType=AmazonS3') !== -1) {
  publishers.AmazonS3.finishLogin();
} else {
  publishers.checkAuth();
}

var body = $('body');
if (body.hasClass('index')) {
  require('./app/index')();
}
if (body.hasClass('login-amazon')) {
  require('./app/login-amazon')();
}
if (body.hasClass('login-gh')) {
  require('./app/login-gh')();
}
