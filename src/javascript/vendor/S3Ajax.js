//  S3Ajax v0.1 - An AJAX wrapper package for Amazon S3
//
//  http://decafbad.com/trac/wiki/S3Ajax
//  l.m.orchard@pobox.com
//  Share and Enjoy.
//
//  Requires:
//      http://pajhome.org.uk/crypt/md5/sha1.js

// Constructor
function S3Ajax () {
    return this.init.apply(this, arguments);
}

// Methods and properties
S3Ajax.prototype = {

    // Defaults for options accepted in constructor.
    defaults: {
        // Base URL for S3 API
        base_url: 'http://s3.amazonaws.com',
        // Key ID for credentials
        key_id: null,
        // Secret key for credentials
        secret_key: null,
        // Security token (required when using temporary credentials)
        security_token: null,
        // Flip this to true to potentially get lots of wonky logging.
        debug: false,
        // Defeat caching with query params on GET requests?
        defeat_cache: false,
        // Default ACL to use when uploading keys.
        default_acl: 'public-read',
        // Default content-type to use in uploading keys.
        default_content_type: 'text/plain; charset=UTF-8',
        // Set to true to make virtual hosted-style requests.
        use_virtual: false
    },

    // Initialize object (called from constructor)
    init: function (options) {
        this.options = options;
        for (var k in this.defaults) {
            if (this.defaults.hasOwnProperty(k)) {
                this[k] = (typeof(options[k]) !== 'undefined') ?
                    options[k] : this.defaults[k];
            }
        }
        return this;
    },

    // Get contents of a key in a bucket.
    get: function (bucket, key, cb, err_cb) {
        return this.httpClient({
            method: 'GET',
            key: key,
            bucket: bucket,
            load: cb, error: err_cb
        });
    },

    // Head the meta of a key in a bucket.
    head: function (bucket, key, cb, err_cb) {
        return this.httpClient({
            method: 'HEAD',
            key: key,
            bucket: bucket,
            load: cb, error: err_cb
        });
    },

    // Put data into a key in a bucket.
    put: function (bucket, key, content/*, [params], cb, [err_cb]*/) {

        // Process variable arguments for optional params.
        var idx = 3;
        var params = {};
        if (typeof arguments[idx] === 'object') {
            params = arguments[idx++];
        }
        var cb     = arguments[idx++];
        var err_cb = arguments[idx++];

        if (!params.content_type) {
            params.content_type = this.default_content_type;
        }
        if (!params.acl) {
            params.acl = this.default_acl;
        }

        return this.httpClient({
            method:       'PUT',
            key:          key,
            bucket:       bucket,
            content:      content,
            content_type: params.content_type,
            meta:         params.meta,
            acl:          params.acl,
            load: cb, error: err_cb
        });
    },

    // List buckets belonging to the account.
    listBuckets: function (cb, err_cb) {
        return this.httpClient({
            method: 'GET', resource:'/',
            force_lists: [ 'ListAllMyBucketsResult.Buckets.Bucket' ],
            load: cb, error: err_cb
        });
    },

    // Create a new bucket for this account.
    createBucket: function (bucket, cb, err_cb) {
        return this.httpClient({
            method: 'PUT', resource: '/'+bucket,
            load: cb, error: err_cb
        });
    },

    // Delete an empty bucket.
    deleteBucket: function (bucket, cb, err_cb) {
        return this.httpClient({
            method: 'DELETE', resource: '/'+bucket,
            load: cb, error: err_cb
        });
    },

    // Given a bucket name and parameters, list keys in the bucket.
    listKeys: function (bucket, params, cb, err_cb) {
        return this.httpClient({
            method: 'GET', resource: '/'+bucket,
            force_lists: [ 'ListBucketResult.Contents' ],
            params: params,
            load: cb, error: err_cb
        });
    },

    // Delete a single key in a bucket.
    deleteKey: function (bucket, key, cb, err_cb) {
        return this.httpClient({
            method:'DELETE', resource: '/'+bucket+'/'+key,
            load: cb, error: err_cb
        });
    },

    // Delete a list of keys in a bucket, with optional callbacks for each
    // deleted key and when list deletion is complete.
    deleteKeys: function (bucket, list, one_cb, all_cb) {
        var _this = this;

        // If the list is empty, then fire off the callback.
        if (!list.length && all_cb) { return all_cb(); }

        // Fire off key deletion with a callback to delete the
        // next part of list.
        var key = list.shift();
        this.deleteKey(bucket, key, function () {
            if (one_cb) { one_cb(key); }
            _this.deleteKeys(bucket, list, one_cb, all_cb);
        });
    },

    // Perform an authenticated S3 HTTP query.
    httpClient: function (kwArgs) {
        var _this = this;

        // If need to defeat cache, toss in a date param on GET.
        if (this.defeat_cache && (kwArgs.method === "GET" ||
                                  kwArgs.method === "HEAD") ) {
            if (!kwArgs.params) { kwArgs.params = {}; }
            kwArgs.params.___ = new Date().getTime();
        }

        // Prepare the query string and URL for this request.
        var qs = '', sub_qs = '';
        if (kwArgs.params) {
            qs = '?'+this.queryString(kwArgs.params);
            // Sub-resource parameters, if present, must be included in CanonicalizedResources.
            // NOTE: These paramters must be sorted lexicographically in StringToSign.
            var subresource_params = {};
            var subresource_params_all = ["acl", "lifecycle", "location", "logging",
                                          "notification", "partNumber", "policy",
                                          "requestPayment", "torrent", "uploadId",
                                          "uploads", "versionId", "versioning",
                                          "versions", "website"];
            for (var k in subresource_params_all)
                if (subresource_params_all[k] in kwArgs.params)
                    subresource_params[subresource_params_all[k]] = kwArgs.params[subresource_params_all[k]];
            sub_qs = Object.keys(subresource_params).length ? '?' + this.queryString(subresource_params) : '';
        }

        var resource, sig_resource;
        if (kwArgs.resource) {
            resource = sig_resource = kwArgs.resource;
        } else if (this.use_virtual) {
            resource = '/' + kwArgs.key;
            sig_resource = '/' + kwArgs.bucket + '/' + kwArgs.key;
        } else {
            resource = sig_resource = '/' + kwArgs.bucket + '/' + kwArgs.key;
        }
        var url = this.base_url + resource + qs;
        var hdrs = {};

        // Handle Content-Type header
        if (!kwArgs.content_type && kwArgs.method === 'PUT') {
            kwArgs.content_type = this.default_content_type;
        }
        if (kwArgs.content_type) {
            hdrs['Content-Type'] = kwArgs.content_type;
        } else {
            kwArgs.content_type = '';
        }

        // Set the timestamp for this request.
        var http_date = this.httpDate();
        hdrs['x-amz-date']  = http_date;

        var content_MD5 = '';
        /*
        // TODO: Fix this Content-MD5 stuff.
        if (kwArgs.content && kwArgs.content.hashMD5) {
            content_MD5 = kwArgs.content.hashMD5();
            hdrs['Content-MD5'] = content_MD5;
        }
        */

        // Handle the ACL parameter
        var acl_header_to_sign = '';
        if (kwArgs.acl) {
            hdrs['x-amz-acl'] = kwArgs.acl;
            acl_header_to_sign = "x-amz-acl:"+kwArgs.acl+"\n";
        }

        if (this.security_token)
            hdrs['x-amz-security-token'] = this.security_token;

        // Handle the metadata headers
        var meta_to_sign = '';
        if (kwArgs.meta) {
            for (var k in kwArgs.meta) {
                if (kwArgs.meta.hasOwnProperty(k)) {
                    hdrs['x-amz-meta-'+k] = kwArgs.meta[k];
                    meta_to_sign += "x-amz-meta-"+k+":"+kwArgs.meta[k]+"\n";
                }
            }
        }

        // Only perform authentication if non-anonymous and credentials available
        if (kwArgs.anonymous !== true && this.key_id && this.secret_key) {

            // Build the string to sign for authentication.
            var s = [
                kwArgs.method, "\n",
                content_MD5, "\n",
                kwArgs.content_type, "\n",
                "\n", // was Date header, no longer works with modern browsers.
                acl_header_to_sign,
                'x-amz-date:', http_date, "\n",
                this.security_token ? 'x-amz-security-token:' + this.security_token + "\n": '',
                meta_to_sign,
                sig_resource,
                sub_qs
            ].join('');

            // Sign the string with our secret_key.
            var signature = this.hmacSHA1(s, this.secret_key);
            hdrs.Authorization = "AWS "+this.key_id+":"+signature;
        }

        // Perform the HTTP request.
        var req = this.getXMLHttpRequest();
        req.open(kwArgs.method, url, true);
        for (var j in hdrs) {
            if (hdrs.hasOwnProperty(j)) {
                req.setRequestHeader(j, hdrs[j]);
            }
        }
        req.onreadystatechange = function () {
            if (req.readyState === 4) {

                // Pre-digest the XML if needed.
                var obj = null;
                if (req.responseXML && kwArgs.parseXML !== false) {
                    obj = _this.xmlToObj(req.responseXML, kwArgs.force_lists);
                }

                // Stash away the last request details, if debug active.
                if (_this.debug) {
                    window._lastreq = req;
                    window._lastobj = obj;
                }

                // Dispatch to appropriate handler callback
                if ( (req.status >= 400 || (obj && obj.Error) ) && kwArgs.error) {
                    return kwArgs.error(req, obj);
                } else {
                    return kwArgs.load(req, obj);
                }

            }
        };
        req.send(kwArgs.content);
        return req;
    },

    // Turn a simple structure of nested XML elements into a JavaScript object.
    //
    // TODO: Handle attributes?
    xmlToObj: function (parent, force_lists, path) {
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
    },

    // Abstract HMAC SHA1 signature calculation.
    // see: http://pajhome.org.uk/crypt/md5/sha1.js
    hmacSHA1: function (data, secret) {
        return b64_hmac_sha1(secret, data)+'=';
    },

    // Return a date formatted appropriately for HTTP Date header.
    // Inspired by: http://www.svendtofte.com/code/date_format/
    httpDate: function (d) {
        // Use now as default date/time.
        if (!d) { d = new Date(); }

        // Date abbreviations.
        var daysShort   = ["Sun", "Mon", "Tue", "Wed",
                           "Thu", "Fri", "Sat"];
        var monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // See: http://www.quirksmode.org/js/introdate.html#sol
        function takeYear (theDate) {
            var x = theDate.getYear();
            var y = x % 100;
            y += (y < 38) ? 2000 : 1900;
            return y;
        }

        // Number padding function
        function zeropad (num, sz) {
            return ( (sz - (""+num).length) > 0 ) ?
                arguments.callee("0"+num, sz) : num;
        }

        function gmtTZ (d) {
            // Difference to Greenwich time (GMT) in hours
            var os = Math.abs(d.getTimezoneOffset());
            var h = ""+Math.floor(os/60);
            var m = ""+(os%60);
            if (h.length === 1) { h = "0"+h; }
            if (m.length === 1) { m = "0"+m; }
            return d.getTimezoneOffset() < 0 ? "+"+h+m : "-"+h+m;
        }

        return [
            daysShort[d.getDay()], ", ",
            d.getDate(), " ",
            monthsShort[d.getMonth()], " ",
            takeYear(d), " ",
            zeropad(d.getHours(), 2), ":",
            zeropad(d.getMinutes(), 2), ":",
            zeropad(d.getSeconds(), 2), " ",
            gmtTZ(d)
        ].join('');
    },

    // Encode an object's properties as an query params
    queryString: function (params) {
        var k, l = [];
        for (k in params) {
            if (params.hasOwnProperty(k)) {
                l.push(k + (params[k] ? '=' + encodeURIComponent(params[k]) : ''));
            }
        }
        return l.join("&");
    },

    // Get an XHR object, somehow.
    getXMLHttpRequest: function () {
        // Shamelessly swiped from MochiKit/Async.js
        var self = arguments.callee;
        if (!self.XMLHttpRequest) {
            var tryThese = [
                function () { return new XMLHttpRequest(); },
                function () { return new ActiveXObject('Msxml2.XMLHTTP'); },
                function () { return new ActiveXObject('Microsoft.XMLHTTP'); },
                function () { return new ActiveXObject('Msxml2.XMLHTTP.4.0'); },
                function () { return null; }
            ];
            for (var i = 0; i < tryThese.length; i++) {
                var func = tryThese[i];
                try {
                    self.XMLHttpRequest = func;
                    return func();
                } catch (e) {
                    // pass
                }
            }
        }
        return self.XMLHttpRequest();
    }
};

