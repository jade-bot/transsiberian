/*!
 * Ext JS Connect
 * Copyright(c) 2010 Sencha Inc.
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var fs = require('fs'),
    path = require('path'),
    url = require('url');

/**
 * Require cache.
 * 
 * @type Object
 */

var cache = {};

/**
 * Setup compiler.
 *
 * Options:
 *
 *   - `src`          Source directory, defaults to **CWD**.
 *   - `dest`         Destination directory, defaults `src`.
 *   - `enable`       Array of enabled compilers.
 *   - `autocompile`  Autocompile the files every request. Ideal for development.
 *   - `compress`     Get rid of the white spaces and comments.
 *
 * Compilers:
 *
 *   - `sass`   Compiles cass to css
 *   - `less`   Compiles less to css
 *   - `coffeescript`   Compiles coffee to js
 *
 * @param {Object} options
 * @api public
 */

exports = module.exports = function compiler(options){
    options = options || {};

    var srcDir = process.connectEnv.compilerSrc || options.src || process.cwd(),
        destDir = process.connectEnv.compilerDest || options.dest || srcDir,
        autocompile = options.autocompile || false,
        will_compress = options.compress || false,
        enable = options.enable;

    if (!enable || enable.length === 0) {
        throw new Error('compiler\'s "enable" option is not set, nothing will be compiled.');
    }

    return function compiler(req, res, next){
        if (req.method !== 'GET') return next();
        var pathname = url.parse(req.url).pathname;
        for (var i = 0, len = enable.length; i < len; ++i) {
            var name = enable[i],
                compiler = compilers[name];
            if (compiler.match.test(pathname)) {
                var src = (srcDir + pathname).replace(compiler.match, compiler.ext),
                    dest = destDir + pathname;

                // Compare mtimes
                fs.stat(src, function(err, srcStats){
                    if (err) {
                        if (err.errno === process.ENOENT) {
                            next();
                        } else {
                            next(err);
                        }
                    } else {
                        fs.stat(dest, function(err, destStats){
                            if (err) {
                                // Oh snap! it does not exist, compile it
                                if (err.errno === process.ENOENT) {
                                    compile();
                                } else {
                                    next(err);
                                }
                            } else {
                                // Source has changed, compile it
                                if (srcStats.mtime > destStats.mtime || autocompile) {
                                    compile();
                                } else {
                                    // Defer file serving
                                    next();
                                }
                            }
                        });
                    }
                });

                // Compile to the destination
                function compile() {
                    fs.readFile(src, 'utf8', function(err, str){
                        if (err) {
                            next(err);
                        } else {
                            compiler.compile(str, function(err, str){
                                if (err) {
                                    next(err);
                                } else {
                                    if(will_compress) {
                                      str = compress(str);
                                    }
                                    fs.writeFile(dest, str, 'utf8', function(err){
                                        next(err);
                                    });
                                }
                            });
                        }
                    });
                }

                // Compress str
                function compress(str) {
                  str = str.replace(/[\n\r]*/mg,''); // blank lines
                  str = str.replace(/\/\*.*?\*\//g,' '); // comments
                  str = str.replace(/ +/g,' '); // more than one blank space
                  str = str.replace(/: /g,':'); // usual spaces
                  str = str.replace(/; /g,';'); // usual spaces
                  str = str.replace(/ ?{ ?/g,'{'); // usual spaces
                  return str;
                }

                return;
            }
        }
        next();
    };
};

/**
 * Bundled compilers:
 *
 *  - [sass](http://github.com/visionmedia/sass.js) to _css_
 *  - [less](http://github.com/cloudhead/less.js) to _css_
 *  - [coffee](http://github.com/jashkenas/coffee-script) to _js_
 */

var compilers = exports.compilers = {
    sass: {
        match: /\.css$/,
        ext: '.sass',
        compile: function(str, fn){
            var sass = cache.sass || (cache.sass = require('sass'));
            try {
                fn(null, sass.render(str));
            } catch (err) {
                fn(err);
            }
        }
    },
    less: {
        match: /\.css$/,
        ext: '.less',
        compile: function(str, fn){
            var less = cache.less || (cache.less = require('less'));
            try {
                less.render(str, fn);
            } catch (err) {
                fn(err);
            }
        }
    },
    coffeescript: {
      match: /\.js$/,
      ext: '.coffee',
      compile: function(str, fn){
          var coffee = cache.coffee || (cache.coffee = require('coffee-script'));
          try {
              fn(null, coffee.compile(str));
          } catch (err) {
              fn(err);
          }
      }
    }
};
