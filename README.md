# personal-website

Placeholder site for sadok.mx until the full website launches. Static HTML and CSS, no build step.

Open `index.html` in a browser to preview.


## Credits

The intro uses [Rezmason's Matrix digital rain](https://github.com/Rezmason/matrix) (MIT), vendored in `matrix/` and trimmed to the classic version with the regl renderer. The one local change is noted in `matrix/js/main.js`. It needs a web server (it loads ES modules and shaders), so opening `index.html` from disk skips the intro. Run `python3 -m http.server` to preview it locally.
