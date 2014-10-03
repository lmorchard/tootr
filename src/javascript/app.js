require('timeago');
var $ = require('jquery');


jQuery.extend({
  getQueryParameters : function(str) {
	  return (str || document.location.search).replace(/(^\?)/,'').split("&").map(function(n){return n = n.split("="),this[n[0]] = n[1],this}.bind({}))[0];
  }
});

var gh_oauth = {
  client_id: '6d59b16e660e246d3ee5',
  client_secret: '5a693ce4e5b541af6cb7f021c98485670f78feff',
  redirect_uri: 'http://localhost:3000/gh-login.html',
  scope: ['repo', 'gist']
};

var body = $('body');

if (body.hasClass('index')) {
  require('./app/index')();
}

if (body.hasClass('gh-login')) {
  var qparams = $.getQueryParameters();

  console.log(qparams);

  //$.getJSON('http://localhost:9999/authenticate/' + qparams.code, function(data) {
  $.getJSON('http://tootr-dev.herokuapp.com/authenticate/' + qparams.code, function(data) {
    console.log(data.token);
  });
}

