var url     = require('url'),
    http    = require('http'),
    https   = require('https'),
    fs      = require('fs'),
    qs      = require('querystring'),
    express = require('express'),
    request = require('request'),
    app     = express();

// Load config defaults from JSON file.
// Environment variables override defaults.
function loadConfig() {
  var config = JSON.parse(fs.readFileSync(__dirname+ '/../../config.json', 'utf-8'));
  for (var i in config) {
    config[i] = process.env[i.toUpperCase()] || config[i];
  }
  console.log('Configuration');
  console.log(config);
  return config;
}

var config = loadConfig();

// Convenience for allowing CORS on routes - GET only
app.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
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

var port = process.env.PORT || config.port || 9999;

app.listen(port, null, function (err) {
  console.log('tootr cheats, at your service: http://localhost:' + port);
});
