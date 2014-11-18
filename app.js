(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"./src/javascript/app.js":[function(require,module,exports){
(function (global){
var PubSub = require('pubsub-js');
var misc = require('./misc');
var publishers = require('./publishers/index');
var microformats = require('microformat-shiv').microformats;

var async = require('async');
var _ = require('underscore');
var $ = (typeof window !== "undefined" ? window.$ : typeof global !== "undefined" ? global.$ : null);

require('timeago');

var config = _.extend({
  HUB_PING_URL: 'https://localhost:4040/api/ping'
}, {
  "lmorchard.github.io": {
    HUB_PING_URL: 'https://toothub.herokuapp.com/api/ping'
  }
}[location.hostname]);

var publisher = null;
var profile = null;

var elAbout = $('section#about');
var hcard = elAbout.find('dl.h-card');

$('button#logout').click(publishers.logout);
$('button#profileEdit').click(handleProfileEdit);
$('button#profileEditDone').click(handleProfileEditDone);
$('form#toot').submit(handleTootFormSubmit);
$('#entries')
  .delegate('.h-entry', 'click', handleEntryClick)
  .delegate('button.entry-delete', 'click', handleEntryDelete)
  .delegate('button.entry-undo-delete', 'click', handleEntryUndoDelete)
  .delegate('button.entry-edit', 'click', handleEntryEdit)
  .delegate('button.entry-edit-done', 'click', handleEntryEditDone);

PubSub.subscribe('publishers.setCurrent', handleSignIn);
PubSub.subscribe('publishers.clearCurrent', handleSignOut);

publishers.checkAuth();

function handleSignIn (msg, currentPublisher) {
  publisher = currentPublisher;
  profile = publishers.getProfile();

  $('body').addClass('logged-in').removeClass('logged-out');
  $('.session').fillOut({
    'a.home @href': profile.url,
    'a.username': profile.nickname,
    '.avatar img @src': profile.avatar,
    '.avatar img @title': profile.name,
    '.avatar img @alt': profile.name
  });

  publisher.list('', function (err, resources) {
    if (err) {
      return console.log("LIST ERR " + JSON.stringify(err, null, '  '));
    } else if ('index.html' in resources) {
      return loadToots(publisher);
    } else {
      return firstRun(publisher);
    }
  });
}

function handleSignOut (msg) {
  $('body').removeClass('logged-in').addClass('logged-out');
  $('#entries').empty();
}

function handleProfileEdit (ev) {
  elAbout.addClass('editing');

  hcard.find('dd').each(function () {
    var dd = $(this);
    var field;
    if (dd.hasClass('readonly')) {
      return;
    } else if (dd.hasClass('textarea')) {
      field = $('<textarea class="ui-only form-control"></textarea>');
    } else {
      field = $('<input type="text" class="ui-only form-control">');
    }
    dd.after(field);
    field.val(dd.html().trim());
    field.change(function (ev) {
      dd.html(field.val());
    });
  });

  hcard.find('input, textarea').eq(0).focus();
}

function handleProfileEditDone (ev) {
  elAbout.find('.ui-only').remove();
  elAbout.removeClass('editing');
  saveToots(publisher);
}

function handleTootFormSubmit (ev) {
  // React to toot form submission by adding a new toot
  var textarea = $(this).find('[name=content]');
  var content = textarea.val().trim();
  if (!content) { return; }
  textarea.val('');
  addToot(publisher, { content: content });
  saveToots(publisher);
  return false;
}

function handleEntryClick (ev) {
  // Toggle per-entry editing UI on click
  var entry = $(this);
  if (entry.hasClass('editing')) {
    return false;
  }
  if (entry.hasClass('show-ui')) {
    entry.find('footer.entry-edit-footer').remove();
  } else {
    $('.templates .entry-edit-footer').clone().appendTo(entry);
  }
  entry.toggleClass('show-ui');

  return false;
}

function handleEntryDelete (ev) {
  // Delete with undo by tucking the entry into panel
  var button = $(this);
  var entry = button.parents('.h-entry');

  entry.fadeOut(function () {
    entry.removeClass('h-entry').addClass('deleted-h-entry');
    $('.templates .entry-undo-delete-panel').clone()
      .insertAfter(entry).append(entry);
    saveToots(publisher);
  });

  return ev.stopPropagation();
}

function handleEntryUndoDelete (ev) {
  // Undo delete by unpacking entry from the panel
  var button = $(this);
  var panel = button.parents('.entry-undo-delete-panel');
  var entry = panel.find('.deleted-h-entry');

  panel.fadeOut(function () {
    entry.insertAfter(panel).fadeIn(function () {
      panel.remove();
      saveToots(publisher);
    }).addClass('h-entry').removeClass('deleted-h-entry');
  });

  ev.stopPropagation();
}

function handleEntryEdit (ev) {
  // Set up entry editor and hide the content
  var button = $(this);
  var entry = button.parents('.h-entry');
  var content = entry.find('.e-content');
  var field = $('.templates .entry-editor').clone();

  entry.addClass('editing');
  field.insertAfter(content)
    .val(content.html())
    .change(function () {
      content.html(field.val());
    });

  ev.stopPropagation();
}

function handleEntryEditDone (ev) {
  // Remove the editor and save changes
  var button = $(this);
  var entry = button.parents('.h-entry');
  var field = entry.find('textarea');
  var content = entry.find('.e-content');

  entry.removeClass('editing');
  content.html(field.val());
  saveToots(publisher);
  field.remove();

  ev.stopPropagation();
}

function firstRun (publisher) {
  var assets = [
    {src: 'site.html', dest: 'index.html'},
    {src: 'site.css', dest: 'site.css'},
    {src: 'site.js', dest: 'site.js'}
  ];
  async.each(assets, function (asset, next) {
    $.get(asset.src, function (content) {
      publisher.put(asset.dest, content, next);
    });
  }, function (err) {
    if (err) {
      console.log("First run error: " + err);
    }
  });
}

function addToot (publisher, data) {
  data.profile = data.profile || profile;
  data.published = data.published || (new Date()).toISOString();
  data.id = 'toot-' + Date.now() + '-' + _.random(0, 100);
  data.permalink = '#' + data.id;

  $('.templates .h-entry').clone().fillOut({
    '@id': data.id,
    '.e-content': data.content,
    '.dt-published': data.published,
    '.dt-published @datetime': data.published,
    '.u-url @href': data.permalink,
    '.h-card .u-photo @src': data.profile.avatar,
    '.h-card .u-url @href': data.profile.url,
    '.h-card .p-nickname': data.profile.nickname,
    '.h-card .p-name': data.profile.name
  }).prependTo('#entries').find('time').timeago();
}

function loadToots (publisher) {
  publisher.get('index.html', function (err, content) {
    // TODO: Retain etag here to detect changes since we loaded
    var docIndex = document.implementation.createHTMLDocument('');
    docIndex.documentElement.innerHTML = content;
    copyToots(docIndex, document);
    $('time').timeago();
  });
}

function saveToots (publisher) {
  $.get('site.html', function (content) {
    var docIndex = document.implementation.createHTMLDocument('');
    docIndex.documentElement.innerHTML = content;
    copyToots(document, docIndex);
    var content = docIndex.documentElement.outerHTML;
    // TODO: Check etag here to detect changes since we loaded
    publisher.put('index.html', content, function (err) {
      if (err) {
        console.log("ERROR SAVING TOOTS " + err);
      } else {
        pingTootHub();
      }
    });
  });

  // TODO: Find a better way to ensure JS/CSS stays updated after first run
  var assets = [
    {src: 'site.css', dest: 'site.css'},
    {src: 'site.js', dest: 'site.js'}
  ];
  async.each(assets, function (asset, next) {
    $.get(asset.src, function (content) {
      publisher.put(asset.dest, content, next);
    });
  }, function (err) {
    if (err) {
      console.log("Upgrade error: " + err);
    }
  });
}

function copyToots (docFrom, docTo) {

  var card = _.extend({}, profile);

  var cards = microformats.getItems({
    filters: ['h-card'],
    document: docFrom,
    node: docFrom.querySelector('#about')
  });
  if (cards.items.length && cards.items[0].properties) {
    _.extend(card, misc.flatten(cards.items[0].properties));
  }

  $('.h-card', docTo).fillOut({
    '.u-url @href': card.url,
    '.u-photo @src': card.avatar,
    '.p-nickname': card.nickname,
    '.p-name': card.name,
    '.p-note': card.note
  });

  var entries = microformats.getItems({
    filters: ['h-entry'],
    document: docFrom,
    node: docFrom.querySelector('#entries')
  });

  $('#entries', docTo).empty();

  var tmpl = $('.templates .h-entry', docTo);
  if (!tmpl.length) {
    tmpl = $('.templates .h-entry', docFrom);
  }

  entries.items.forEach(function (item) {
    var props = misc.flatten(item.properties);
    tmpl.clone().fillOut({
      '.e-content': props.content,
      '.dt-published': props.published,
      '.dt-published @datetime': props.published,
      '.u-url @href': props.url,
      '.h-card .p-nickname': card.nickname,
      '.h-card .p-name': card.name,
      '.h-card .u-photo @src': card.avatar,
      '.h-card .u-url @href': card.url
    }).appendTo($('#entries', docTo));
  });

}

function pingTootHub () {
  $.ajax({
    type: 'POST',
    url: config.HUB_PING_URL,
    json: true,
    data: { url: profile.url }
  }).then(function (data, status, xhr) {
    console.log('Ping sent');
  }).fail(function (xhr, status, err) {
    console.error(err);
  });
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./misc":"/home/lmorchard/devel/tootr/src/javascript/misc.js","./publishers/index":"/home/lmorchard/devel/tootr/src/javascript/publishers/index.js","async":"/home/lmorchard/devel/tootr/node_modules/async/lib/async.js","microformat-shiv":"/home/lmorchard/devel/tootr/node_modules/microformat-shiv/microformat-shiv.js","pubsub-js":"/home/lmorchard/devel/tootr/node_modules/pubsub-js/src/pubsub.js","timeago":"/home/lmorchard/devel/tootr/src/javascript/vendor/jquery.timeago.js","underscore":"/home/lmorchard/devel/tootr/node_modules/underscore/underscore.js"}],"/home/lmorchard/devel/tootr/node_modules/async/lib/async.js":[function(require,module,exports){
(function (process){
/*!
 * async
 * https://github.com/caolan/async
 *
 * Copyright 2010-2014 Caolan McMahon
 * Released under the MIT license
 */
/*jshint onevar: false, indent:4 */
/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _toString = Object.prototype.toString;

    var _isArray = Array.isArray || function (obj) {
        return _toString.call(obj) === '[object Array]';
    };

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = function (fn) {
              // not a direct alias for IE10 compatibility
              setImmediate(fn);
            };
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(done) );
        });
        function done(err) {
          if (err) {
              callback(err);
              callback = function () {};
          }
          else {
              completed += 1;
              if (completed >= arr.length) {
                  callback();
              }
          }
        }
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback();
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        if (!callback) {
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err) {
                    callback(err);
                });
            });
        } else {
            var results = [];
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err, v) {
                    results[x.index] = v;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        var remainingTasks = keys.length
        if (!remainingTasks) {
            return callback();
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            remainingTasks--
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (!remainingTasks) {
                var theCallback = callback;
                // prevent final callback from calling itself if it errors
                callback = function () {};

                theCallback(null, results);
            }
        });

        _each(keys, function (k) {
            var task = _isArray(tasks[k]) ? tasks[k]: [tasks[k]];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.retry = function(times, task, callback) {
        var DEFAULT_TIMES = 5;
        var attempts = [];
        // Use defaults if times not passed
        if (typeof times === 'function') {
            callback = task;
            task = times;
            times = DEFAULT_TIMES;
        }
        // Make sure times is a number
        times = parseInt(times, 10) || DEFAULT_TIMES;
        var wrappedTask = function(wrappedCallback, wrappedResults) {
            var retryAttempt = function(task, finalAttempt) {
                return function(seriesCallback) {
                    task(function(err, result){
                        seriesCallback(!err || finalAttempt, {err: err, result: result});
                    }, wrappedResults);
                };
            };
            while (times) {
                attempts.push(retryAttempt(task, !(times-=1)));
            }
            async.series(attempts, function(done, data){
                data = data[data.length - 1];
                (wrappedCallback || callback)(data.err, data.result);
            });
        }
        // If a callback is passed, run this as a controll flow
        return callback ? wrappedTask() : wrappedTask
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (!_isArray(tasks)) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (test.apply(null, args)) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (!test.apply(null, args)) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            started: false,
            paused: false,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            kill: function () {
              q.drain = null;
              q.tasks = [];
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (!q.paused && workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            },
            idle: function() {
                return q.tasks.length + workers === 0;
            },
            pause: function () {
                if (q.paused === true) { return; }
                q.paused = true;
                q.process();
            },
            resume: function () {
                if (q.paused === false) { return; }
                q.paused = false;
                q.process();
            }
        };
        return q;
    };
    
    async.priorityQueue = function (worker, concurrency) {
        
        function _compareTasks(a, b){
          return a.priority - b.priority;
        };
        
        function _binarySearch(sequence, item, compare) {
          var beg = -1,
              end = sequence.length - 1;
          while (beg < end) {
            var mid = beg + ((end - beg + 1) >>> 1);
            if (compare(item, sequence[mid]) >= 0) {
              beg = mid;
            } else {
              end = mid - 1;
            }
          }
          return beg;
        }
        
        function _insert(q, data, priority, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  priority: priority,
                  callback: typeof callback === 'function' ? callback : null
              };
              
              q.tasks.splice(_binarySearch(q.tasks, item, _compareTasks) + 1, 0, item);

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }
        
        // Start with a normal queue
        var q = async.queue(worker, concurrency);
        
        // Override push to accept second parameter representing priority
        q.push = function (data, priority, callback) {
          _insert(q, data, priority, callback);
        };
        
        // Remove unshift function
        delete q.unshift;

        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            drained: true,
            push: function (data, callback) {
                if (!_isArray(data)) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    cargo.drained = false;
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain && !cargo.drained) cargo.drain();
                    cargo.drained = true;
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0, tasks.length);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                async.nextTick(function () {
                    callback.apply(null, memo[key]);
                });
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.seq = function (/* functions... */) {
        var fns = arguments;
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    async.compose = function (/* functions... */) {
      return async.seq.apply(null, Array.prototype.reverse.call(arguments));
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // AMD / RequireJS
    else if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

}).call(this,require('_process'))
},{"_process":"/home/lmorchard/devel/tootr/node_modules/browserify/node_modules/process/browser.js"}],"/home/lmorchard/devel/tootr/node_modules/browserify/node_modules/process/browser.js":[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],"/home/lmorchard/devel/tootr/node_modules/microformat-shiv/microformat-shiv.js":[function(require,module,exports){
/*!
	Parser
	Copyright (C) 2012 Glenn Jones. All Rights Reserved.
	MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt

	*/

var microformats = {};



// The module pattern
microformats.Parser = function () {
    this.version = '0.3.1';
	this.rootPrefix = 'h-';
	this.propertyPrefixes = ['p-', 'dt-', 'u-', 'e-'];
	this.options = {
		'baseUrl': '',
		'filters': [],
		'version1': true,
		'children': true,
		'childrenRel': false,
		'rel': true,
		'includes': true,
		'textFormat': 'normalised'
	};
	this.maps = {};
	this.rels = {};
};


microformats.Parser.prototype = {

	// internal parse function 
	get: function(dom, rootNode, options) {
		var errors = null,
			items, 
			children, 
			data = [],
			ufs = [],
			x,
			i,
			z,			
			y,
			rels,
			baseTag,
			href;

		this.mergeOptions(options);
		this.rootID = 0;

		if(!dom || !rootNode){
			errors = [{'error': 'No DOM or rootNode given'}];
			return {'errors': errors, 'data': {}};
		}else{

			// add includes
			if(this.options.includes){
				this.addIncludes(dom, rootNode);
			}
			
			// find base tag to set baseUrl
 			baseTag = dom.querySelector('base');
			if(baseTag) {
				href = this.domUtils.getAttribute(dom, baseTag, 'href');
				if(href){
					this.options.baseUrl = href;
				}
			}

			// find starts points in the DOM
			items = this.findRootNodes(dom, rootNode);
			if(items && !errors) {
				x = 0;
				i = items.length;
				while(x < i) {
					if(!this.domUtils.hasAttribute(dom, items[x], 'data-include')) {
						// find microformats - return as an array, there maybe more than one root on a element
						ufs = this.walkTree(dom, items[x], true);
						z = 0;
						y = ufs.length;
						while(z < y) {
							// make sure its a valid structure and apply filter if its requested  
							if(ufs[z] && this.utils.hasProperties(ufs[z].properties) && this.shouldInclude(ufs[z], this.options.filters)) {
								// find any children in the microformats dom tree that are not attached toa property
								if(this.options.children){
									children = this.findChildItems(dom, items[x], ufs[z].type[0]);
									if(children.length > 0) {
										ufs[z].children = children;
									}
								}
								data.push(ufs[z]);
							}
							z++;
						}
					}
					x++;
				}
			}

			// find any rel
			if(this.options.rel){
				rels = this.findRels(dom, rootNode);
				if(rels && this.shouldInclude(rels, this.options.filters)) {
					data.push(rels);
				}
			}

		}
		this.clearUpDom(dom);
		return {'items': data};
	},


	// get the count of items
	count: function(dom, rootNode, options) {
		var out = {},
			keys = [],
			count,
			x,
			i;

		items = this.findRootNodes(dom, rootNode);	
		i = items.length;
		while(i--) {
			classItems = this.domUtils.getAttributeList(dom, items[i], 'class');
			x = classItems.length;
			while(x--) {
				// find v2 names
				if(this.utils.startWith( classItems[x], 'h-' )){
					append(classItems[x], 1);
				}
				// find v1 names
				for(key in this.maps) {
					// has v1 root but not also a v2 root so we dont double count
					if(this.maps[key].root === classItems[x] && classItems.indexOf(key) === -1) {
						append(key, 1);
					}
				}
			}
		}
		
		function append(name, count){
			if(out[name]){
				out[name] = out[name] + count;
			}else{
				out[name] = count;
			}
		}
	
		return out;
	},


	// is the uf type in the filter list
	shouldInclude: function(uf, filters) {
		var i;

		if(this.utils.isArray(filters) && filters.length > 0) {
			i = filters.length;
			while(i--) {
				if(uf.type[0] === filters[i]) {
					return true;
				}
			}
			return false;
		} else {
			return true;
		}
	},


	// finds uf within the tree of a parent uf but where they have on property
	findChildItems: function(dom, rootNode, ufName) {
		var items, 
			out = [],
			ufs = [],
			x,
			i,
			z,			
			y,
			rels;


		items = this.findRootNodes(dom, rootNode, true);
		if(items.length > 0) {
			i = items.length;
			x = 0; // 1 excludes parent
			while(x < i) {
				var classes = this.getUfClassNames(dom, items[x], ufName);
				if(classes.root.length > 0 && classes.properties.length === 0) {
					ufs = this.walkTree(dom, items[x], true);
					y = ufs.length;
					z = 0;
					while(z < y) {
						// make sure its a valid structure 
						if(ufs[z] && this.utils.hasProperties(ufs[z].properties)) {
							out.push(ufs[z]);
						}
						z++;
					}
				}
				x++;
			}
		}

		// find any rel add them as child even if the node a property
		if(this.options.rel && this.options.childrenRel){
			rels = this.findRels(dom, rootNode);
			if(rels) {
				out.push(rels);
			}
		}

		return out;
	},





	// returns all the root nodes in a document
	findRootNodes: function(dom, rootNode, fromChildren) {
		var arr = null,			
			out = [], 
			classList = [],
			test,
			items,
			x,
			i,
			y,
			key;


		// build any array of v1 root names    
		for(key in this.maps) {
			classList.push(this.maps[key].root);
		}

		// get all elements that have a class attribute  
		fromChildren = (fromChildren) ? fromChildren : false;
		if(fromChildren) {
			arr = this.domUtils.getNodesByAttribute(dom, rootNode, 'class');
		} else {
			arr = this.domUtils.getNodesByAttribute(dom, rootNode, 'class');
		}


		// loop elements that have a class attribute
		x = 0;    
		i = arr.length;
		while(x < i) {

			items = this.domUtils.getAttributeList(dom, arr[x], 'class');

			// loop classes on an element
			y = items.length;
			while(y--) {
				// match v1 root names 
				if(classList.indexOf(items[y]) > -1) {
					out.push(arr[x]);
					break;
				}

				// match v2 root name prefix
				if(this.utils.startWith(items[y], 'h-')) {
					out.push(arr[x]);
					break;
				}
			}

			x++;
		}
		return out;
	},


	// starts the tree walking for a single microformat
	walkTree: function(dom, node) {
		var classes,
			out = [],
			obj,
			itemRootID,
			x,
			i;

		// loop roots found on one element
		classes = this.getUfClassNames(dom, node);
		if(classes){
			x = 0;
			i = classes.root.length;
			while(x < i) {
				this.rootID++;
				itemRootID = this.rootID,
				obj = this.createUfObject(classes.root[x]);

				this.walkChildren(dom, node, obj, classes.root[x], itemRootID);
				this.impliedRules(dom, node, obj);
				out.push(obj);
				x++;
			}
		}
		return out;
	},


	// test for the need to apply the "implied rules" for name, photo and url
	impliedRules: function(dom, node, uf) {
		var context = this,
			value,
			descendant,
			newDate;


		function getNameAttr(dom, node) {
			var value = context.domUtils.getAttrValFromTagList(dom, node, ['img'], 'alt');
			if(!value) {
				value = context.domUtils.getAttrValFromTagList(dom, node, ['abbr'], 'title');
			}
			return value;
		}

		function getPhotoAttr(dom, node) {
			var value = context.domUtils.getAttrValFromTagList(dom, node, ['img'], 'src');
			if(!value) {
				value = context.domUtils.getAttrValFromTagList(dom, node, ['object'], 'data');
			}
			return value;
		}


		if(uf && uf.properties) {
			
			// implied name rule
			/*
				img.h-x[alt]
				abbr.h-x[title] 
				.h-x>img:only-node[alt] 
				.h-x>abbr:only-node[title] 
				.h-x>:only-node>img:only-node[alt]
				.h-x>:only-node>abbr:only-node[title] 
			*/

			if(!uf.properties.name) {
				value = getNameAttr(dom, node);
				if(!value) {
					descendant = this.domUtils.isSingleDescendant(dom, node, ['img', 'abbr']);
					if(descendant){
						value = getNameAttr(dom, descendant);
					}
					if(node.children.length > 0){
						child = this.domUtils.isSingleDescendant(dom, node);
						if(child){
							descendant = this.

							domUtils.isSingleDescendant(dom, child, ['img', 'abbr']);
							if(descendant){
								value = getNameAttr(dom, descendant);
							}
						}
					}
				}
				if(!value) {
					value = this.text.parse(dom, node, this.options.textFormat);
				}
				if(value) {
					uf.properties.name = [this.utils.trim(value).replace(/[\t\n\r ]+/g, ' ')];
				}
			}


			// implied photo rule
			/*
				img.h-x[src] 
				object.h-x[data] 
				.h-x>img[src]:only-of-type
				.h-x>object[data]:only-of-type 
				.h-x>:only-child>img[src]:only-of-type 
				.h-x>:only-child>object[data]:only-of-type 
			*/
			if(!uf.properties.photo) {
				value = getPhotoAttr(dom, node);
				if(!value) {
					descendant = this.domUtils.isOnlySingleDescendantOfType(dom, node, ['img', 'object']);
					if(descendant){
						value = getPhotoAttr(dom, descendant);
					}

					// single child that has a single descendant that is a img or object i.e. .h-x>:only-child>img[src]:only-of-type
					if(node.children.length > 0){
						child = this.domUtils.isSingleDescendant(dom, node);
						if(child){
							descendant = this.domUtils.isOnlySingleDescendantOfType(dom, child, ['img', 'object']);
							if(descendant){
								value = getPhotoAttr(dom, descendant);
							}
						}
					}
				}
				if(value) {
					// if we have no protocal separator, turn relative url to absolute ones
					if(value && value !== '' && value.indexOf(':') === -1) {
						value = this.domUtils.resolveUrl(dom, value, this.options.baseUrl);
					}
					uf.properties.photo = [this.utils.trim(value)];
				}
			}
			// implied url rule
			if(!uf.properties.url) {
				value = this.domUtils.getAttrValFromTagList(dom, node, ['a'], 'href');
				if(value) {
					uf.properties.url = [this.utils.trim(value)];
				}
			}

		}

		// implied date rule - temp fix
		// only apply to first date and time match
		if(uf.times.length > 0 && uf.dates.length > 0) {
			newDate = this.dates.dateTimeUnion(uf.dates[0][1], uf.times[0][1]);
			uf.properties[this.removePropPrefix(uf.times[0][0])][0] = newDate.toString();
		}
		delete uf.times;
		delete uf.dates;

	},


	// find child properties of microformat
	walkChildren: function(dom, node, out, ufName, rootID) {
		var context = this,
			childOut = {},
			rootItem,
			itemRootID,
			value,
			propertyName,
			i,
			x,
			y,
			z, 
			child;

		y = 0;
		z = node.children.length;
		while(y < z) {
			child = node.children[y];
	
			// get uf classes for this single element
			var classes = context.getUfClassNames(dom, child, ufName);

			// a property which is a microformat
			if(classes.root.length > 0 && classes.properties.length > 0) {
				// create object with type, property and value
				rootItem = context.createUfObject(
					classes.root, 
					this.text.parse(dom, child, this.options.textFormat)
				);

				// add the microformat as an array of properties
				propertyName = context.removePropPrefix(classes.properties[0]);
				if(out.properties[propertyName]) {
					out.properties[propertyName].push(rootItem);
				} else {
					out.properties[propertyName] = [rootItem];
				}
				context.rootID++;

				x = 0;
				i = rootItem.type.length;
				itemRootID = context.rootID;
				while(x < i) {
					context.walkChildren(dom, child, rootItem, rootItem.type[x], itemRootID);
					x++;
				}
				context.impliedRules(dom, child, rootItem);
			}

			// a property which is NOT a microformat and has not been use for a given root element
			if(classes.root.length === 0 && classes.properties.length > 0) {
				
				x = 0;
				i = classes.properties.length;
				while(x < i) {

					value = context.getValue(dom, child, classes.properties[x], out);
					propertyName = context.removePropPrefix(classes.properties[x]);

					// if the value is not empty 
					// and we have not added this value into a property with the same name already
					if(value !== '' && !context.hasRootID(dom, child, rootID, propertyName)) {
					//if(value !== '') {
						// add the property as a an array of properties 
						if(out.properties[propertyName]) {
							out.properties[propertyName].push(value);
						} else {
							out.properties[propertyName] = [value];
						}
						// add rootid to node so we track it use
						context.appendRootID(dom, child, rootID, propertyName);
					}
					x++;
				}

				context.walkChildren(dom, child, out, ufName, rootID);
			}

			// if the node has no uf classes, see if its children have
			if(classes.root.length === 0 && classes.properties.length === 0) {
				context.walkChildren(dom, child, out, ufName, rootID);
			}

			y++;
		}

	},



	// gets the value of a property
	getValue: function(dom, node, className, uf) {
		var value = '';

		if(this.utils.startWith(className, 'p-')) {
			value = this.getPValue(dom, node, true);
		}

		if(this.utils.startWith(className, 'e-')) {
			value = this.getEValue(dom, node);
		}

		if(this.utils.startWith(className, 'u-')) {
			value = this.getUValue(dom, node, true);
		}

		if(this.utils.startWith(className, 'dt-')) {
			value = this.getDTValue(dom, node, className, uf, true);
		}
		return value;
	},


	// gets the value of node which contain 'p-' property
	getPValue: function(dom, node, valueParse) {
		var out = '';
		if(valueParse) {
			out = this.getValueClass(dom, node, 'p');
		}

		if(!out && valueParse) {
			out = this.getValueTitle(dom, node);
		}

		if(!out) {
			out = this.domUtils.getAttrValFromTagList(dom, node, ['abbr'], 'title');
		}

		if(!out) {
			out = this.domUtils.getAttrValFromTagList(dom, node, ['data'], 'value');
		}

		if(node.name === 'br' || node.name === 'hr') {
			out = '';
		}

		if(!out) {
			out = this.domUtils.getAttrValFromTagList(dom, node, ['img', 'area'], 'alt');
		}

		if(!out) {
			out = this.text.parse(dom, node, this.options.textFormat);
		}

		return(out) ? out : '';
	},


	// get the value of node which contain 'e-' property
	getEValue: function(dom, node) {
		node = this.expandURLs(dom, node, this.options.baseUrl)
		return this.domUtils.innerHTML(dom, node);
	},


	// get the value of node which contain 'u-' property
	getUValue: function(dom, node, valueParse) {
		// not sure this should be used for u property
		var out = '';
		if(valueParse) {
			out = this.getValueClass(dom, node, 'u');
		}

		if(!out && valueParse) {
			out = this.getValueTitle(dom, node);
		}

		if(!out) {
			out = this.domUtils.getAttrValFromTagList(dom, node, ['a', 'area'], 'href');
		}

		if(!out) {
			out = this.domUtils.getAttrValFromTagList(dom, node, ['img'], 'src');
		}

		if(!out) {
			out = this.domUtils.getAttrValFromTagList(dom, node, ['object'], 'data');
		}

		// if we have no protocal separator, turn relative url to absolute ones
		if(out && out !== '' && out.indexOf(':') === -1) {
			out = this.domUtils.resolveUrl(dom, out, this.options.baseUrl);
		}

		if(!out) {
			out = this.domUtils.getAttrValFromTagList(dom, node, ['abbr'], 'title');
		}

		if(!out) {
			out = this.domUtils.getAttrValFromTagList(dom, node, ['data'], 'value');
		}

		if(!out) {
			out = this.text.parse(dom, node, this.options.textFormat);
		}

		return(out) ? out : '';
	},


	// get the value of node which contain 'dt-' property
	getDTValue: function(dom, node, className, uf, valueParse) {
		var out = '',
			format = 'uf';

		if(valueParse) {
			out = this.getValueClass(dom, node, 'dt');
		}

		if(!out && valueParse) {
			out = this.getValueTitle(dom, node);
		}

		if(!out) {
			out = this.domUtils.getAttrValFromTagList(dom, node, ['time', 'ins', 'del'], 'datetime');
		}

		if(!out) {
			out = this.domUtils.getAttrValFromTagList(dom, node, ['abbr'], 'title');
		}

		if(!out) {
			out = this.domUtils.getAttrValFromTagList(dom, node, ['data'], 'value');
		}

		if(!out) {
			out = this.text.parse(dom, node, this.options.textFormat);
		}

		if(out) {
			if(this.dates.isDuration(out)) {
				// just duration
				return out;
			} else if(this.dates.isTime(out)) {
				// just time or time+timezone
				if(uf) {
					uf.times.push([className, this.dates.parseAmPmTime(out)]);
				}
				return this.dates.parseAmPmTime(out);
			} else {
				// returns a date - uf profile 
				if(out.indexOf(' ') > 0){
					format = 'HTML5'
				}
				if(uf) {
					uf.dates.push([className, new ISODate(out).toString( format )]);
				}

				return new ISODate(out).toString( format );
			}
		} else {
			return '';
		}
	},


	// appends a new rootid to a given node
	appendRootID: function(dom, node, id, propertyName) {
		var rootids = [];
		if(this.domUtils.hasAttribute(dom, node,'rootids')){
			rootids = this.domUtils.getAttributeList(dom, node,'rootids');
		}
		rootids.push('id' + id + '-' + propertyName);
		this.domUtils.setAttribute(dom, node, 'rootids', rootids.join());
	},


	// does a given node already have a rootid
	hasRootID: function(dom, node, id, propertyName) {
		var rootids = [];
		if(!this.domUtils.hasAttribute(dom, node,'rootids')){
			return false;
		} else {
			rootids = this.domUtils.getAttributeList(dom, node, 'rootids');
			return(rootids.indexOf('id' + id + '-' + propertyName) > -1);
		}
	},


	// gets the text of any child nodes with the class value
	getValueClass: function(dom, node, propertyType) {
		var context = this,
			out = [],
			child,
			x,
			i;

		x = 0;
		i = node.children.length;
		while(x < i) {
			child = node.children[x];
			var value = null;
			if(this.domUtils.hasAttributeValue(dom, child, 'class', 'value')) {
				switch(propertyType) {
				case 'p':
					value = context.getPValue(dom, child, false);
					break;
				case 'u':
					value = context.getUValue(dom, child, false);
					break;
				case 'dt':
					value = context.getDTValue(dom, child, '', null, false);
					break;
				}
				if(value) {
					out.push(this.utils.trim(value));
				}
			}
			x++;
		}
		if(out.length > 0) {
			if(propertyType === 'p') {
				return out.join(' ').replace(/[\t\n\r ]+/g, ' ');
			}
			if(propertyType === 'u') {
				return out.join('');
			}
			if(propertyType === 'dt') {
				return this.dates.concatFragments(out).toString();
			}
		} else {
			return null;
		}
	},


	// returns a single string of the 'title' attr from all 
	// the child nodes with the class 'value-title' 
	getValueTitle: function(dom, node) {
		var out = [],
			items,
			i,
			x;

		items = this.domUtils.getNodesByAttributeValue(dom, node, 'class', 'value-title');
		x = 0;
		i = items.length;		
		while(x < i) {
			if(this.domUtils.hasAttribute(dom, items[x], 'title')) {
				out.push(this.domUtils.getAttribute(dom, items[x], 'title'));
			}
			x++;
		}
		return out.join('');
	},



	// returns any uf root and property assigned to a single element
	getUfClassNames: function(dom, node, ufName) {
		var out = {
				'root': [],
				'properties': []
			},
			classNames,
			key,
			items,
			item,
			i,
			x,
			z,
			y,
			map,
			prop,
			propName,
			v2Name,
			impiedRel;


		classNames = this.domUtils.getAttribute(dom, node, 'class');
		if(classNames) {
			items = classNames.split(' ');
			x = 0;
			i = items.length;
			while(x < i) {

				item = this.utils.trim(items[x]);

				// test for root prefix - v2
				if(this.utils.startWith(item, this.rootPrefix) && out.root.indexOf(item) === -1) {
					out.root.push(item);
				}

				// test for property prefix - v2
				z = this.propertyPrefixes.length;
				while(z--) {
					if(this.utils.startWith(item, this.propertyPrefixes[z]) && out.properties.indexOf(item) === -1) {
						out.properties.push(item);
					}
				}

				if(this.options.version1){

					// test for mapped root classnames v1
					for(key in this.maps) {
						if(this.maps.hasOwnProperty(key)) {
							// only add a root once
							if(this.maps[key].root === item && out.root.indexOf(key) === -1) {
								// if root map has subTree set to true
								// test to see if we should create a property or root
								if(this.maps[key].subTree && this.isSubTreeRoot(dom, node, this.maps[key], items) === false) {
									out.properties.push('p-' + this.maps[key].root);
								} else {
									out.root.push(key);
								}
								break;
							}
						}
					}

					// test for mapped property classnames v1
					map = this.getMapping(ufName);
					if(map) {
						for(key in map.properties) {
							prop = map.properties[key];
							propName = (prop.map) ? prop.map : 'p-' + key;

							if(key === item) {
								if(prop.uf) {
									// loop all the classList make sure 
									//   1. this property is a root
									//   2. that there is not already a equivalent v2 property ie url and u-url on the same element
									y = 0;
									while(y < i) {
										v2Name = this.getV2RootName(items[y]);
										// add new root
										if(prop.uf.indexOf(v2Name) > -1 && out.root.indexOf(v2Name) === -1) {
											out.root.push(v2Name);
										}
										y++;
									}
									//only add property once
									if(out.properties.indexOf(propName) === -1) {
										out.properties.push(propName);
									}
								} else {
									if(out.properties.indexOf(propName) === -1) {
										out.properties.push(propName);
									}
								}
								break;
							}

						}
					}
				}
				x++;

			}
		}

		impiedRel = this.findRelImpied(dom, node, ufName);
		if(impiedRel && out.properties.indexOf(impiedRel) === -1) {
			out.properties.push(impiedRel);
		}

		return out;
	},



	// given a V1 or V2 root name return mapping object
	getMapping: function(name) {
		var key;
		for(key in this.maps) {
			if(this.maps[key].root === name || key === name) {
				return this.maps[key];
			}
		}
		return null;
	},


	// given a V1 root name returns a V2 root name ie vcard >>> h-card
	getV2RootName: function(name) {
		var key;
		for(key in this.maps) {
			if(this.maps[key].root === name) {
				return key;
			}
		}
		return null;
	},


	// use to find if a subTree mapping should be a property or root
	isSubTreeRoot: function(dom, node, map, classList) {
		var out,
			hasSecondRoot,
			i,
			x;

		out = this.createUfObject(map.name);
		hasSecondRoot = false;	

		// loop the classList to see if there is a second root
		x = 0;
		i = classList.length;	
		while(x < i) {
			var item = this.utils.trim(classList[x]);
			for(var key in this.maps) {
				if(this.maps.hasOwnProperty(key)) {
					if(this.maps[key].root === item && this.maps[key].root !== map.root) {
						hasSecondRoot = true;
						break;
					}
				}
			}
			x++;
		}

		// walk the sub tree for properties that match this subTree
		this.walkChildren(dom, node, out, map.name, null);

		if(this.utils.hasProperties(out.properties) && hasSecondRoot === false) {
			return true;
		} else {
			return false;
		}
	},


	// finds any alt rel=* mappings for a given node/microformat
	findRelImpied: function(dom, node, ufName) {
		var out,
			map,
			i;

		map = this.getMapping(ufName);
		if(map) {
			for(var key in map.properties) {
				var prop = map.properties[key],
					propName = (prop.map) ? prop.map : 'p-' + key,
					relCount = 0;

				// if property as an alt rel=* mapping run test
				if(prop.relAlt && this.domUtils.hasAttribute(dom, node, 'rel')) {
					i = prop.relAlt.length;
					while(i--) {
						if(this.domUtils.hasAttributeValue(dom, node, 'rel', prop.relAlt[i])) {
							relCount++;
						}
					}
					if(relCount === prop.relAlt.length) {
						out = propName;
					}
				}
			}
		}
		return out;
	},


	// creates a blank uf object
	createUfObject: function(names, value) {
		var out = {};

		if(value) {
			out.value = value;
		}
		if(this.utils.isArray(names)) {
			out.type = names;
		} else {
			out.type = [names];
		}
		out.properties = {};
		out.times = [];
		out.dates = [];
		return out;
	},




	// removes uf property prefixs from a string
	removePropPrefix: function(str) {
		var i;

		i = this.propertyPrefixes.length;
		while(i--) {
			var prefix = this.propertyPrefixes[i];
			if(this.utils.startWith(str, prefix)) {
				str = str.substr(prefix.length);
			}
		}
		return str;
	},




	findRels: function(dom, rootNode, fromChildren) {
		var uf,
			out = {},
			x,
			i,
			y,
			z,
			relList,
			items,
			item,
			key,
			value,
			arr;


		// get all elements that have a rel attribute
		fromChildren = (fromChildren) ? fromChildren : false; 
		if(fromChildren) {
			arr = this.domUtils.getNodesByAttribute(dom, rootNode, 'rel');
		} else {
			arr = this.domUtils.getNodesByAttribute(dom, rootNode, 'rel');
		}

		x = 0;
		i = arr.length;
		while(x < i) {
			relList = this.domUtils.getAttribute(dom, arr[x], 'rel');

			if(relList) {
				items = relList.split(' ');

				z = 0;
				y = items.length;
				while(z < y) {
					item = this.utils.trim(items[z]);
					for(key in this.rels) {
						if(key === item) {
							value = this.domUtils.getAttrValFromTagList(dom, arr[x], ['a', 'area'], 'href');
							if(!value) {
								value = this.domUtils.getAttrValFromTagList(dom, arr[x], ['link'], 'href');
							}
							if(!out[key]) {
								out[key] = [];
							}
							// turn relative to abosulte urls
							if(value && value !== '' && value.indexOf(':') === -1) {
								value = this.domUtils.resolveUrl(dom, value, this.options.baseUrl);
							}
							out[key].push(value);
						}
					}
					z++;
				}
			}
			x++;
		}

		if(this.utils.hasProperties(out)) {
			uf = this.createUfObject('rel');
			delete uf.times;
			delete uf.dates;
			uf.properties = out;
		}
		return uf;
	},


	// add all the includes ino the dom structure
	addIncludes: function(dom, rootNode) {
		this.addAttributeIncludes(dom, rootNode, 'itemref');
		this.addAttributeIncludes(dom, rootNode, 'headers');
		this.addClassIncludes(dom, rootNode);
	},


	// add attribute based includes ie 'itemref' and 'headers'
	addAttributeIncludes: function(dom, rootNode, attributeName) {
		var out = {},
			arr,
			idList,
			i,
			x,
			z,
			y;

		arr = this.domUtils.getNodesByAttribute(dom, rootNode, attributeName);
		x = 0;
		i = arr.length;
		while(x < i) {
			idList = this.domUtils.getAttributeList(dom, arr[x], attributeName);
			if(idList) {
				z = 0;
				y = idList.length;
				while(z < y) {
					this.apppendInclude(dom, arr[x], idList[z]);
					z++;
				}
			}
			x++;
		}
	},


	// add class based includes
	addClassIncludes: function(dom, rootNode) {
		var out = {},
			node,
			id,
			clone,
			arr,
			x = 0,
			i;

		arr = this.domUtils.getNodesByAttributeValue(dom, rootNode, 'class', 'include');
		i = arr.length;
		while(x < i) {
			id = this.domUtils.getAttrValFromTagList(dom, arr[x], ['a'], 'href');
			if(!id) {
				id = this.domUtils.getAttrValFromTagList(dom, arr[x], ['object'], 'data');
			}
			this.apppendInclude(dom, arr[x], id);
			x++;
		}
	},


	// appends a clone of an element into another node
	apppendInclude: function(dom, node, id){
		var include,
			clone;

		id = this.utils.trim(id.replace('#', ''));
		include = dom.getElementById(id);
		if(include) {
			clone = this.domUtils.clone(dom, include);
			this.markIncludeChildren(dom, clone);
			this.domUtils.appendChild(dom, node, clone);
		}
	},


	// add a attribute to all the child microformats roots  
	markIncludeChildren: function(dom, rootNode) {
		var arr,
			x,
			i;

		// loop the array and add the attribute
		arr = this.findRootNodes(dom, rootNode);
		x = 0;
		i = arr.length;
		this.domUtils.setAttribute(dom, rootNode, 'data-include', 'true');
		this.domUtils.setAttribute(dom, rootNode, 'style', 'display:none');
		while(x < i) {
			this.domUtils.setAttribute(dom, arr[x], 'data-include', 'true');
			x++;
		}
	},


	// looks at nodes in DOM structures find href and src and expandes relative URLs
	expandURLs: function(dom, node, baseUrl){
		var context = this;
		node = this.domUtils.clone(dom, node)
		expand( this.domUtils.getNodesByAttribute(dom, node, 'href'), 'href' );
		expand( this.domUtils.getNodesByAttribute(dom, node, 'src'), 'src' );

		function expand( nodeList, attrName ){
			if(nodeList && nodeList.length){
				var i = nodeList.length;
				while (i--) {
					// this gives the orginal text
				    href =  nodeList[i].getAttribute(attrName)
				    if(href.toLowerCase().indexOf('http') !== 0){
				    	nodeList[i].setAttribute(attrName, context.domUtils.resolveUrl(dom, href, context.options.baseUrl));
				    }
				}
			}
		}
		return node;
	},


	// merges passed and default options -single level clone of properties
	mergeOptions: function(options) {
		var key;
		for(key in options) {
			if(options.hasOwnProperty(key)) {
				this.options[key] = options[key];
			}
		}
	},

	// removes an changes made to dom during parse process
	clearUpDom: function(dom){
		var arr,
			i;

		// remove all the items that where added as includes
		arr = this.domUtils.getNodesByAttribute(dom, dom, 'data-include');
		i = arr.length;
		while(i--) {
			this.domUtils.removeChild(dom,arr[i]);
		}
		// remove additional attibutes
		arr = this.domUtils.getNodesByAttribute(dom, dom, 'rootids');
		i = arr.length;
		while(i--) {
			this.domUtils.removeAttribute(dom, arr[i],'rootids');
		}
	}

};


microformats.parser = new microformats.Parser();
microformats.getItems = function(options){
	var dom,
		node;

	dom = (options && options.document)? options.document : document;
	node = (options && options.node)? options.node : dom;

	options = (options)? options : {};
	if(!options.baseUrl && dom && dom.location){
		options.baseUrl = dom.location.href;
	}

	return this.parser.get(dom, node, options);
};

microformats.getCounts = function(options) {
	var dom,
		node;

	dom = (options && options.document)? options.document : document;
	node = (options && options.node)? options.node : dom;
	options = (options)? options : {};

	return this.parser.count(dom, node, options);
}


// Simple support for CommonJS
if (typeof exports !== 'undefined') {
	exports.microformats = microformats;
}
	









/*
   Utilities
   Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
   MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
   
   */

microformats.parser.utils = {

    // is the object a string
    isString: function( obj ) {
        return typeof( obj ) === 'string';
    },


    // does a string start with the test
    startWith: function( str, test ) {
        return(str.indexOf(test) === 0);
    },


    // remove spaces at front and back of string
    trim: function( str ) {
        if(this.isString(str)){
            return str.replace(/^\s+|\s+$/g, '');
        }else{
            return '';
        }
    },


    // is a string only contain white space chars
    isOnlyWhiteSpace: function( str ){
        return !(/[^\t\n\r ]/.test( str ));
    },


    // removes white space from a string
    removeWhiteSpace: function( str ){
        return str.replace(/[\t\n\r ]+/g, ' ');
    },


    // is the object a array
    isArray: function( obj ) {
        return obj && !( obj.propertyIsEnumerable( 'length' ) ) && typeof obj === 'object' && typeof obj.length === 'number';
    },


    // simple function to find out if a object has any properties. 
    hasProperties: function( obj ) {
        var key;
        for(key in obj) {
            if( obj.hasOwnProperty( key ) ) {
                return true;
            }
        }
        return false;
    }

};





/*
   DOM Utilities
   Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
   MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
   
   */


microformats.parser.domUtils = {

	innerHTML: function(dom, node){
		return node.innerHTML;
	},


	// returns whether attribute exists
	hasAttribute: function(dom, node, attributeName) {
		return (node.attributes[attributeName]) ? true : false;
	},
	

	// returns the string value of an attribute
	getAttribute: function(dom, node, attributeName) {
		return node.getAttribute(attributeName);
	},


	// removes an attribute
	removeAttribute: function(dom, node, attributeName) {
		node.removeAttribute(attributeName);
	},


	// returns the an array of string value of an attribute
	getAttributeList: function(dom, node, attributeName) {
		var out = [],
			attList;

		attList = node.getAttribute(attributeName);
		if(attList && attList !== '') {
			if(attList.indexOf(' ') > -1) {
				out = attList.split(' ');
			} else {
				out.push(attList);
			}
		}
		return out;
	},


	// returns whether an attribute has an item of the given value
	hasAttributeValue: function(dom, node, attributeName, value) {
		var attList = this.getAttributeList(dom, node, attributeName);
		return (attList.indexOf(value) > -1);
	},



	// returns whether an attribute has an item that start with the given value
	hasAttributeValueByPrefix: function(dom, node, attributeName, value) {
		var attList = [],
			x = 0,
			i;

		attList = this.getAttributeList(dom, node, attributeName);
		i = attList.length;
		while(x < i) {
			if(utils.startWith(utils.trim(attList[x]), value)) {
				return true;
			}
			x++;
		}
		return false;
	},


	// return an array of elements that match an attribute/value
	getNodesByAttribute: function(dom, node, name) {
		var selector = '[' + name + ']';
		return node.querySelectorAll(selector);
	},


	// return an arry of elements that match an attribute/value
	getNodesByAttributeValue: function(dom, rootNode, name, value) {
		var arr = [],
			x = 0,
			i,
			out = [];

		arr = this.getNodesByAttribute(dom, rootNode, name);
		if(arr) {
			i = arr.length;
			while(x < i) {
				if(this.hasAttributeValue(dom, arr[x], name, value)) {
					out.push(arr[x]);
				}
				x++;
			}
		}
		return out;
	},


	// set the attribute value
	setAttribute: function(dom, node, name, value){
		node.setAttribute(name, value);
	},


	// returns the attribute value only if the node tagName is in the tagNames list
	getAttrValFromTagList: function(dom, node, tagNames, attributeName) {
		var i = tagNames.length;

		while(i--) {
			if(node.tagName.toLowerCase() === tagNames[i]) {
				var attr = this.getAttribute(dom, node, attributeName);
				if(attr && attr !== '') {
					return attr;
				}
			}
		}
		return null;
	},


	// return a node if it is the only descendant AND of a type ie CSS :only-node
	isSingleDescendant: function(dom, rootNode, tagNames){
		var count = 0,
			out = null,
			child,
			x,
			i,
			y;

		x = 0;
		y = rootNode.children.length;
		while(x < y) {
			child = rootNode.children[x];
			if(child.tagName) {
				// can filter or not by tagNames array
				if(tagNames && this.hasTagName(child, tagNames)){
					out = child;
				}
				if(!tagNames){
					out = child;
				}
				// count all tag/element nodes
				count ++;
			}
			x++;
		}
		if(count === 1 && out) {
			return out;
		} else {
			return null;
		}
	},



	// return a node if it is the only descendant of a type ie CSS :only-of-type 
	isOnlySingleDescendantOfType: function(dom, rootNode, tagNames) {
		var i = rootNode.children.length,
			count = 0,
			child,
			out = null;

		while(i--) {
			child = rootNode.children[i];
			if(child.nodeType === 1) {
				if(this.hasTagName(child, tagNames)){
					out = child;
					count++;
				}
			}
		}
		if(count === 1 && out){
			return out;
		}else{
			return null;
		}
	},


	hasTagName: function(node, tagNames){
		var i = tagNames.length;
		while(i--) {
			if(node.tagName.toLowerCase() === tagNames[i]) {
				return true;
			}
		}
		return false;
	},


	// append a child node
	appendChild: function(dom, node, childNode){
		node.appendChild(childNode);
	},


	// removes child node
	removeChild: function(dom, node){
		if (node.parentNode) {
			node.parentNode.removeChild(node);
		}
	},


	// simple dom node cloning function 
	clone: function(dom, node) {
		var newNode = node.cloneNode(true);
		newNode.removeAttribute('id');
		return newNode;
	},


	// where possible resolves url to absolute version ie test.png to http://example.com/test.png
	resolveUrl: function(dom, url, baseUrl) {
		// its not empty or null and we have no protocal separator
		if(url && url !== '' && url.indexOf(':') === -1){
			var dp = new DOMParser();
			var doc = dp.parseFromString('<html><head><base href="' + baseUrl+ '"><head><body><a href="' + url+ '"></a></body></html>', 'text/html');
			return doc.getElementsByTagName('a')[0].href;
		}
		return url;
	},


	resolveUrliFrame: function(dom, url, baseUrl){
		iframe = dom.createElement('iframe')
		iframe.innerHTML('<html><head><base href="' + baseUrl+ '"><head><body><a href="' + baseUrl+ '"></a></body></html>');
		return iframe.document.getElementsByTagName('a')[0].href;
	}


};   



(function(DOMParser) {
    "use strict";

    var DOMParser_proto;
    var real_parseFromString;
    var textHTML;         // Flag for text/html support
    var textXML;          // Flag for text/xml support
    var htmlElInnerHTML;  // Flag for support for setting html element's innerHTML

    // Stop here if DOMParser not defined
    if (!DOMParser) return;

    // Firefox, Opera and IE throw errors on unsupported types
    try {
        // WebKit returns null on unsupported types
        textHTML = !!(new DOMParser).parseFromString('', 'text/html');

    } catch (er) {
      textHTML = false;
    }

    // If text/html supported, don't need to do anything.
    if (textHTML) return;

    // Next try setting innerHTML of a created document
    // IE 9 and lower will throw an error (can't set innerHTML of its HTML element)
    try {
      var doc = document.implementation.createHTMLDocument('');
      doc.documentElement.innerHTML = '<title></title><div></div>';
      htmlElInnerHTML = true;

    } catch (er) {
      htmlElInnerHTML = false;
    }

    // If if that failed, try text/xml
    if (!htmlElInnerHTML) {

        try {
            textXML = !!(new DOMParser).parseFromString('', 'text/xml');

        } catch (er) {
            textHTML = false;
        }
    }

    // Mess with DOMParser.prototype (less than optimal...) if one of the above worked
    // Assume can write to the prototype, if not, make this a stand alone function
    if (DOMParser.prototype && (htmlElInnerHTML || textXML)) { 
        DOMParser_proto = DOMParser.prototype;
        real_parseFromString = DOMParser_proto.parseFromString;

        DOMParser_proto.parseFromString = function (markup, type) {

            // Only do this if type is text/html
            if (/^\s*text\/html\s*(?:;|$)/i.test(type)) {
                var doc, doc_el, first_el;

                // Use innerHTML if supported
                if (htmlElInnerHTML) {
                    doc = document.implementation.createHTMLDocument("");
                    doc_el = doc.documentElement;
                    doc_el.innerHTML = markup;
                    first_el = doc_el.firstElementChild;

                // Otherwise use XML method
                } else if (textXML) {

                    // Make sure markup is wrapped in HTML tags
                    // Should probably allow for a DOCTYPE
                    if (!(/^<html.*html>$/i.test(markup))) {
                        markup = '<html>' + markup + '<\/html>'; 
                    }
                    doc = (new DOMParser).parseFromString(markup, 'text/xml');
                    doc_el = doc.documentElement;
                    first_el = doc_el.firstElementChild;
                }

                // Is this an entire document or a fragment?
                if (doc_el.childElementCount == 1 && first_el.localName.toLowerCase() == 'html') {
                    doc.replaceChild(first_el, doc_el);
                }

                return doc;

            // If not text/html, send as-is to host method
            } else {
                return real_parseFromString.apply(this, arguments);
            }
        };
    }
}(DOMParser));



/*!
    ISO Date Parser
    Parses and builds ISO dates to the uf, W3C , HTML5 or RFC3339 profiles
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt

    */

function ISODate() {
    this.dY = -1;
    this.dM = -1;
    this.dD = -1;
    this.dDDD = -1;
    this.tH = -1;
    this.tM = -1;
    this.tS = -1;
    this.tD = -1;
    this.tzH = -1;
    this.tzM = -1;
    this.tzPN = '+';
    this.z = false;
    this.format = 'uf'; // uf or W3C or RFC3339 or HTML5
    this.setFormatSep();

    // optional should be full iso date/time string 
    if(arguments[0]) {
        this.parse(arguments[0]);
    }
}

ISODate.prototype = {

    // parses a full iso date/time string i.e. 2008-05-01T15:45:19Z
    parse: function( dateString ) {
        var dateNormalised = '',
            parts = [],
            tzArray = [],
            position = 0,
            datePart = '',
            timePart = '',
            timeZonePart = '';

        dateString = dateString.toString().toUpperCase().replace(' ','T');

        // break on 'T' divider or space
        if(dateString.indexOf('T') > -1) {
            parts = dateString.split('T');
            datePart = parts[0];
            timePart = parts[1];

            // zulu UTC                 
            if(timePart.indexOf( 'Z' ) > -1) {
                this.z = true;
            }

            // timezone
            if(timePart.indexOf( '+' ) > -1 || timePart.indexOf( '-' ) > -1) {
                tzArray = timePart.split( 'Z' ); // incase of incorrect use of Z
                timePart = tzArray[0];
                timeZonePart = tzArray[1];

                // timezone
                if(timePart.indexOf( '+' ) > -1 || timePart.indexOf( '-' ) > -1) {
                    position = 0;

                    if(timePart.indexOf( '+' ) > -1) {
                        position = timePart.indexOf( '+' );
                    } else {
                        position = timePart.indexOf( '-' );
                    }

                    timeZonePart = timePart.substring( position, timePart.length );
                    timePart = timePart.substring( 0, position );
                }
            }

        } else {
            datePart = dateString;
        }

        if(datePart !== '') {
            this.parseDate( datePart );
            if(timePart !== '') {
                this.parseTime( timePart );
                if(timeZonePart !== '') {
                    this.parseTimeZone( timeZonePart );
                }
            }
        }
        return this.toString();
    },


    // parses just the date element of a iso date/time string i.e. 2008-05-01
    parseDate: function( dateString ) {
        var dateNormalised = '',
            parts = [];

        // YYYY-DDD
        parts = dateString.match( /(\d\d\d\d)-(\d\d\d)/ );
        if(parts) {
            if(parts[1]) {
                this.dY = parts[1];
            }
            if(parts[2]) {
                this.dDDD = parts[2];
            }
        }

        if(this.dDDD === -1) {
            // YYYY-MM-DD ie 2008-05-01 and YYYYMMDD ie 20080501
            parts = dateString.match( /(\d\d\d\d)?-?(\d\d)?-?(\d\d)?/ );
            if(parts[1]) {
                this.dY = parts[1];
            }
            if(parts[2]) {
                this.dM = parts[2];
            }
            if(parts[3]) {
                this.dD = parts[3];
            }
        }
        return this.toString();
    },


    // parses just the time element of a iso date/time string i.e. 13:30:45
    parseTime: function( timeString ) {
        var timeNormalised = '',
            parts = [];

        // finds timezone HH:MM:SS and HHMMSS  ie 13:30:45, 133045 and 13:30:45.0135
        parts = timeString.match( /(\d\d)?:?(\d\d)?:?(\d\d)?.?([0-9]+)?/ );
        if(parts[1]) {
            this.tH = parts[1];
        }
        if(parts[2]) {
            this.tM = parts[2];
        }
        if(parts[3]) {
            this.tS = parts[3];
        }
        if(parts[4]) {
            this.tD = parts[4];
        }
        return this.toString();
    },


    // parses just the time element of a iso date/time string i.e. +08:00
    parseTimeZone: function( timeString ) {
        var timeNormalised = '',
            parts = [];

        // finds timezone +HH:MM and +HHMM  ie +13:30 and +1330
        parts = timeString.match( /([\-\+]{1})?(\d\d)?:?(\d\d)?/ );
        if(parts[1]) {
            this.tzPN = parts[1];
        }
        if(parts[2]) {
            this.tzH = parts[2];
        }
        if(parts[3]) {
            this.tzM = parts[3];
        }
        return this.toString();
    },


    // returns iso date/time string in in W3C Note, RFC 3339, HTML5 or Microformat profile
    toString: function( format ) {
        var output = '';

        if(format){
            this.format = format;
        }
        this.setFormatSep();

        if(this.dY  > -1) {
            output = this.dY;
            if(this.dM > 0 && this.dM < 13) {
                output += this.dsep + this.dM;
                if(this.dD > 0 && this.dD < 32) {
                    output += this.dsep + this.dD;
                    if(this.tH > -1 && this.tH < 25) {
                        output += this.sep + this.toTimeString( this );
                    }
                }
            }
            if(this.dDDD > -1) {
                output += this.dsep + this.dDDD;
            }
        } else if(this.tH > -1) {
            output += this.toTimeString( this );
        }

        return output;
    },


    // returns just the time string element of a iso date/time
    toTimeString: function( iso ) {
        var out = '';

        this.setFormatSep();
        // time and can only be created with a full date
        if(iso.tH) {
            if(iso.tH > -1 && iso.tH < 25) {
                out += iso.tH;
                out += (iso.tM > -1 && iso.tM < 61) ? this.tsep + iso.tM : this.tsep + '00';
                out += (iso.tS > -1 && iso.tS < 61) ? this.tsep + iso.tS : this.tsep + '00';
                out += (iso.tD > -1) ? '.' + iso.tD : '';
                // time zone offset 
                if(iso.z) {
                    out += 'Z';
                } else {
                    if(iso.tzH && iso.tzH > -1 && iso.tzH < 25) {
                        out += iso.tzPN + iso.tzH;
                        out += (iso.tzM > -1 && iso.tzM < 61) ? this.tzsep + iso.tzM : this.tzsep + '00';
                    }
                }
            }
        }
        return out;
    },


    // congifures the separators for a given profile
    setFormatSep: function() {
        switch( this.format ) {
            case 'RFC3339':
                this.sep = 'T';
                this.dsep = '';
                this.tsep = '';
                this.tzsep = '';
                break;
            case 'W3C':
                this.sep = 'T';
                this.dsep = '-';
                this.tsep = ':';
                this.tzsep = ':';
                break;
            case 'HTML5':
                this.sep = ' ';
                this.dsep = '-';
                this.tsep = ':';
                this.tzsep = ':';
                break;
            default:
                // uf
                this.sep = 'T';
                this.dsep = '-';
                this.tsep = ':';
                this.tzsep = '';
        }
    },

    hasFullDate: function() {
        return(this.dY !== -1 && this.dM !== -1 && this.dD !== -1);
    },


    hasDate: function() {
        return(this.dY !== -1);
    },


    hasTime: function() {
        return(this.tH !== -1);
    },


    hasTimeZone: function() {
        return(this.tzH !== -1);
    }

};



/*!
    Date Utilities
    Helper functions for microformat date parsing, and fragment concat
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt

    */

microformats.parser.dates = {

    utils:  microformats.parser.utils,

    removeAMPM: function(str) {
        return str.replace('pm', '').replace('p.m.', '').replace('am', '').replace('a.m.', '');
    },


    hasAM: function(time) {
        time = time.toLowerCase();
        return(time.indexOf('am') > -1 || time.indexOf('a.m.') > -1);
    },


    hasPM: function(time) {
        time = time.toLowerCase();
        return(time.indexOf('pm') > -1 || time.indexOf('p.m.') > -1);
    },


    // is str a ISO duration  i.e.  PY17M or PW12
    isDuration: function(str) {
        if(this.utils.isString(str)){
            str = str.toLowerCase();
            str = this.utils.trim( str );
            if(this.utils.startWith(str, 'p') && !str.match(/t|\s/) && !str.match('-') && !str.match(':')) {
                return true;
            }
        }
        return false;
    },


    // is str a time or timezone
    // ie HH-MM-SS or z+-HH-MM-SS 08:43 | 15:23:00:0567 | 10:34pm | 10:34 p.m. | +01:00:00 | -02:00 | z15:00 
    isTime: function(str) {
        if(this.utils.isString(str)){
            str = str.toLowerCase();
            str = this.utils.trim( str );
            // start with timezone char
            if( str.match(':') 
                && ( this.utils.startWith(str, 'z') 
                    || this.utils.startWith(str, '-') 
                    || this.utils.startWith(str, '+') )) {
                return true;
            }
            // has ante meridiem or post meridiem
            if( str.match(/^[0-9]/) && 
                ( this.hasAM(str) || this.hasPM(str) )) {
                return true;
            }
            // contains time delimiter but not datetime delimiter
            if( str.match(':') && !str.match(/t|\s/) ) {
                return true;
            }
        }
        return false;
    },


    // parses a time string and turns it into a 24hr time string
    // 5:34am = 05:34:00 and 1:52:04p.m. = 13:52:04
    parseAmPmTime: function(time) {
        var out = time,
            times = [];

        // if the string has a time : or am or pm
        if(this.utils.isString(out)) {
            time = time.toLowerCase();
            time = time.replace(/[ ]+/g, '');

            if(time.match(':') || this.hasAM(time) || this.hasPM(time)) {

                if(time.match(':')) {
                    times = time.split(':');
                } else {
                    times[0] = time;
                    times[0] = this.removeAMPM(times[0]);
                }

                if(this.hasAM(time)) {
                    if(times[0] === '12') {
                        times[0] = '00';
                    }
                }
                if(this.hasPM(time)) {
                    if(times[0] < 12) {
                        times[0] = parseInt(times[0], 10) + 12;
                    }
                }

                // add leading zero's where needed
                if(times[0] && times[0].length === 1) {
                    times[0] = '0' + times[0];
                }
                if(times[0]) {
                    time = times.join(':');
                }
            }
        }
        return this.removeAMPM(time);
    },


    // overlays a different time on a given data to return the union of the two
    dateTimeUnion: function(date, time) {
        var isodate = new ISODate(date),
            isotime = new ISODate();

        isotime.parseTime(this.parseAmPmTime(time));
        if(isodate.hasFullDate() && isotime.hasTime()) {
            isodate.tH = isotime.tH;
            isodate.tM = isotime.tM;
            isodate.tS = isotime.tS;
            isodate.tD = isotime.tD;
            return isodate;
        } else {
            new ISODate();
        }
    },


    // passed an array of date/time string fragments it creates an iso 
    // datetime string using microformat rules for value and value-title
    concatFragments: function (arr) {
        var out = null,
            i = 0,
            date = '',
            time = '',
            offset = '',
            value = '';

        for(i = 0; i < arr.length; i++) {
            value = arr[i].toUpperCase();
            // if the fragment already contains a full date just return it once its converted W3C profile
            if(value.match('T')) {
                return new ISODate(value);
            }
            // if it looks like a date
            if(value.charAt(4) === '-') {
                date = value;
                // if it looks like a timezone    
            } else if((value.charAt(0) === '-') || (value.charAt(0) === '+') || (value === 'Z')) {
                if(value.length === 2) {
                    offset = value[0] + '0' + value[1];
                } else {
                    offset = value;
                }
            } else {
                // else if could be a time 
                time = this.parseAmPmTime(value);
            }
        }

        if(date !== '') {
            return new ISODate(date + (time ? 'T' : '') + time + offset);
        } else {
            out = new ISODate(value);
            if(time !== '') {
                out.parseTime(time);
            }
            if(offset !== '') {
                out.parseTime(offset);
            }
            return out;
        }
    }

};


/*
    InnerText Parser 
    extracts plain text from DOM nodes
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt

    The text parser works like textContent but with five additional parsing rules 
    * It excluded the content from tag in the "excludeTags" list ie noframes script etc
    * It adds a single space behind the text string of any node considered block level
    * It removes all line return/feeds and tabs
    * It turns all whitespace into single spaces
    * It trims the final output

    */



function Text(){
    this.textFormat = 'normalised'; // normalised or whitespace
    this.blockLevelTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'hr', 'pre', 'table',
        'address', 'article', 'aside', 'blockquote', 'caption', 'col', 'colgroup', 'dd', 'div', 
        'dt', 'dir', 'fieldset', 'figcaption', 'figure', 'footer', 'form',  'header', 'hgroup', 'hr', 
        'li', 'map', 'menu', 'nav', 'optgroup', 'option', 'section', 'tbody', 'testarea', 
        'tfoot', 'th', 'thead', 'tr', 'td', 'ul', 'ol', 'dl', 'details'];

    this.excludeTags = ['noframe', 'noscript', 'script', 'style', 'frames', 'frameset'];
} 


Text.prototype = {

    // gets the text from dom node 
    parse: function(dom, node, textFormat){
        var out;

        this.textFormat = (textFormat)? textFormat : this.textFormat;
        if(this.textFormat === 'normalised'){
            out = this.walkTreeForText( node );
            if(out !== undefined){
                out = out.replace( /&nbsp;/g, ' ') ;    // exchanges html entity for space into space char
                out = this.removeWhiteSpace( out );     // removes linefeeds, tabs and addtional spaces
                out = this.decodeEntities( dom, out );  // decode HTML entities
                out = out.replace( '–', '-' );          // correct dash decoding
                return this.trim( out );
            }else{
                return undefined;
            }
        }else{
           return dom(node).text(); 
        }
    },



    // extracts the text nodes in the tree
    walkTreeForText: function( node ) {
        var out = '',
            j = 0;

        if(this.excludeTags.indexOf( node.name ) > -1){
            return out;
        }

        // if node is a text node get its text
        if(node.nodeType && node.nodeType === 3){
            out += this.getElementText( node ); 
        }

        // get the text of the child nodes
        if(node.childNodes && node.childNodes.length > 0){
            for (j = 0; j < node.childNodes.length; j++) {
                var text = this.walkTreeForText( node.childNodes[j] );
                if(text !== undefined){
                    out += text;
                }
            }
        }

        // if its a block level tag add an additional space at the end
        if(this.blockLevelTags.indexOf( node.name ) !== -1){
            out += ' ';
        } 
        
        return (out === '')? undefined : out ;
    },    


    // get the text from a node in the dom
    getElementText: function( node ){
        if(node.nodeValue){
            return node.nodeValue;
        }else{
            return '';
        }
    },

    // remove spaces at front and back of string
    trim: function( str ) {
        return str.replace(/^\s+|\s+$/g, '');
    },


    // removes white space from a string
    removeWhiteSpace: function( str ){
        return str.replace(/[\t\n\r ]+/g, ' ');
    },

    decodeEntities: function( dom, str ){
        return dom.createTextNode( str ).nodeValue;
    }

};


microformats.parser.text = {};

microformats.parser.text.parse = function(dom, node, textFormat){
    var text = new Text();
    return text.parse(dom, node, textFormat);
} 



/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-adr'] = {
	root: 'adr',
	name: 'h-adr',
	properties: {
		'post-office-box': {},
		'street-address': {},
		'extended-address': {},
		'locality': {},
		'region': {},
		'postal-code': {},
		'country-name': {}
	}
};



