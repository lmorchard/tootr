# tootr!

## Docs

* <https://lmorchard.github.io/tootr/docs/>

## TODO

* Profile
  * Upload image other than gravatar

* Conflict resolution - eg. 2 clients in operation
  * Grab etag on load
  * Check etag before save
  * On etag mismatch, reload & merge entries
  * Then, save

* Better config
  * Pull config out of modules, put into a shared .json / .js at project root.

* Dev papercuts
  * Start instance of lmorchard/tootspace-s3 from gulp watch
  * Start instance of prose/gatekeeper from gulp watch
  * Maybe start `mkdocs serve` too?
  * Commit a self-signed SSL key/cert pair for localhost dev convenience?

* General UX
  * Need network loading indicators
  * Remember last publisher logged in
    * de-emphasize / hide other choices after first login

* Publishers
  * webdav (?)
  * ???

* Archives
  * collate toots into HTML feeds by date yyyy/mm/dd.html
    * index.html alias / copy for current date?

* Importer for Twitter archive CSV / JSON

## Blue Sky

* Accept "plugin" publishers as external JS libs following publisher API hosted
  by 3rd parties. (use .well-known?)

* Cross-site things
  * Bookmarklet? window.postMessage + shared domain
  * re-tooting
  * following