/*jshint forin:true, noempty:true, eqeqeq:true, boss:true, bitwise:true, curly:true, browser:true, indent:4, maxerr:50 */

// HACK: Figure out how to make S3Ajax depend on sha1 in browserify, and look for a smaller lib?

/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS 180-1
 * Version 2.2 Copyright Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_sha1(s)    { return rstr2hex(rstr_sha1(str2rstr_utf8(s))); }
function b64_sha1(s)    { return rstr2b64(rstr_sha1(str2rstr_utf8(s))); }
function any_sha1(s, e) { return rstr2any(rstr_sha1(str2rstr_utf8(s)), e); }
function hex_hmac_sha1(k, d)
  { return rstr2hex(rstr_hmac_sha1(str2rstr_utf8(k), str2rstr_utf8(d))); }
function b64_hmac_sha1(k, d)
  { return rstr2b64(rstr_hmac_sha1(str2rstr_utf8(k), str2rstr_utf8(d))); }
function any_hmac_sha1(k, d, e)
  { return rstr2any(rstr_hmac_sha1(str2rstr_utf8(k), str2rstr_utf8(d)), e); }

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test()
{
  return hex_sha1("abc").toLowerCase() == "a9993e364706816aba3e25717850c26c9cd0d89d";
}

/*
 * Calculate the SHA1 of a raw string
 */