/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-card'] =  {
	root: 'vcard',
	name: 'h-card',
	properties: {
		'fn': {
			'map': 'p-name'
		},
		'adr': {
			'uf': ['h-adr']
		},
		'agent': {
			'uf': ['h-card']
		},
		'bday': {
			'map': 'dt-bday'
		},
		'class': {},
		'category': {
			'map': 'p-category',
			'relAlt': ['tag']
		},
		'email': {
			'map': 'u-email'
		},
		'geo': {
			'map': 'p-geo', 
			'uf': ['h-geo']
		},
		'key': {},
		'label': {},
		'logo': {
			'map': 'u-logo'
		},
		'mailer': {},
		'honorific-prefix': {},
		'given-name': {},
		'additional-name': {},
		'family-name': {},
		'honorific-suffix': {},
		'nickname': {},
		'note': {}, // could be html i.e. e-note
		'org': {},
		'p-organization-name': {},
		'p-organization-unit': {},
		'photo': {
			'map': 'u-photo'
		},
		'rev': {
			'map': 'dt-rev'
		},
		'role': {},
		'sequence': {},
		'sort-string': {},
		'sound': {
			'map': 'u-sound'
		},
		'title': {},
		'tel': {},
		'tz': {},
		'uid': {
			'map': 'u-uid'
		},
		'url': {
			'map': 'u-url'
		}
	}
};


