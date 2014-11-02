# tootr!

See also: [tootr: microblogging app, hosting not included](http://blog.lmorchard.com/2014/10/11/tootr-1)

## Hacking

```
npm install
gulp build
```

## TODO

* Improve Amazon S3 hosting
  * Use presigner to allow writes to ~username URL spaces using amazon-uid
    based profile data URLs

* General UX
  * Need network loading indicators
  * Remember last publisher logged in
    * de-emphasize / hide other choices after first login

* Toots
  * edit
  * delete

* Profile
  * Start from Amazon profile, allow edit
  * Link amazon user ID to a user-chosen nickname?
  * Upload image other than gravatar

* Publishers
  * amazon s3 with own credentials
  * github
  * webdav (?)
  * ???

* Archives
  * collate toots into HTML feeds by date yyyy/mm/dd.html
    * index.html alias / copy for current date?

* Importer for Twitter archive CSV / JSON
