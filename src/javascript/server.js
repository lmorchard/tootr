var url     = require('url'),
    http    = require('http'),
    https   = require('https'),
    fs      = require('fs'),
    qs      = require('querystring'),
    express = require('express'),
    request = require('request');

var util = require('util');
var crypto = require('crypto');
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

var app = express();

var bodyParser = require('body-parser')
app.use(bodyParser.json());

app.all('*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.post('/amazon/presigned', function (req, res) {
  var content_type = req.body.ContentType;
  var bucket = req.body.Bucket;
  var path = req.body.Path;

  request({
    url: 'https://api.amazon.com/user/profile',
    headers: { 'Authorization': 'bearer ' + req.body.AccessToken },
    json: true
  }, function (err, resp, body) {

    var user_id = body.user_id;
    var key = 'users/amazon/' + user_id + '/' + path;

    var policy = new Buffer(JSON.stringify({
      "expiration": new Date(Date.now() + 60000).toISOString(),
      "conditions": [
        {"bucket": bucket},
        {"acl": "public-read"},
        ["starts-with", "$key", key],
        ["starts-with", "$Content-Type", content_type],
        ["content-length-range", 1, 500000]
      ]
    })).toString('base64');

    var signature = crypto
      .createHmac('sha1', config.aws_secret_access_key)
      .update(policy)
      .digest('base64');

    res.json({
      AWSAccessKeyId: config.aws_access_key_id,
      Policy: policy,
      Signature: signature,
      acl: 'public-read',
      'Content-Type': content_type,
      key: key
    });

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