/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-entry'] = {
	root: 'hentry',
	name: 'h-entry',
	properties: {
		'entry-title': {
			'map': 'p-name'
		},
		'entry-summary': {
			'map': 'p-summary'
		},
		'entry-content': {
			'map': 'e-content'
		},
		'published': {
			'map': 'dt-published'
		},
		'updated': {
			'map': 'dt-updated'
		},
		'author': { 
			'uf': ['h-card']
		},
		'category': {
			'map': 'p-category',
			'relAlt': ['tag']
		},
		'geo': {
			'map': 'p-geo', 
			'uf': ['h-geo']
		},
		'latitude': {},
		'longitude': {},
		'url': {
            'map': 'u-url',
            'relAlt': ['bookmark']
        }
	}
};


/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-event'] = {  
	root: 'vevent',
	name: 'h-event',
	properties: {
		'summary': {
			'map': 'p-name'
		},
		'dtstart': {
			'map': 'dt-start'
		},
		'dtend': {
			'map': 'dt-end'
		},
		'description': {},
		'url': {
			'map': 'u-url'
		},
		'category': {
			'map': 'p-category',
			'relAlt': ['tag']
		},
		'location': {
			'uf': ['h-card']
		},
		'geo': {
			'uf': ['h-geo']
		},
		'latitude': {},
		'longitude': {},
		'duration': {
			'map': 'dt-duration'
		},
		'contact': {
			'uf': ['h-card']
		},
		'organizer': {
			'uf': ['h-card']},
		'attendee': {
			'uf': ['h-card']},
		'uid': {
			'map': 'u-uid'
		},
		'attach': {
			'map': 'u-attach'
		},
		'status': {},
		'rdate': {}, 
		'rrule': {}
	}
};


