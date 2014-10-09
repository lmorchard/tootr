var url     = require('url'),
    http    = require('http'),
    https   = require('https'),
    fs      = require('fs'),
    qs      = require('querystring'),
    express = require('express'),
    request = require('request');

var util = require('util');
var _ = require('underscore');

// Load config defaults from JSON file.
// Environment variables override defaults.
function loadConfig() {
  var config = JSON.parse(fs.readFileSync(__dirname+ '/../../config-server.json', 'utf-8'));
  for (var i in config) {
    config[i] = process.env[i.toUpperCase()] || config[i];
  }
  return config;
}

var config = loadConfig();

var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
AWS.config.logger = console;
AWS.config.update({
  accessKeyId: config.aws_access_key_id,
  secretAccessKey: config.aws_secret_access_key
});

var app = express();

var bodyParser = require('body-parser')
app.use(bodyParser.json());

app.all('*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.post('/amazon/presigned', function (req, res) {
  util.debug("----------------------------------------------------------------------");
  util.debug(util.inspect(req.body));
  util.debug("----------------------------------------------------------------------");

  var user_id = req.body.UserId
  var temp_id = req.body.AccessKeyId;
  var temp_key = req.body.SecretAccessKey;
  var temp_token = req.body.SessionToken;
  var bucket = req.body.Bucket;
  var path = req.body.Path;

  var key = 'users/amazon/' + user_id + '/' + path;

  var s3 = new AWS.S3({});

  var url = s3.getSignedUrl('putObject', {
    Expires: 60,
    Bucket: bucket,
    Key: key
  }, function (err, url) {
    console.log(url);
    res.json({url: url});
  });

});

app.get('/github/authenticate/:code', function(req, res) {
  console.log('github authenticating code:' + req.params.code);
  request({
    url: 'https://github.com/login/oauth/access_token',
    method: 'POST',
    json: true,
    body: qs.stringify({
      client_id: config.github_oauth_client_id,
      client_secret: config.github_oauth_client_secret,
      code: code
    })
  }, function (err, resp, body) {
    var token = body.access_token;
    var result = err || !token ? {"error": "bad_code"} : { "token": token };
    console.log(result);
    res.json(result);
  });
});

var port = process.env.PORT || config.port || 9000;

app.listen(port, null, function (err) {
  console.log('tootr cheats, at your service: http://localhost:' + port);
});
