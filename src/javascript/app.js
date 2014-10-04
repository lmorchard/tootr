var $ = require('jquery');

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