/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-geo'] = {
	root: 'geo',
	name: 'h-geo',
	properties: {
		'latitude': {},
		'longitude': {}
	}
};


/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-item'] = {
	root: 'item',
	name: 'h-item',
	subTree: true,
	properties: {
		'fn': {
			'map': 'p-name'
		},
		'url': {
			'map': 'u-url'
		},
		'photo': {
			'map': 'u-photo'
		}
	}
};


/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-listing'] = {
  root: 'hlisting',
  name: 'h-listing',
  properties: {
    'version': {},
    'lister': {
      'uf': ['h-card']
    },
    'dtlisted': {
      'map': 'dt-listed'
    },
    'dtexpired': {
      'map': 'dt-expired'
    },
    'location': {},
    'price': {},
    'item': {
      'uf': ['h-card','a-adr','h-geo']
    },
    'summary': {
      'map': 'p-name'
    },
    'description': {
      'map': 'e-description'
    },
    'listing': {}
  }
};

/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-news'] = {
  root: 'hnews',
  name: 'h-news',
  properties: {
    'entry': {
      'uf': ['h-entry']
    },
    'geo': {
      'uf': ['h-geo']
    },
    'latitude': {},
    'longitude': {},
    'source-org': {
      'uf': ['h-card']
    },
    'dateline': {
      'uf': ['h-card']
    },
    'item-license': {
      'map': 'u-item-license'
    },
    'principles': {
      'map': 'u-principles', 
      'relAlt': ['principles']
    }
  }
};



