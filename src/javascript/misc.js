var _ = require('underscore');
var $ = require('jquery');

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
