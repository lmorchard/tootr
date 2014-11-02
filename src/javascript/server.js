var url     = require('url'),
    http    = require('http'),
    https   = require('https'),
    fs      = require('fs'),
    qs      = require('querystring'),
    express = require('express'),
    request = require('request');

var cors = require('cors');
var knox = require('knox');
var bodyParser = require('body-parser');

var util = require('util');
var crypto = require('crypto');
var _ = require('underscore');

var config = loadConfig();

var s3client = knox.createClient({
  key: config.aws_access_key_id,
  secret: config.aws_secret_access_key,
  bucket: config.aws_bucket
});

var app = express();

app.use(bodyParser.json());

app.all('*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

var S3_BASE_URL = 'https://s3.amazonaws.com/';

function fetchAmazonProfile (accessToken, cb) {
  return request({
    url: 'https://api.amazon.com/user/profile',
    headers: { 'Authorization': 'bearer ' + accessToken },
    json: true
  }, cb);
};

app.options('/amazon/register', cors());

app.options('/amazon/presigned', cors());

app.post('/amazon/register', cors(), function (req, res) {
  var nickname = req.body.nickname;
  var access_token = req.body.AccessToken;

  fetchAmazonProfile(access_token, function (err, resp, body) {
    if (body.error) {
      body.toktoktok=access_token;
      body.req = req.body;
      return res.status(200).send(body);
    }

    var profile = body;
    var bucketBase = S3_BASE_URL + config.aws_bucket +'/';
    var accountPath = '/users/amazon/' + body.user_id + '.json';
    var prefix = '~' + nickname + '/';
    var existsPath = prefix + '.exists';

    request({url: bucketBase + accountPath, json: true}, function (err, resp, body) {
      // Check for existing registration
      if (200 === resp.statusCode) {
        return res.status(403).send({
          error: 'already_registered',
          error_description: 'already registered'
        });
      }

      request(bucketBase + existsPath, function (err, resp, body) {
        // Check for taken nickname
        if (200 === resp.statusCode) {
          return res.status(403).send({
            error: 'nickname_taken',
            error_description: 'nickname taken'
          });
        }

        profile.nickname = nickname;
        profile.url = config.aws_static_base_url + prefix;
        profile.prefix = prefix;
        profile.emailHash = crypto.createHash('md5')
          .update(profile.email).digest('hex');
        delete profile.email;

        var headers = {
          'Content-Type': 'application/json',
          // TODO: Need policy that only allows the owner to read.
          'x-amz-acl': 'public-read'
        };
        var buf = new Buffer(JSON.stringify(profile));
        s3client.putBuffer(buf, accountPath, headers, function (err, s3_res) {
          if (200 != s3_res.statusCode) {
            res.status(s3_res.statusCode).send();
          }
          buf = new Buffer(accountPath);
          s3client.putBuffer(buf, existsPath, headers, function (err, s3_res) {
            if (200 != s3_res.statusCode) {
              res.status(s3_res.statusCode).send();
            }
            res.json(profile);
          });
        });

      });

    });

  });

});

app.post('/amazon/presigned', function (req, res) {

  var content_type = req.body.ContentType;
  var path = req.body.Path;

  // TODO: validate content-type, bucket, and path

  var expiration_timeout = parseInt(config.aws_signature_timeout || 30000, 10);
  var expiration = new Date(Date.now() + expiration_timeout).toISOString();

  fetchAmazonProfile(req.body.AccessToken, function (err, resp, body) {
    if (err) { return res.status(403).send('access denied'); }

    var user_id = body.user_id;
    var bucketBase = S3_BASE_URL + config.aws_bucket;
    var accountPath = '/users/amazon/' + user_id + '.json';

    request({
      url: bucketBase + accountPath,
      json: true
    }, function (err, resp, body) {
      if (err) { return res.status(403).send('access denied'); }

      var key = '~' + body.nickname + '/' + path;

      var policy = new Buffer(JSON.stringify({
        "expiration": expiration,
        "conditions": [
          {"bucket": config.aws_bucket},
          {"acl": "public-read"},
          ["starts-with", "$key", key],
          ["starts-with", "$Content-Type", content_type],
          ["content-length-range", 1, 500000]
        ]
      })).toString('base64');

      var signature = crypto
        .createHmac('sha1', config.aws_secret_access_key)
        .update(policy).digest('base64');

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
      code: req.params.code
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

function loadConfig() {
  var defaults = {
    "github_oauth_client_id": "GITHUB_APPLICATION_CLIENT_ID",
    "github_oauth_client_secret": "GITHUB_APPLICATION_CLIENT_SECRET",
    "github_oauth_host": "github.com",
    "github_oauth_port": 443,
    "github_oauth_path": "/login/oauth/access_token",
    "github_oauth_method": "POST",

    "aws_access_key_id": "XXX",
    "aws_secret_access_key": "XXX",
    "aws_region": "us-east-1",
    "aws_bucket": "tootr",
    "aws_signature_timeout": 30000
  };
  var config;
  try {
    var config_fn = __dirname+ '/../../config-server.json';
    config = _.defaults(
      JSON.parse(fs.readFileSync(config_fn, 'utf-8')),
      defaults);
  } catch (e) {
    config = defaults;
  };
  for (var i in config) {
    config[i] = process.env[i.toUpperCase()] || config[i];
  }

  return config;
}
