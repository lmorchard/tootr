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
var policy = require('s3-policy');

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

  request({
    url: 'https://api.amazon.com/user/profile',
    headers: { 'Authorization': 'bearer ' + req.body.AccessToken },
    json: true
  }, function (err, resp, body) {

    var user_id = body.user_id;
    var bucket = req.body.Bucket;
    var path = req.body.Path;

    var p = policy({
      secret: config.aws_secret_access_key,
      //length: 1000000,
      bucket: bucket,
      key: 'users/amazon/' + user_id + '/' + path,
      expires: new Date(Date.now() + 60000),
      acl: 'public-read'
    });

    console.log(p.policy);
    console.log(p.signature);

    /*
    var policy = new Buffer(JSON.stringify({
      "expiration": "2020-12-01T12:00:00.000Z",
      "conditions": [
        {"bucket": bucket},
        {"acl": "public-read"},
        ["starts-with", "$key", key_base],
        ["starts-with", "$Content-Type", "text/"],
        ["content-length-range", 1, 500000]
      ]
    })).toString('base64');

    var signature = crypto
      .createHmac('sha1', )
      .update(policy).digest('hex');
    */

    res.json({
      AWSAccessKeyId: config.aws_access_key_id,
      Policy: p.policy,
      Signature: p.signature,
      acl: 'public-read'
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