function rstr_sha1(s)
{
  return binb2rstr(binb_sha1(rstr2binb(s), s.length * 8));
}

/*
 * Calculate the HMAC-SHA1 of a key and some data (raw strings)
 */
function rstr_hmac_sha1(key, data)
{
  var bkey = rstr2binb(key);
  if(bkey.length > 16) bkey = binb_sha1(bkey, key.length * 8);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = binb_sha1(ipad.concat(rstr2binb(data)), 512 + data.length * 8);
  return binb2rstr(binb_sha1(opad.concat(hash), 512 + 160));
}

/*
 * Convert a raw string to a hex string
 */
function rstr2hex(input)
{
  try { hexcase } catch(e) { hexcase=0; }
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var output = "";
  var x;
  for(var i = 0; i < input.length; i++)
  {
    x = input.charCodeAt(i);
    output += hex_tab.charAt((x >>> 4) & 0x0F)
           +  hex_tab.charAt( x        & 0x0F);
  }
  return output;
}

/*
 * Convert a raw string to a base-64 string
 */
function rstr2b64(input)
{
  try { b64pad } catch(e) { b64pad=''; }
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var output = "";
  var len = input.length;
  for(var i = 0; i < len; i += 3)
  {
    var triplet = (input.charCodeAt(i) << 16)
                | (i + 1 < len ? input.charCodeAt(i+1) << 8 : 0)
                | (i + 2 < len ? input.charCodeAt(i+2)      : 0);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > input.length * 8) output += b64pad;
      else output += tab.charAt((triplet >>> 6*(3-j)) & 0x3F);
    }
  }
  return output;
}