/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-org'] = {
    root: 'h-x-org',  // drop this from v1 as it causes issue with fn org hcard pattern
    name: 'h-org',
    properties: {
        'organization-name': {},
        'organization-unit': {}
    }
};



/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-product'] = {
  root: 'hproduct',
  name: 'h-product',
  properties: {
    'brand': {
      'uf': ['h-card']
    },
    'category': {
      'map': 'p-category',
      'relAlt': ['tag']
    },
    'price': {},
    'description': {
      'map': 'e-description'
    },
    'fn': {
      'map': 'p-name'
    },
    'photo': {
      'map': 'u-photo'
    },
    'url': {
      'map': 'u-url'
    },
    'review': {
      'uf': ['h-review', 'h-review-aggregate']
    },
    'listing': {
      'uf': ['h-listing']
    },
    'identifier': {
      'map': 'u-identifier'
    }
  }
};


/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-recipe'] = {
  root: 'hrecipe',
  name: 'h-recipe',
  properties: {
    'fn': {
      'map': 'p-name'
    },
    'ingredient': {
      'map': 'e-ingredient'
    },
    'yield': {},
    'instructions': {
      'map': 'e-instructions'
    },
    'duration': {
      'map': 'dt-duration'
    },
    'photo': {
      'map': 'u-photo'
    },
    'summary': {},
    'author': {
      'uf': ['h-card']
    },
    'published': {
      'map': 'dt-published'
    },
    'nutrition': {},
    'tag': {}
  }
};



/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-resume'] = {
	root: 'hresume',
	name: 'h-resume',
	properties: {
		'summary': {},
		'contact': {
			'uf': ['h-card']
		},
		'education': {
			'uf': ['h-card', 'h-event']
		},
		'experience': {
			'uf': ['h-card', 'h-event']
		},
		'skill': {},
		'affiliation': {
			'uf': ['h-card']
		}
	}
};


/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-review-aggregate'] = {
    root: 'hreview-aggregate',
    name: 'h-review-aggregate',
    properties: {
        'summary': {
            'map': 'p-name'
        },
        'item': {
            'map': 'p-item',
            'uf': ['h-item', 'h-geo', 'h-adr', 'h-card', 'h-event', 'h-product']
        },
        'rating': {},
        'average': {},
        'best': {},
        'worst': {},       
        'count': {},
        'votes': {},
        'category': {
            'map': 'p-category',
            'relAlt': ['tag']
        },
        'url': {
            'map': 'u-url',
            'relAlt': ['self', 'bookmark']
        }
    }
};



/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.maps['h-review'] = {
    root: 'hreview',
    name: 'h-review',
    properties: {
        'summary': {
            'map': 'p-name'
        },
        'description': {
            'map': 'e-description'
        },
        'item': {
            'map': 'p-item',
            'uf': ['h-item', 'h-geo', 'h-adr', 'h-card', 'h-event', 'h-product']
        },
        'reviewer': {
            'uf': ['h-card']
        },
        'dtreviewer': {
            'map': 'dt-reviewer'
        },
        'rating': {},
        'best': {},
        'worst': {},
        'category': {
            'map': 'p-category',
            'relAlt': ['tag']
        },
        'url': {
            'map': 'u-url',
            'relAlt': ['self', 'bookmark']
        }
    }
};


/*
    Copyright (C) 2010 - 2013 Glenn Jones. All Rights Reserved.
    MIT License: https://raw.github.com/glennjones/microformat-shiv/master/license.txt
    
  */
