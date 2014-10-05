module.exports.getQueryParameters = function (str) {
  return (str || document.location.search)
    .replace(/(^\?)/,'').split("&")
    .map(function (n) {
      return n = n.split("="),
        this[n[0]] = decodeURIComponent(n[1]),
        this
    }.bind({}))[0];
}

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
}