/*
 * Convert a raw string to an arbitrary string encoding
 */
function rstr2any(input, encoding)
{
  var divisor = encoding.length;
  var remainders = Array();
  var i, q, x, quotient;

  /* Convert to an array of 16-bit big-endian values, forming the dividend */
  var dividend = Array(Math.ceil(input.length / 2));
  for(i = 0; i < dividend.length; i++)
  {
    dividend[i] = (input.charCodeAt(i * 2) << 8) | input.charCodeAt(i * 2 + 1);
  }

  /*
   * Repeatedly perform a long division. The binary array forms the dividend,
   * the length of the encoding is the divisor. Once computed, the quotient
   * forms the dividend for the next step. We stop when the dividend is zero.
   * All remainders are stored for later use.
   */
  while(dividend.length > 0)
  {
    quotient = Array();
    x = 0;
    for(i = 0; i < dividend.length; i++)
    {
      x = (x << 16) + dividend[i];
      q = Math.floor(x / divisor);
      x -= q * divisor;
      if(quotient.length > 0 || q > 0)
        quotient[quotient.length] = q;
    }
    remainders[remainders.length] = x;
    dividend = quotient;
  }

  /* Convert the remainders to the output string */
  var output = "";
  for(i = remainders.length - 1; i >= 0; i--)
    output += encoding.charAt(remainders[i]);

  /* Append leading zero equivalents */
  var full_length = Math.ceil(input.length * 8 /
                                    (Math.log(encoding.length) / Math.log(2)))
  for(i = output.length; i < full_length; i++)
    output = encoding[0] + output;

  return output;
}

