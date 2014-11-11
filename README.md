# tootr!

## Docs

* <https://lmorchard.github.io/tootr/docs/>

## TODO

* Profile
  * Edit fields like bio, etc.
  * Upload image other than gravatar

* Better config
  * Pull config out of modules, put into a shared .json / .js at project root.

* Need a way to "upgrade" the published feed template
  * eg. for markup-affecting themes, etc

* Dev papercuts
  * Start instance of lmorchard/tootspace-s3 from gulp watch
  * Start instance of prose/gatekeeper from gulp watch
  * Maybe start `mkdocs serve` too?
  * Commit a self-signed SSL key/cert pair for localhost dev convenience?

* General UX
  * Need network loading indicators
  * Remember last publisher logged in
    * de-emphasize / hide other choices after first login

* Toots
  * edit
  * delete

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