microformats.parser.rels = {
	// xfn
	//        ['link', 'a or area'] yes, no or external
	'friend': [ 'yes','external'], 
	'acquaintance': [ 'yes','external'],  
	'contact': [ 'yes','external'], 
	'met': [ 'yes','external'], 
	'co-worker': [ 'yes','external'],  
	'colleague': [ 'yes','external'], 
	'co-resident': [ 'yes','external'],  
	'neighbor': [ 'yes','external'], 
	'child': [ 'yes','external'],  
	'parent': [ 'yes','external'],  
	'sibling': [ 'yes','external'],  
	'spouse': [ 'yes','external'],  
	'kin': [ 'yes','external'], 
	'muse': [ 'yes','external'],  
	'crush': [ 'yes','external'],  
	'date': [ 'yes','external'],  
	'sweetheart': [ 'yes','external'], 
	'me': [ 'yes','external'], 

	// other rel= 
	'license': [ 'yes','yes'],
	'nofollow': [ 'no','external'],
	'tag': [ 'no','yes'],
	'self': [ 'no','external'],
	'bookmark': [ 'no','external'],
	'author': [ 'no','external'],
	'home': [ 'no','external'],
	'directory': [ 'no','external'],
	'enclosure': [ 'no','external'],
	'pronunciation': [ 'no','external'],
	'payment': [ 'no','external'],
	'principles': [ 'no','external']

};






},{}],"/home/lmorchard/devel/tootr/node_modules/pubsub-js/src/pubsub.js":[function(require,module,exports){
/*
Copyright (c) 2010,2011,2012,2013,2014 Morgan Roderick http://roderick.dk
License: MIT - http://mrgnrdrck.mit-license.org

https://github.com/mroderick/PubSubJS
*/
/*jslint white:true, plusplus:true, stupid:true*/
/*global
	setTimeout,
	module,
	exports,
	define,
	require,
	window
*/
(function (root, factory){
	'use strict';

    if (typeof define === 'function' && define.amd){
        // AMD. Register as an anonymous module.
        define(['exports'], factory);

    } else if (typeof exports === 'object'){
        // CommonJS
        factory(exports);

    } else {
        // Browser globals
        factory((root.PubSub = {}));

    }
}(( typeof window === 'object' && window ) || this, function (PubSub){
	'use strict';

	var messages = {},
		lastUid = -1;

	function hasKeys(obj){
		var key;

		for (key in obj){
			if ( obj.hasOwnProperty(key) ){
				return true;
			}
		}
		return false;
	}

	/**
	 *	Returns a function that throws the passed exception, for use as argument for setTimeout
	 *	@param { Object } ex An Error object
	 */
	function throwException( ex ){
		return function reThrowException(){
			throw ex;
		};
	}

	function callSubscriberWithDelayedExceptions( subscriber, message, data ){
		try {
			subscriber( message, data );
		} catch( ex ){
			setTimeout( throwException( ex ), 0);
		}
	}

	function callSubscriberWithImmediateExceptions( subscriber, message, data ){
		subscriber( message, data );
	}

	function deliverMessage( originalMessage, matchedMessage, data, immediateExceptions ){
		var subscribers = messages[matchedMessage],
			callSubscriber = immediateExceptions ? callSubscriberWithImmediateExceptions : callSubscriberWithDelayedExceptions,
			s;

		if ( !messages.hasOwnProperty( matchedMessage ) ) {
			return;
		}

		for (s in subscribers){
			if ( subscribers.hasOwnProperty(s)){
				callSubscriber( subscribers[s], originalMessage, data );
			}
		}
	}

	function createDeliveryFunction( message, data, immediateExceptions ){
		return function deliverNamespaced(){
			var topic = String( message ),
				position = topic.lastIndexOf( '.' );

			// deliver the message as it is now
			deliverMessage(message, message, data, immediateExceptions);

			// trim the hierarchy and deliver message to each level
			while( position !== -1 ){
				topic = topic.substr( 0, position );
				position = topic.lastIndexOf('.');
				deliverMessage( message, topic, data );
			}
		};
	}

	function messageHasSubscribers( message ){
		var topic = String( message ),
			found = Boolean(messages.hasOwnProperty( topic ) && hasKeys(messages[topic])),
			position = topic.lastIndexOf( '.' );

		while ( !found && position !== -1 ){
			topic = topic.substr( 0, position );
			position = topic.lastIndexOf( '.' );
			found = Boolean(messages.hasOwnProperty( topic ) && hasKeys(messages[topic]));
		}

		return found;
	}

	function publish( message, data, sync, immediateExceptions ){
		var deliver = createDeliveryFunction( message, data, immediateExceptions ),
			hasSubscribers = messageHasSubscribers( message );

		if ( !hasSubscribers ){
			return false;
		}

		if ( sync === true ){
			deliver();
		} else {
			setTimeout( deliver, 0 );
		}
		return true;
	}

	/**
	 *	PubSub.publish( message[, data] ) -> Boolean
	 *	- message (String): The message to publish
	 *	- data: The data to pass to subscribers
	 *	Publishes the the message, passing the data to it's subscribers
	**/
	PubSub.publish = function( message, data ){
		return publish( message, data, false, PubSub.immediateExceptions );
	};

	/**
	 *	PubSub.publishSync( message[, data] ) -> Boolean
	 *	- message (String): The message to publish
	 *	- data: The data to pass to subscribers
	 *	Publishes the the message synchronously, passing the data to it's subscribers
	**/
	PubSub.publishSync = function( message, data ){
		return publish( message, data, true, PubSub.immediateExceptions );
	};

	/**
	 *	PubSub.subscribe( message, func ) -> String
	 *	- message (String): The message to subscribe to
	 *	- func (Function): The function to call when a new message is published
	 *	Subscribes the passed function to the passed message. Every returned token is unique and should be stored if
	 *	you need to unsubscribe
	**/
	PubSub.subscribe = function( message, func ){
		if ( typeof func !== 'function'){
			return false;
		}

		// message is not registered yet
		if ( !messages.hasOwnProperty( message ) ){
			messages[message] = {};
		}

		// forcing token as String, to allow for future expansions without breaking usage
		// and allow for easy use as key names for the 'messages' object
		var token = 'uid_' + String(++lastUid);
		messages[message][token] = func;

		// return token for unsubscribing
		return token;
	};

	/* Public: Clears all subscriptions
	 */
	PubSub.clearAllSubscriptions = function clearSubscriptions(){
		messages = {};
	};

	/* Public: removes subscriptions.
	 * When passed a token, removes a specific subscription.
	 * When passed a function, removes all subscriptions for that function
	 * When passed a topic, removes all subscriptions for that topic (hierarchy)
	 *
	 * value - A token, function or topic to unsubscribe.
	 *
	 * Examples
	 *
	 *		// Example 1 - unsubscribing with a token
	 *		var token = PubSub.subscribe('mytopic', myFunc);
	 *		PubSub.unsubscribe(token);
	 *
	 *		// Example 2 - unsubscribing with a function
	 *		PubSub.unsubscribe(myFunc);
	 *
	 *		// Example 3 - unsubscribing a topic
	 *		PubSub.unsubscribe('mytopic');
	 */
	PubSub.unsubscribe = function(value){
		var isTopic    = typeof value === 'string' && messages.hasOwnProperty(value),
			isToken    = !isTopic && typeof value === 'string',
			isFunction = typeof value === 'function',
			result = false,
			m, message, t, token;

		if (isTopic){
			delete messages[value];
			return;
		}

		for ( m in messages ){
			if ( messages.hasOwnProperty( m ) ){
				message = messages[m];

				if ( isToken && message[value] ){
					delete message[value];
					result = value;
					// tokens are unique, so we can just stop here
					break;
				} else if (isFunction) {
					for ( t in message ){
						if (message.hasOwnProperty(t) && message[t] === value){
							delete message[t];
							result = true;
						}
					}
				}
			}
		}

		return result;
	};
}));

},{}],"/home/lmorchard/devel/tootr/node_modules/underscore/underscore.js":[function(require,module,exports){
//     Underscore.js 1.7.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.7.0';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var createCallback = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  _.iteratee = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return createCallback(value, context, argCount);
    if (_.isObject(value)) return _.matches(value);
    return _.property(value);
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    if (obj == null) return obj;
    iteratee = createCallback(iteratee, context);
    var i, length = obj.length;
    if (length === +length) {
      for (i = 0; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    if (obj == null) return [];
    iteratee = _.iteratee(iteratee, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length),
        currentKey;
    for (var index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index = 0, currentKey;
    if (arguments.length < 3) {
      if (!length) throw new TypeError(reduceError);
      memo = obj[keys ? keys[index++] : index++];
    }
    for (; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== + obj.length && _.keys(obj),
        index = (keys || obj).length,
        currentKey;
    if (arguments.length < 3) {
      if (!index) throw new TypeError(reduceError);
      memo = obj[keys ? keys[--index] : --index];
    }
    while (index--) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    predicate = _.iteratee(predicate, context);
    _.some(obj, function(value, index, list) {
      if (predicate(value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    predicate = _.iteratee(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(_.iteratee(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    if (obj == null) return true;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    if (obj == null) return false;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (obj.length !== +obj.length) obj = _.values(obj);
    return _.indexOf(obj, target) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = obj && obj.length === +obj.length ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = low + high >>> 1;
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return obj.length === +obj.length ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = _.iteratee(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    for (var i = 0, length = input.length; i < length; i++) {
      var value = input[i];
      if (!_.isArray(value) && !_.isArguments(value)) {
        if (!strict) output.push(value);
      } else if (shallow) {
        push.apply(output, value);
      } else {
        flatten(value, shallow, strict, output);
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (array == null) return [];
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = _.iteratee(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = array.length; i < length; i++) {
      var value = array[i];
      if (isSorted) {
        if (!i || seen !== value) result.push(value);
        seen = value;
      } else if (iteratee) {
        var computed = iteratee(value, i, array);
        if (_.indexOf(seen, computed) < 0) {
          seen.push(computed);
          result.push(value);
        }
      } else if (_.indexOf(result, value) < 0) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true, []));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    if (array == null) return [];
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = array.length; i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(slice.call(arguments, 1), true, true, []);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function(array) {
    if (array == null) return [];
    var length = _.max(arguments, 'length').length;
    var results = Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = isSorted < 0 ? Math.max(0, length + isSorted) : isSorted;
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var idx = array.length;
    if (typeof from == 'number') {
      idx = from < 0 ? idx + from + 1 : Math.min(idx, from + 1);
    }
    while (--idx >= 0) if (array[idx] === item) return idx;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var Ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    args = slice.call(arguments, 2);
    bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      Ctor.prototype = func.prototype;
      var self = new Ctor;
      Ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (_.isObject(result)) return result;
      return self;
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = hasher ? hasher.apply(this, arguments) : key;
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last > 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed before being called N times.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      } else {
        func = null;
      }
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    if (!_.isObject(obj)) return obj;
    var source, prop;
    for (var i = 1, length = arguments.length; i < length; i++) {
      source = arguments[i];
      for (prop in source) {
        if (hasOwnProperty.call(source, prop)) {
            obj[prop] = source[prop];
        }
      }
    }
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj, iteratee, context) {
    var result = {}, key;
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      iteratee = createCallback(iteratee, context);
      for (key in obj) {
        var value = obj[key];
        if (iteratee(value, key, obj)) result[key] = value;
      }
    } else {
      var keys = concat.apply([], slice.call(arguments, 1));
      obj = new Object(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];
        if (key in obj) result[key] = obj[key];
      }
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(concat.apply([], slice.call(arguments, 1)), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    if (!_.isObject(obj)) return obj;
    for (var i = 1, length = arguments.length; i < length; i++) {
      var source = arguments[i];
      for (var prop in source) {
        if (obj[prop] === void 0) obj[prop] = source[prop];
      }
    }
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (
      aCtor !== bCtor &&
      // Handle Object.create(x) cases
      'constructor' in a && 'constructor' in b &&
      !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
        _.isFunction(bCtor) && bCtor instanceof bCtor)
    ) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size, result;
    // Recursively compare objects and arrays.
    if (className === '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size === b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      size = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      result = _.keys(b).length === size;
      if (result) {
        while (size--) {
          // Deep compare each member
          key = keys[size];
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj) || _.isArguments(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around an IE 11 bug.
  if (typeof /./ !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    var pairs = _.pairs(attrs), length = pairs.length;
    return function(obj) {
      if (obj == null) return !length;
      obj = new Object(obj);
      for (var i = 0; i < length; i++) {
        var pair = pairs[i], key = pair[0];
        if (pair[1] !== obj[key] || !(key in obj)) return false;
      }
      return true;
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = createCallback(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? object[property]() : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],"/home/lmorchard/devel/tootr/src/javascript/misc.js":[function(require,module,exports){
(function (global){
var _ = require('underscore');
var $ = (typeof window !== "undefined" ? window.$ : typeof global !== "undefined" ? global.$ : null);

module.exports.getQueryParameters = function (str) {
  return (str || document.location.search)
    .replace(/(^\?)/,'').split("&")
    .map(function (n) {
      return n = n.split("="),
        this[n[0]] = decodeURIComponent(n[1]),
        this
    }.bind({}))[0];
};

module.exports.flatten = function (item) {
  return _.chain(item).map(function (value, key) {
    return [key, value[0]];
  }).object().value();
};

// Turn a simple structure of nested XML elements into a JavaScript object.
//
// TODO: Handle attributes?
module.exports.xmlToObj = function (parent, force_lists, path) {
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
};

/**
 * jQuery cloneTemplate plugin, v0.0
 * lorchard@mozilla.com
 *
 * Clone template elements and populate them from a data object.
 *
 * The data object keys of which are assumed to be CSS selectors.  Each
 * selector may end with an @-prefixed name to identify an attribute.
 *
 * An element or attribute matched by the selector will have its
 * content replaced by the value of the data object for the selector.
 */
jQuery.fn.extend( {

  fillOut: function (data) {
    return this.each(function () {
      var tmpl = $(this);
      for (key in data) {
        if (!data.hasOwnProperty(key)) { continue; }

        // Skip populating values that are false or undefined
        var value = data[key];
        if (false === value || 'undefined' == typeof value) { continue; }

        // If the key ends with an @attr name, strip it.
        var at_pos = -1;
        var attr_name = false;
        if (-1 !== (at_pos = key.indexOf('@'))) {
          attr_name = key.substring(at_pos + 1);
          key = key.substring(0, at_pos);
        }

        // Attempt to find the placeholder by selector
        var el = (key) ? tmpl.find(key) : tmpl;
        if (!el.length) { continue; }

        if (attr_name) {
          // Set the attribute, if we had an attribute name.
          el.attr(attr_name, value);
        } else {
          if ('string' === typeof value) {
            // Strings work as HTML replacements.
            el.html(value);
          } else if ('undefined' != typeof value.nodeType) {
            // Elements become content replacements.
            el.empty().append(value);
          }
        }
      }
    });
  }

});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"underscore":"/home/lmorchard/devel/tootr/node_modules/underscore/underscore.js"}],"/home/lmorchard/devel/tootr/src/javascript/publishers/AmazonS3Bucket.js":[function(require,module,exports){
(function (global){
var $ = (typeof window !== "undefined" ? window.$ : typeof global !== "undefined" ? global.$ : null);
var _ = require('underscore');
var misc = require('../misc');
var S3Ajax = require('S3Ajax');

var AUTH_NAME = 'AmazonS3Bucket';

var config = {
  S3_BASE_URL: 'https://s3.amazonaws.com',
};

module.exports = function (publishers, baseModule) {
  var AmazonS3BucketPublisher = baseModule();

  // Wire up the login form.
  $('#LoginWithAmazonBucket').click(function () {
    var data = {
      type: AUTH_NAME
    };
    $(this).parent('form').serializeArray().forEach(function (item) {
      data[item.name] = item.value;
    });
    AmazonS3BucketPublisher.startLogin(data);
    return false;
  });

  AmazonS3BucketPublisher.startLogin = function (auth) {
    AmazonS3BucketPublisher.refreshAuth(auth, function (err) {
      if (err) {
        var msg = err.Message ? err.Message : JSON.stringify(err, null, '  ');
        window.alert("Login failed: " + msg);
      }
    });
  };

  AmazonS3BucketPublisher.checkAuth = function (cb) {
    var auth = publishers.getProfile();
    if (!auth || auth.type !== AUTH_NAME) { return cb(); }
    AmazonS3BucketPublisher.refreshAuth(auth, cb);
  };

  AmazonS3BucketPublisher.refreshAuth = function (auth, cb) {
    // Try out a publisher with given credentials...
    var publisher = new AmazonS3BucketPublisher(auth);
    publisher.get('profile.json', function (err, profileData) {

      if (err) {
        if ('NoSuchKey' === err.Code) {
          // Credentials worked, but there's no profile...
          return AmazonS3BucketPublisher.startRegistration(publisher, cb);
        } else {
          // Credentials failed, so bail with an error.
          publishers.clearCurrent();
          return cb(err);
        }
      }

      // Credentials worked, so we're good.
      _.extend(auth, JSON.parse(profileData));
      publishers.setCurrent(auth, publisher);
      return cb();

    });
  };

  AmazonS3BucketPublisher.startRegistration = function (publisher, cb) {
    // Get a nickname from the user, bail if not provided.
    // TODO: Rework this to not use a browser dialog.
    var nickname = window.prompt(
        "Login successful, but profile not found.\n" +
        "Enter a nickname to create a new one?");
    if (!nickname) { return cb('Registration cancelled'); }

    var name = window.prompt("Name for your profile? (optional)");
    if (!name) { name = nickname; }

    var email = window.prompt("Email for your profile? (optional)");

    var url = window.prompt("Static hosting URL for your bucket? (optional)");
    if (!url) {
      url = config.S3_BASE_URL + '/' + publisher.options.bucket + '/index.html';
    }

    var profile = JSON.stringify({
      url: url,
      name: name,
      nickname: nickname,
      email: email
    });

    publisher.put('profile.json', profile, function (err, result) {
      if (err) {
        var again = window.confirm(
          "Problem registering: " + err + "\n" +
          "Try again?");
        if (again) {
          AmazonS3BucketPublisher.startRegistration(publisher, cb);
        }
      } else {
        AmazonS3BucketPublisher.refreshAuth(publisher.options, cb);
      }
    });
  };

  AmazonS3BucketPublisher.prototype.init = function (options) {
    AmazonS3BucketPublisher.__base__.init.apply(this, arguments);
    this.client = new S3Ajax({
      base_url: config.S3_BASE_URL,
      key_id: this.options.keyID,
      secret_key: this.options.secret,
      defeat_cache: true
    });
  };

  AmazonS3BucketPublisher.prototype.startLogout = function () {
    publishers.clearCurrent();
  };

  AmazonS3BucketPublisher.prototype.list = function (path, cb) {
    this.client.listKeys(
      this.options.bucket,
      { prefix: path },
      function (req, obj) {
        var out = {};
        if (obj.ListBucketResult && obj.ListBucketResult.Contents) {
          obj.ListBucketResult.Contents.forEach(function (item) {
            var path = item.Key.replace(path, '');
            out[path] = item;
          });
        }
        cb(null, out);
      },
      function (req, obj) { cb(obj.Error, obj); }
    );
  };

  AmazonS3BucketPublisher.prototype.get = function (path, cb) {
    this.client.get(
      this.options.bucket, path,
      function (req, obj) { cb(null, req.responseText); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  AmazonS3BucketPublisher.prototype.rm = function (path, cb) {
    this.client.deleteKey(
      this.options.bucket, path,
      function (req, obj) { cb(null, req.responseText); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  AmazonS3BucketPublisher.prototype.put = function (path, content, cb) {
    var ext = path.substr(path.lastIndexOf('.')+1);
    var types = {
      'html': 'text/html; charset=UTF-8',
      'css': 'text/css; charset=UTF-8',
      'js': 'text/javascript; charset=UTF-8'
    };
    this.client.put(
      this.options.bucket, path, content,
      { content_type: types[ext] },
      function (req, obj) { cb(null, obj); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  return AmazonS3BucketPublisher;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../misc":"/home/lmorchard/devel/tootr/src/javascript/misc.js","S3Ajax":"/home/lmorchard/devel/tootr/src/javascript/vendor/S3Ajax.js","underscore":"/home/lmorchard/devel/tootr/node_modules/underscore/underscore.js"}],"/home/lmorchard/devel/tootr/src/javascript/publishers/AmazonS3MultiUser.js":[function(require,module,exports){
(function (global){
var $ = (typeof window !== "undefined" ? window.$ : typeof global !== "undefined" ? global.$ : null);
var _ = require('underscore');
var misc = require('../misc');
var S3Ajax = require('S3Ajax');

var AUTH_NAME = 'AmazonS3MultiUser';

// AmazonS3MultiUserPublisher app config, partially host-based
// TODO: Make this user-configurable - in localstorage?
var config = _.extend({
  S3_BASE_URL: 'https://s3.amazonaws.com',
  TOKEN_DURATION: 900,
  CLIENT_ID: 'amzn1.application-oa2-client.c64da1621c67449ab764c4cdf2f99761',
  ROLE_ARN: 'arn:aws:iam::197006402464:role/tootr-dev-users',
  BUCKET: 'toots-dev.lmorchard.com',
  REGISTER_URL: 'https://localhost:2443/register',
  PRESIGNER_URL: 'https://localhost:2443/presigned'
}, {
  "lmorchard.github.io": {
    CLIENT_ID: 'amzn1.application-oa2-client.d3ce7b272419457abf84b88a9d7d6bd3',
    ROLE_ARN: 'arn:aws:iam::197006402464:role/tootsr-amazon-user-buckets',
    BUCKET: 'toots.lmorchard.com',
    REGISTER_URL: 'https://tootspace-s3.herokuapp.com/register',
    PRESIGNER_URL: 'https://tootspace-s3.herokuapp.com/presigned'
  }
}[location.hostname]);

module.exports = function (publishers, baseModule) {
  var AmazonS3MultiUserPublisher = baseModule();

  setupAmazonLoginButton();

  AmazonS3MultiUserPublisher.startLogin = function () {
    var options = { scope : 'profile' };
    var redir = location.protocol + '//' + location.hostname +
      (location.port ? ':' + location.port : '') +
      location.pathname + '?loginType=' + AUTH_NAME;
    amazon.Login.authorize(options, redir);
  };

  AmazonS3MultiUserPublisher.checkAuth = function (cb) {
    var auth = publishers.getProfile();

    // If we don't have an auth profile, it's possible that we've just received
    // an access token on the redirect side of login.
    if (!auth) {
      var qparams = misc.getQueryParameters();
      if (qparams.loginType === AUTH_NAME) {
        var qparams = misc.getQueryParameters();
        if (qparams.access_token) {
          AmazonS3MultiUserPublisher.refreshAuth(qparams.access_token);
          // Clean out the auth redirect parameters from location
          history.replaceState({}, '', location.protocol + '//' +
              location.hostname + (location.port ? ':' + location.port : '') +
              location.pathname);
        }
      }
      return cb();
    }

    // We have an auth profile, but it's not ours.
    if (auth.type !== AUTH_NAME) { return cb(); }

    // We have an auth profile, but it could have expired. Refresh, if so.
    var now = new Date();
    var expiration = new Date(auth.credentials.Expiration);
    if (now >= expiration) {
      AmazonS3MultiUserPublisher.refreshAuth(auth.access_token);
      return cb();
    }

    // Looks like we have a fresh auth profile, so just go ahead and use it.
    publishers.setCurrent(auth, new AmazonS3MultiUserPublisher(auth));
    return cb();
  };

  AmazonS3MultiUserPublisher.refreshAuth = function (access_token) {
    var auth = {
      type: AUTH_NAME,
      access_token: access_token
    };

    var user_id = null;
    var profile = null;

    $.ajax({
      url: 'https://api.amazon.com/user/profile',
      headers: { 'Authorization': 'bearer ' + access_token }
    }).then(function (data, status, xhr) {

      user_id = data.user_id;

      return $.ajax({
        url: config.S3_BASE_URL + '/' + config.BUCKET +
          '/users/amazon/' + user_id + '.json',
        cache: false
      });

    }).then(function (data, status, xhr) {

      profile = data;
      _.extend(auth, profile);

      return $.ajax('https://sts.amazonaws.com/?' + $.param({
        'Action': 'AssumeRoleWithWebIdentity',
        'Version': '2011-06-15',
        'RoleSessionName': 'web-identity-federation',
        'ProviderId': 'www.amazon.com',
        'DurationSeconds': config.TOKEN_DURATION,
        'RoleArn': config.ROLE_ARN,
        'WebIdentityToken': access_token
      }));

    }).then(function (dataXML, status, xhr) {

      auth.credentials = misc.xmlToObj(dataXML)
        .AssumeRoleWithWebIdentityResponse
        .AssumeRoleWithWebIdentityResult
        .Credentials;
      publishers.setCurrent(auth, new AmazonS3MultiUserPublisher(auth));

    }).fail(function (xhr, status, err) {

      if (user_id && !profile) {
        // If we have a user_id, then Amazon login is okay. But, if we're
        // missing a profile then we need to start registration.
        AmazonS3MultiUserPublisher.startRegistration(access_token);
      } else {
        // All other failures in auth refresh lead to logout.
        publishers.clearCurrent();
      }

    });
  };

  AmazonS3MultiUserPublisher.startRegistration = function (access_token) {
    // Get a nickname from the user.
    // TODO: Rework this to not use a browser dialog.
    var nickname = window.prompt(
        "Login successful, but profile not found.\n" +
        "Enter a nickname to create a new one?");

    // Bail, if no nickname provided.
    if (!nickname) { return; }

    // Attempt to register the account with given nickname
    $.ajax({
      url: config.REGISTER_URL,
      type: 'POST',
      dataType: 'json',
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify({
        AccessToken: access_token,
        nickname: nickname
      })
    }).fail(function (xhr, status, err) {
      var again = window.confirm(
        "Problem registering: " + xhr.responseText + "\n" +
        "Try again?");
      if (again) {
        AmazonS3MultiUserPublisher.startRegistration(access_token);
      }
    }).done(function (data, status, xhr) {
      AmazonS3MultiUserPublisher.refreshAuth(access_token);
    });
  };

  AmazonS3MultiUserPublisher.prototype.init = function (options) {
    AmazonS3MultiUserPublisher.__base__.init.apply(this, arguments);

    var credentials = this.options.credentials;
    this.prefix = this.options.prefix;
    this.client = new S3Ajax({
      base_url: config.S3_BASE_URL,
      key_id: credentials.AccessKeyId,
      secret_key: credentials.SecretAccessKey,
      security_token: credentials.SessionToken,
      defeat_cache: true
    });
  };

  AmazonS3MultiUserPublisher.prototype.startLogout = function () {
    amazon.Login.logout();
    publishers.clearCurrent();
  };

  AmazonS3MultiUserPublisher.prototype.list = function (path, cb) {
    var prefix = this.prefix + path;
    this.client.listKeys(
      config.BUCKET,
      {prefix: prefix},
      function (req, obj) {
        var out = {};
        if (obj.ListBucketResult && obj.ListBucketResult.Contents) {
          obj.ListBucketResult.Contents.forEach(function (item) {
            var path = item.Key.replace(prefix, '');
            out[path] = item;
          });
        }
        cb(null, out);
      },
      function (req, obj) { cb(obj.Error, obj); }
    );
  };

  AmazonS3MultiUserPublisher.prototype.get = function (path, cb) {
    this.client.get(
      config.BUCKET, this.prefix + path,
      function (req, obj) { cb(null, req.responseText); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  AmazonS3MultiUserPublisher.prototype.rm = function (path, cb) {
    this.client.deleteKey(
      config.BUCKET, this.prefix + path,
      function (req, obj) { cb(null, req.responseText); },
      function (req, obj) { cb(obj.Error, null); }
    );
  };

  AmazonS3MultiUserPublisher.prototype.put = function (path, content, cb) {
    var ext = path.substr(path.lastIndexOf('.')+1);
    var types = {
      'html': 'text/html; charset=UTF-8',
      'css': 'text/css; charset=UTF-8',
      'js': 'text/javascript; charset=UTF-8'
    };
    var access_token = this.options.access_token;

    /*
     * To keep some control over uploads, I use a presigner service that
     * imposes a policy. Then, I need to rework this as a form POST instead of
     * an S3 REST API request.
     */
    $.ajax({
      url: config.PRESIGNER_URL,
      type: 'POST',
      dataType: 'json',
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify({
        AccessToken: access_token,
        Path: path,
        ContentType: types[ext]
      })
    }).then(function (data, status, xhr) {

      var formdata = new FormData();
      for (var k in data) {
        formdata.append(k, data[k]);
      }
      formdata.append('file', content);

      return $.ajax({
        url: config.S3_BASE_URL +  '/' + config.BUCKET + '/',
        type: 'POST',
        data: formdata,
        processData: false,
        contentType: false,
        cache: false
      });

    }).then(function (data, status, xhr) {
      cb(null, true);
    }, function (xhr, status, err) {
      cb(err, null);
    });

  };

  function setupAmazonLoginButton () {
    // Set up the Login with Amazon button
    // TODO: Maybe do this conditionally / on-demand only when an Amazon login is desired?
    window.onAmazonLoginReady = function() {
      amazon.Login.setClientId(config.CLIENT_ID);
      $('#LoginWithAmazonMultiUser').click(function () {
        AmazonS3MultiUserPublisher.startLogin();
        return false;
      });
    };
    (function(d) {
      var r = d.createElement('div');
      r.id = 'amazon-root';
      d.body.appendChild(r);
      var a = d.createElement('script');
      a.type = 'text/javascript';
      a.async = true;
      a.id = 'amazon-login-sdk';
      a.src = 'https://api-cdn.amazon.com/sdk/login1.js';
      r.appendChild(a);
    })(document);
  }

  return AmazonS3MultiUserPublisher;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../misc":"/home/lmorchard/devel/tootr/src/javascript/misc.js","S3Ajax":"/home/lmorchard/devel/tootr/src/javascript/vendor/S3Ajax.js","underscore":"/home/lmorchard/devel/tootr/node_modules/underscore/underscore.js"}],"/home/lmorchard/devel/tootr/src/javascript/publishers/Dropbox.js":[function(require,module,exports){
(function (global){
var $ = (typeof window !== "undefined" ? window.$ : typeof global !== "undefined" ? global.$ : null);
var _ = require('underscore');

var config = _.extend({
  APP_KEY: 'ovvlu8dh78f0j2m'
}, {
  "lmorchard.github.io": {
    APP_KEY: 'w9p1vvnppuhsqzk'
  }
}[location.hostname]);

var client = new Dropbox.Client({ key: config.APP_KEY });

module.exports = function (publishers, baseModule) {
  var DropboxPublisher = baseModule();

  $('#LoginWithDropbox').click(function () {
    DropboxPublisher.startLogin();
  });

  DropboxPublisher.startLogin = function () {
    client.authenticate(function(error, client) {
      if (error) {
        publishers.clearAuth();
      } else {
        DropboxPublisher.loadProfile(client);
      }
    });
  };

  DropboxPublisher.checkAuth = function (cb) {
    client.authenticate({interactive: false}, function(error, client) {
      if (error) {
        publishers.clearAuth();
        return cb(error, null);
      }
      if (client.isAuthenticated()) {
        var profile = publishers.getProfile();
        if (!profile) {
          DropboxPublisher.loadProfile(client);
        } else {
          var publisher = new DropboxPublisher({ client: client });
          publishers.setCurrent(profile, publisher);
        }
      }
      return cb(null);
    });
  };

  DropboxPublisher.loadProfile = function (client) {
    client.getAccountInfo({}, function (err, profile) {
      profile.type = 'Dropbox';
      profile.nickname = profile.uid;

      var publisher = new DropboxPublisher({ client: client });
      publishers.setCurrent(profile, publisher);
    });
  };

  DropboxPublisher.prototype.init = function (options) {
    DropboxPublisher.__base__.init.apply(this, arguments);
    this.client = this.options.client;
    this.profile = this.options.profile;
  };

  DropboxPublisher.prototype.startLogout = function () {
    if (!publishers.current) { return; }
    publishers.current.client.signOut();
    publishers.clearCurrent();
  };

  DropboxPublisher.prototype.list = function (path, cb) {
    this.client.readdir('/'+path, function (err, entries) {
      if (err) { return cb(err, null); }
      var out = {};
      for (var i=0; i<entries.length; i++) {
        out[entries[i]] = true;
      }
      cb(null, out);
    });
  };

  DropboxPublisher.prototype.get = function (path, cb) {
    this.client.readFile(path, cb);
  };

  DropboxPublisher.prototype.put = function (path, content, cb) {
    this.client.writeFile(path, content, cb);
  };

  DropboxPublisher.prototype.rm = function (path, cb) {
    this.client.remove(path, cb);
  };

  return DropboxPublisher;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"underscore":"/home/lmorchard/devel/tootr/node_modules/underscore/underscore.js"}],"/home/lmorchard/devel/tootr/src/javascript/publishers/Github.js":[function(require,module,exports){
(function (global){
var $ = (typeof window !== "undefined" ? window.$ : typeof global !== "undefined" ? global.$ : null);
var _ = require('underscore');
var misc = require('../misc');

var config = _.extend({
  API_BASE: 'https://api.github.com/',
  API_SCOPE: ['user:email', 'repo', 'gist'],
  BRANCH_NAME: 'gh-pages',
  CLIENT_ID: '6d59b16e660e246d3ee5',
  AUTHENTICATE_URL: 'https://localhost:9443/github/authenticate/',
  REPO_NAME: 'toots-dev'
}, {
  "lmorchard.github.io": {
    CLIENT_ID: '62a54438d65933d8dc8d',
    AUTHENTICATE_URL: 'https://tootr-github-gatekeeper.herokuapp.com/github/authenticate/',
    REPO_NAME: 'toots'
  }
}[location.hostname]);

module.exports = function (publishers, baseModule) {
  var GithubPublisher = baseModule();

  $('#LoginWithGithub').click(function () {
    GithubPublisher.startLogin();
  });

  GithubPublisher.startLogin = function () {
    location.href = "https://github.com/login/oauth/authorize?" + $.param({
      client_id: config.CLIENT_ID,
      scope: config.API_SCOPE.join(','),
      state: Date.now() + '-' + Math.random()
    });
  };

  GithubPublisher.checkAuth = function (cb) {
    var profile = publishers.getProfile();

    // If we don't have an auth profile, it's possible that we've just received
    // an access token on the redirect side of login.
    if (!profile) {
      var qparams = misc.getQueryParameters();
      if (qparams.loginType === 'Github') {
        var qparams = misc.getQueryParameters();
        if (qparams.code) {
          $.getJSON(config.AUTHENTICATE_URL + qparams.code, function(data) {
            GithubPublisher.refreshCredentials(data.token);
            // Clean out the auth redirect parameters from location
            history.replaceState({}, '', location.protocol + '//' +
                location.hostname + (location.port ? ':' + location.port : '') +
                location.pathname);
          });
        }
      }
      return cb();
    }

    // We have an auth profile, but it's not ours.
    if (profile.type !== 'Github') { return cb(); }

    // Looks like we have a fresh auth profile, so just go ahead and use it.
    publishers.setCurrent(profile, new GithubPublisher(profile));
    return cb();
  };

  GithubPublisher.refreshCredentials = function (access_token) {
    var profile = {
      access_token: access_token
    };
    $.ajax({
      type: 'GET',
      url: config.API_BASE + 'user',
      headers: { authorization: 'token ' + access_token }
    }).then(function (data, status, xhr) {
      _.extend(profile, data);
      profile.type = 'Github';
      profile.nickname = data.login;
      profile.url = data.html_url;
      profile.avatar = data.avatar_url;
      publishers.setCurrent(profile, new GithubPublisher(profile));
    }).fail(function (xhr, status, err) {
      publishers.clearCurrent();
    });
  };

  GithubPublisher.prototype.init = function (options) {
    GithubPublisher.__base__.init.apply(this, arguments);

    this.contents_base_url = config.API_BASE + 'repos/' + this.options.login +
      '/' + config.REPO_NAME + '/contents/';
  };

  GithubPublisher.prototype.startLogout = function () {
    publishers.clearCurrent();
  };

  GithubPublisher.prototype.list = function (path, cb) {
    $.ajax({
      type: 'GET',
      url: this.contents_base_url + path + '?ref=' + config.BRANCH_NAME,
      headers: { authorization: 'token ' + this.options.access_token }
    }).then(function (data, status, xhr) {
      var out = {};
      if (_.isArray(data)) {
        data.forEach(function (item) {
          out[item.name] = item;
        });
      }
      return cb(null, out);
    }).fail(function (xhr, status, err) {
      return cb(xhr.responseText, null);
    });
  };

  GithubPublisher.prototype.get = function (path, cb) {
    $.ajax({
      type: 'GET',
      url: this.contents_base_url + path + '?ref=' + config.BRANCH_NAME,
      headers: { authorization: 'token ' + this.options.access_token }
    }).then(function (data, status, xhr) {
      if (_.isObject(data)) {
        return cb(null, atob(data.content));
      } else {
        return cb('not a file', null);
      }
    }).fail(function (xhr, status, err) {
      return cb(err, null);
    });
  };

  GithubPublisher.prototype.put = function (path, content, cb) {
    var $this = this;

    // Need to first attempt a GET, to see if the resource exists. If so, then
    // we can use the SHA hash to replace it with PUT. Otherwise, we're
    // creating a new resource.
    $.ajax({
      type: 'GET',
      url: $this.contents_base_url + path + '?ref=' + config.BRANCH_NAME,
      headers: { authorization: 'token ' + $this.options.access_token }
    }).always(function (data, status, xhr) {
      var params = {
        branch: config.BRANCH_NAME,
        message: 'Updated at ' + (new Date().toISOString()),
        content: btoa(content)
      };
      if (status !== 'error' && data.sha) {
        params.sha = data.sha;
      }

      $.ajax({
        type: 'PUT',
        url: $this.contents_base_url + path,
        headers: { authorization: 'token ' + $this.options.access_token },
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify(params)
      }).then(function (data, status, xhr) {
        return cb(null, data);
      }).fail(function (xhr, status, err) {
        return cb(err, null);
      });

    });
  };

  GithubPublisher.prototype.rm = function (path, cb) {
    var $this = this;

    // Again, need to attempt a GET first to find the SHA hash. If found, then
    // we can delete.
    $.ajax({
      type: 'GET',
      url: $this.contents_base_url + path + '?ref=' + config.BRANCH_NAME,
      headers: { authorization: 'token ' + $this.options.access_token }
    }).done(function (data, status, xhr) {
      if (!data.sha) {
        return cb('not found', null);
      }
      var params = {
        branch: config.BRANCH_NAME,
        message: 'Updated at ' + (new Date().toISOString()),
        sha: data.sha
      };
      $.ajax({
        type: 'DELETE',
        url: $this.contents_base_url + path,
        headers: { authorization: 'token ' + $this.options.access_token },
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify(params)
      }).then(function (data, status, xhr) {
        return cb(null, data);
      }).fail(function (xhr, status, err) {
        return cb(err, null);
      });
    });
  };

  return GithubPublisher;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../misc":"/home/lmorchard/devel/tootr/src/javascript/misc.js","underscore":"/home/lmorchard/devel/tootr/node_modules/underscore/underscore.js"}],"/home/lmorchard/devel/tootr/src/javascript/publishers/index.js":[function(require,module,exports){
(function (global){
var _ = require('underscore');
var $ = (typeof window !== "undefined" ? window.$ : typeof global !== "undefined" ? global.$ : null);
var PubSub = require('pubsub-js');
var async = require('async');
var MD5 = require('MD5');

var publishers = module.exports = {};

var LOCAL_PROFILE_KEY = 'profile20141102';

publishers.checkAuth = function () {
  var profile = publishers.getProfile();

  var check = [];
  if (profile && profile.type in modules) {
    check.push(publishers[profile.type]);
  } else {
    for (var name in modules) {
      check.push(publishers[name]);
    }
  }

  async.each(check, function (m, next) {
    m.checkAuth(next);
  }, function (err) {
    if (!publishers.current) {
      publishers.clearCurrent();
    }
  });
};

publishers.getProfile = function () {
  var profile = null;
  try {
    profile = JSON.parse(localStorage.getItem(LOCAL_PROFILE_KEY));

    // HACK: Try to ensure we have an avatar, if we have an email address
    // TODO: Should this be done per-publisher?
    if (!profile.avatar) {
      if (!profile.emailHash && profile.email) {
        profile.emailHash = MD5.hex_md5(profile.email);
      }
      if (profile.emailHash) {
        profile.avatar = 'https://www.gravatar.com/avatar/' + profile.emailHash;
      }
    }

  } catch (e) {
    /* No-op */
  }
  return profile;
}

publishers.setCurrent = function (profile, publisher) {
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  publishers.current = publisher;
  PubSub.publish('publishers.setCurrent', publisher);
};

publishers.clearCurrent = function () {
  publishers.current = null;
  localStorage.removeItem(LOCAL_PROFILE_KEY);
  PubSub.publish('publishers.clearCurrent');
}

publishers.logout = function () {
  if (!publishers.current) { return; }
  publishers.current.startLogout();
};

var baseModule = function () {
  var constructor = function () {
    this.init.apply(this, arguments);
  };
  constructor.defaults = {};
  constructor.__base__ = {
    init: function (options) {
      this.options = _.defaults(options || {}, constructor.defaults);
    }
  };
  _.extend(constructor.prototype, constructor.__base__);
  return constructor;
};

var modules = {
  'AmazonS3Bucket': require('./AmazonS3Bucket'),
  'AmazonS3MultiUser': require('./AmazonS3MultiUser'),
  'Dropbox': require('./Dropbox'),
  'Github': require('./Github')
};

for (var name in modules) {
  publishers[name] = modules[name](publishers, baseModule);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./AmazonS3Bucket":"/home/lmorchard/devel/tootr/src/javascript/publishers/AmazonS3Bucket.js","./AmazonS3MultiUser":"/home/lmorchard/devel/tootr/src/javascript/publishers/AmazonS3MultiUser.js","./Dropbox":"/home/lmorchard/devel/tootr/src/javascript/publishers/Dropbox.js","./Github":"/home/lmorchard/devel/tootr/src/javascript/publishers/Github.js","MD5":"/home/lmorchard/devel/tootr/src/javascript/vendor/md5.js","async":"/home/lmorchard/devel/tootr/node_modules/async/lib/async.js","pubsub-js":"/home/lmorchard/devel/tootr/node_modules/pubsub-js/src/pubsub.js","underscore":"/home/lmorchard/devel/tootr/node_modules/underscore/underscore.js"}],"/home/lmorchard/devel/tootr/src/javascript/vendor/S3Ajax.js":[function(require,module,exports){
(function (global){
;__browserify_shim_require__=require;(function browserifyShim(module, exports, require, define, browserify_shim__define__module__export__) {
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
            kwArgs.content_type = 'text/plain';
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

; browserify_shim__define__module__export__(typeof S3Ajax != "undefined" ? S3Ajax : window.S3Ajax);

}).call(global, undefined, undefined, undefined, undefined, function defineExport(ex) { module.exports = ex; });

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"/home/lmorchard/devel/tootr/src/javascript/vendor/jquery.timeago.js":[function(require,module,exports){
/**
 * Timeago is a jQuery plugin that makes it easy to support automatically
 * updating fuzzy timestamps (e.g. "4 minutes ago" or "about 1 day ago").
 *
 * @name timeago
 * @version 1.4.1
 * @requires jQuery v1.2.3+
 * @author Ryan McGeary
 * @license MIT License - http://www.opensource.org/licenses/mit-license.php
 *
 * For usage and examples, visit:
 * http://timeago.yarp.com/
 *
 * Copyright (c) 2008-2013, Ryan McGeary (ryan -[at]- mcgeary [*dot*] org)
 */

(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['jquery'], factory);
  } else {
    // Browser globals
    factory(jQuery);
  }
}(function ($) {
  $.timeago = function(timestamp) {
    if (timestamp instanceof Date) {
      return inWords(timestamp);
    } else if (typeof timestamp === "string") {
      return inWords($.timeago.parse(timestamp));
    } else if (typeof timestamp === "number") {
      return inWords(new Date(timestamp));
    } else {
      return inWords($.timeago.datetime(timestamp));
    }
  };
  var $t = $.timeago;

  $.extend($.timeago, {
    settings: {
      refreshMillis: 60000,
      allowPast: true,
      allowFuture: false,
      localeTitle: false,
      cutoff: 0,
      strings: {
        prefixAgo: null,
        prefixFromNow: null,
        suffixAgo: "ago",
        suffixFromNow: "from now",
        inPast: 'any moment now',
        seconds: "less than a minute",
        minute: "about a minute",
        minutes: "%d minutes",
        hour: "about an hour",
        hours: "about %d hours",
        day: "a day",
        days: "%d days",
        month: "about a month",
        months: "%d months",
        year: "about a year",
        years: "%d years",
        wordSeparator: " ",
        numbers: []
      }
    },

    inWords: function(distanceMillis) {
      if(!this.settings.allowPast && ! this.settings.allowFuture) {
          throw 'timeago allowPast and allowFuture settings can not both be set to false.';
      }

      var $l = this.settings.strings;
      var prefix = $l.prefixAgo;
      var suffix = $l.suffixAgo;
      if (this.settings.allowFuture) {
        if (distanceMillis < 0) {
          prefix = $l.prefixFromNow;
          suffix = $l.suffixFromNow;
        }
      }

      if(!this.settings.allowPast && distanceMillis >= 0) {
        return this.settings.strings.inPast;
      }

      var seconds = Math.abs(distanceMillis) / 1000;
      var minutes = seconds / 60;
      var hours = minutes / 60;
      var days = hours / 24;
      var years = days / 365;

      function substitute(stringOrFunction, number) {
        var string = $.isFunction(stringOrFunction) ? stringOrFunction(number, distanceMillis) : stringOrFunction;
        var value = ($l.numbers && $l.numbers[number]) || number;
        return string.replace(/%d/i, value);
      }

      var words = seconds < 45 && substitute($l.seconds, Math.round(seconds)) ||
        seconds < 90 && substitute($l.minute, 1) ||
        minutes < 45 && substitute($l.minutes, Math.round(minutes)) ||
        minutes < 90 && substitute($l.hour, 1) ||
        hours < 24 && substitute($l.hours, Math.round(hours)) ||
        hours < 42 && substitute($l.day, 1) ||
        days < 30 && substitute($l.days, Math.round(days)) ||
        days < 45 && substitute($l.month, 1) ||
        days < 365 && substitute($l.months, Math.round(days / 30)) ||
        years < 1.5 && substitute($l.year, 1) ||
        substitute($l.years, Math.round(years));

      var separator = $l.wordSeparator || "";
      if ($l.wordSeparator === undefined) { separator = " "; }
      return $.trim([prefix, words, suffix].join(separator));
    },

    parse: function(iso8601) {
      var s = $.trim(iso8601);
      s = s.replace(/\.\d+/,""); // remove milliseconds
      s = s.replace(/-/,"/").replace(/-/,"/");
      s = s.replace(/T/," ").replace(/Z/," UTC");
      s = s.replace(/([\+\-]\d\d)\:?(\d\d)/," $1$2"); // -04:00 -> -0400
      s = s.replace(/([\+\-]\d\d)$/," $100"); // +09 -> +0900
      return new Date(s);
    },
    datetime: function(elem) {
      var iso8601 = $t.isTime(elem) ? $(elem).attr("datetime") : $(elem).attr("title");
      return $t.parse(iso8601);
    },
    isTime: function(elem) {
      // jQuery's `is()` doesn't play well with HTML5 in IE
      return $(elem).get(0).tagName.toLowerCase() === "time"; // $(elem).is("time");
    }
  });

  // functions that can be called via $(el).timeago('action')
  // init is default when no action is given
  // functions are called with context of a single element
  var functions = {
    init: function(){
      var refresh_el = $.proxy(refresh, this);
      refresh_el();
      var $s = $t.settings;
      if ($s.refreshMillis > 0) {
        this._timeagoInterval = setInterval(refresh_el, $s.refreshMillis);
      }
    },
    update: function(time){
      var parsedTime = $t.parse(time);
      $(this).data('timeago', { datetime: parsedTime });
      if($t.settings.localeTitle) $(this).attr("title", parsedTime.toLocaleString());
      refresh.apply(this);
    },
    updateFromDOM: function(){
      $(this).data('timeago', { datetime: $t.parse( $t.isTime(this) ? $(this).attr("datetime") : $(this).attr("title") ) });
      refresh.apply(this);
    },
    dispose: function () {
      if (this._timeagoInterval) {
        window.clearInterval(this._timeagoInterval);
        this._timeagoInterval = null;
      }
    }
  };

  $.fn.timeago = function(action, options) {
    var fn = action ? functions[action] : functions.init;
    if(!fn){
      throw new Error("Unknown function name '"+ action +"' for timeago");
    }
    // each over objects here and call the requested function
    this.each(function(){
      fn.call(this, options);
    });
    return this;
  };

  function refresh() {
    var data = prepareData(this);
    var $s = $t.settings;

    if (!isNaN(data.datetime)) {
      if ( $s.cutoff == 0 || Math.abs(distance(data.datetime)) < $s.cutoff) {
        $(this).text(inWords(data.datetime));
      }
    }
    return this;
  }

  function prepareData(element) {
    element = $(element);
    if (!element.data("timeago")) {
      element.data("timeago", { datetime: $t.datetime(element) });
      var text = $.trim(element.text());
      if ($t.settings.localeTitle) {
        element.attr("title", element.data('timeago').datetime.toLocaleString());
      } else if (text.length > 0 && !($t.isTime(element) && element.attr("title"))) {
        element.attr("title", text);
      }
    }
    return element.data("timeago");
  }

  function inWords(date) {
    return $t.inWords(distance(date));
  }

  function distance(date) {
    return (new Date().getTime() - date.getTime());
  }

  // fix for IE6 suckage
  document.createElement("abbr");
  document.createElement("time");
}));

},{}],"/home/lmorchard/devel/tootr/src/javascript/vendor/md5.js":[function(require,module,exports){
(function (global){
;__browserify_shim_require__=require;(function browserifyShim(module, exports, require, define, browserify_shim__define__module__export__) {
(function () {
/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;   /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = "";  /* base-64 pad character. "=" for strict RFC compliance   */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_md5(s)    { return rstr2hex(rstr_md5(str2rstr_utf8(s))); }
function b64_md5(s)    { return rstr2b64(rstr_md5(str2rstr_utf8(s))); }
function any_md5(s, e) { return rstr2any(rstr_md5(str2rstr_utf8(s)), e); }
function hex_hmac_md5(k, d)
  { return rstr2hex(rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d))); }
function b64_hmac_md5(k, d)
  { return rstr2b64(rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d))); }
function any_hmac_md5(k, d, e)
  { return rstr2any(rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d)), e); }

/*
 * Perform a simple self-test to see if the VM is working
 */
function md5_vm_test()
{
  return hex_md5("abc").toLowerCase() == "900150983cd24fb0d6963f7d28e17f72";
}

/*
 * Calculate the MD5 of a raw string
 */
function rstr_md5(s)
{
  return binl2rstr(binl_md5(rstr2binl(s), s.length * 8));
}

/*
 * Calculate the HMAC-MD5, of a key and some data (raw strings)
 */
function rstr_hmac_md5(key, data)
{
  var bkey = rstr2binl(key);
  if(bkey.length > 16) bkey = binl_md5(bkey, key.length * 8);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = binl_md5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
  return binl2rstr(binl_md5(opad.concat(hash), 512 + 128));
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
  var i, j, q, x, quotient;

  /* Convert to an array of 16-bit big-endian values, forming the dividend */
  var dividend = Array(Math.ceil(input.length / 2));
  for(i = 0; i < dividend.length; i++)
  {
    dividend[i] = (input.charCodeAt(i * 2) << 8) | input.charCodeAt(i * 2 + 1);
  }

  /*
   * Repeatedly perform a long division. The binary array forms the dividend,
   * the length of the encoding is the divisor. Once computed, the quotient
   * forms the dividend for the next step. All remainders are stored for later
   * use.
   */
  var full_length = Math.ceil(input.length * 8 /
                                    (Math.log(encoding.length) / Math.log(2)));
  var remainders = Array(full_length);
  for(j = 0; j < full_length; j++)
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
    remainders[j] = x;
    dividend = quotient;
  }

  /* Convert the remainders to the output string */
  var output = "";
  for(i = remainders.length - 1; i >= 0; i--)
    output += encoding.charAt(remainders[i]);

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
 * Convert a raw string to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */
function rstr2binl(input)
{
  var output = Array(input.length >> 2);
  for(var i = 0; i < output.length; i++)
    output[i] = 0;
  for(var i = 0; i < input.length * 8; i += 8)
    output[i>>5] |= (input.charCodeAt(i / 8) & 0xFF) << (i%32);
  return output;
}

/*
 * Convert an array of little-endian words to a string
 */
function binl2rstr(input)
{
  var output = "";
  for(var i = 0; i < input.length * 32; i += 8)
    output += String.fromCharCode((input[i>>5] >>> (i % 32)) & 0xFF);
  return output;
}

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */
function binl_md5(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << ((len) % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
    b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
    b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

    a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return Array(a, b, c, d);
}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t)
{
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
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

// LMO: modularize the important bits
window.MD5 = {
  hex_md5: hex_md5,
  b64_md5: b64_md5,
  any_md5: any_md5,
  hex_hmac_md5: hex_hmac_md5,
  b64_hmac_md5: b64_hmac_md5,
  any_hmac_md5: any_hmac_md5
};

}());

; browserify_shim__define__module__export__(typeof MD5 != "undefined" ? MD5 : window.MD5);

}).call(global, undefined, undefined, undefined, undefined, function defineExport(ex) { module.exports = ex; });

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},["./src/javascript/app.js"]);
