# How-to: GitHub Pages

Tootr can publish to a repository on GitHub. This lets you take advantage of
[GitHub Pages][], a free-of-charge web publishing utility for developers.

## Create a GitHub repository

You'll need to create a repository named "toots". Tootr is currently
hardcoded to use that name, though this should change sometime in the future
to allow you to choose any repository you like.

## Create a gh-pages branch

Once you've created a repository, you need to create a branch named
"gh-pages". You can do this by clicking the "branch" dropdown, typing
"gh-pages", and then clicking "Create branch: gh-pages".

## Log into Tootr using GitHub

Now, you can Login with GitHub on Tootr and your toots will be saved as
commits to your git repository and should be published shortly!

## Appendix

### Set up your own Gatekeeper

By default, Tootr uses an instance of [prose/gatekeeper][] hosted at
tootr-github-gatekeeper.herokuapp.com in order to facilitate logins via OAuth
on GitHub. This can't be done entirely on the client-side due to
security-related limitations in the GitHub API.

This Heroku app may go away, someday. So, you may want to consider running
your own instance and tweaking the `AUTHENTICATE_URL` setting [in the GitHub
publisher module][module].

[GitHub Pages]: https://pages.github.com/
[prose/gatekeeper]: https://github.com/prose/gatekeeper
[module]: https://github.com/lmorchard/tootr/blob/master/src/javascript/publishers/Github.js#L15

<!-- vim: set wrap wm=5 syntax=mkd textwidth=78: -->