/*
 * Encode a string as utf-8.
 * For efficiency, this assumes the input is valid utf-16.
 */
function str2rstr_utf8(input)
{
  var output = "";
  var i = -1;
  var x, y;

  while(++i < input.length)
  {
    /* Decode utf-16 surrogate pairs */
    x = input.charCodeAt(i);
    y = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
    if(0xD800 <= x && x <= 0xDBFF && 0xDC00 <= y && y <= 0xDFFF)
    {
      x = 0x10000 + ((x & 0x03FF) << 10) + (y & 0x03FF);
      i++;
    }

    /* Encode output as utf-8 */
    if(x <= 0x7F)
      output += String.fromCharCode(x);
    else if(x <= 0x7FF)
      output += String.fromCharCode(0xC0 | ((x >>> 6 ) & 0x1F),
                                    0x80 | ( x         & 0x3F));
    else if(x <= 0xFFFF)
      output += String.fromCharCode(0xE0 | ((x >>> 12) & 0x0F),
                                    0x80 | ((x >>> 6 ) & 0x3F),
                                    0x80 | ( x         & 0x3F));
    else if(x <= 0x1FFFFF)
      output += String.fromCharCode(0xF0 | ((x >>> 18) & 0x07),
                                    0x80 | ((x >>> 12) & 0x3F),
                                    0x80 | ((x >>> 6 ) & 0x3F),
                                    0x80 | ( x         & 0x3F));
  }
  return output;
}

/*
 * Encode a string as utf-16
 */
function str2rstr_utf16le(input)
{
  var output = "";
  for(var i = 0; i < input.length; i++)
    output += String.fromCharCode( input.charCodeAt(i)        & 0xFF,
                                  (input.charCodeAt(i) >>> 8) & 0xFF);
  return output;
}

function str2rstr_utf16be(input)
{
  var output = "";
  for(var i = 0; i < input.length; i++)
    output += String.fromCharCode((input.charCodeAt(i) >>> 8) & 0xFF,
                                   input.charCodeAt(i)        & 0xFF);
  return output;
}

/*
 * Convert a raw string to an array of big-endian words
 * Characters >255 have their high-byte silently ignored.
 */
function rstr2binb(input)
{
  var output = Array(input.length >> 2);
  for(var i = 0; i < output.length; i++)
    output[i] = 0;
  for(var i = 0; i < input.length * 8; i += 8)
    output[i>>5] |= (input.charCodeAt(i / 8) & 0xFF) << (24 - i % 32);
  return output;
}

/*
 * Convert an array of big-endian words to a string
 */
function binb2rstr(input)
{
  var output = "";
  for(var i = 0; i < input.length * 32; i += 8)
    output += String.fromCharCode((input[i>>5] >>> (24 - i % 32)) & 0xFF);
  return output;
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function binb_sha1(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = bit_rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(bit_rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = bit_rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}
