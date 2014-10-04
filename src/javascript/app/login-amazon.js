var $ = require('jquery');
var S3Ajax = require('S3Ajax');

function getQueryParameters (str) {
  return (str || document.location.search)
    .replace(/(^\?)/,'').split("&")
    .map(function (n) {
      return n = n.split("="),
        this[n[0]] = decodeURIComponent(n[1]),
        this
    }.bind({}))[0];
}

module.exports = function () {
  var qparams = getQueryParameters();

  window.onAmazonLoginReady = function() {
    amazon.Login.setClientId('amzn1.application-oa2-client.c64da1621c67449ab764c4cdf2f99761');
  };

  (function(d) {
    var a = d.createElement('script'); a.type = 'text/javascript';
    a.async = true; a.id = 'amazon-login-sdk';
    a.src = 'https://api-cdn.amazon.com/sdk/login1.js';
    d.getElementById('amazon-root').appendChild(a);
  })(document);

  document.getElementById('LoginWithAmazon').onclick = function() {
    options = { scope : 'profile' };
    amazon.Login.authorize(options, 'https://localhost:3443/login-amazon.html');
    return false;
  };

  document.getElementById('Logout').onclick = function() {
    amazon.Login.logout();
  };

  if (qparams.access_token) {

    $.ajax({
      url: 'https://sts.amazonaws.com/?' +
        'ProviderId=www.amazon.com&DurationSeconds=900&' +
        'Action=AssumeRoleWithWebIdentity&Version=2011-06-15&' +
        'RoleSessionName=web-identity-federation&' +
        'RoleArn=arn:aws:iam::197006402464:role/tootsr-amazon-user-buckets&' +
        'WebIdentityToken=' + qparams.access_token,

      error: function (xhr, status, err) {
        console.log(status, err);
      },

      success: function (dataXML, status, xhr) {
        var data = xmlToObj(dataXML);
        var credentials = data.AssumeRoleWithWebIdentityResponse
          .AssumeRoleWithWebIdentityResult.Credentials;

        console.log(data);

        var user_id = data;

        var s3 = new S3Ajax({
          key_id: credentials.AccessKeyId,
          secret_key: credentials.SecretAccessKey,
          security_token: credentials.SessionToken
        });

      }

    });

    $.ajax({
      url: 'https://api.amazon.com/user/profile',
      headers: { 'Authorization': 'bearer ' + qparams.access_token },
      success: function (data, status, xhr) {
        console.log(data);
      },
      error: function (xhr, status, err) {
        console.log(status, err);
      }
    });

  }

};

// Turn a simple structure of nested XML elements into a JavaScript object.
//
// TODO: Handle attributes?
function xmlToObj (parent, force_lists, path) {
  var obj = {};
  var cdata = '';
  var is_struct = false;

  for(var i=0,node; node=parent.childNodes[i]; i++) {
    if (3 === node.nodeType) {
      cdata += node.nodeValue;
    } else {
      is_struct = true;
      var name  = node.nodeName;
      var cpath = (path) ? path+'.'+name : name;
      var val   = arguments.callee(node, force_lists, cpath);

      if (!obj[name]) {
        var do_force_list = false;
        if (force_lists) {
          for (var j=0,item; item=force_lists[j]; j++) {
            if (item === cpath) {
              do_force_list=true; break;
            }
          }
        }
        obj[name] = (do_force_list) ? [ val ] : val;
      } else if (obj[name].length) {
        // This is a list of values to append this one to the end.
        obj[name].push(val);
      } else {
        // Has been a single value up till now, so convert to list.
        obj[name] = [ obj[name], val ];
      }
    }
  }

  // If any subnodes were found, return a struct - else return cdata.
  return (is_struct) ? obj : cdata;
}
