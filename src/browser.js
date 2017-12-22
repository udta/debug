/**
 * This is the web browser implementation of `debug()`.
 */

exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.saveLocalLogState = saveLocalLogState;
exports.loadLocalLogState = loadLocalLogState;
exports.useColors = useColors;
exports.updateDBInfo = updateDBInfo;
exports.sessionStorage = window.sessionStorage;
exports.logStorage = logStorage(); 
exports.dbStorage = dbStorage(); //Save the dbName into the "DatabaseList" DB
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */
/*
exports.colors = [
  '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC',
  '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF',
  '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC',
  '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF',
  '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC',
  '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
  '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366',
  '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933',
  '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC',
  '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF',
  '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
];*/
exports.colors = [
    '#295288'
   //'#46A7C9'
    ];

/**
 * Background Colors
 */
exports.bgColors = [
  'inherit', //DEBUG
  'inherit', //LOG
  '#46A7C9', //INFO
  '#D08005;font-size:14px', //WARN
  '#F64863;font-size:16px', //ERROR
  '#F64863;font-size:18px'  //FATAL
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // Internet Explorer do not support colors. 
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/trident\/(\d+)/)) {
      return false;
  }

  // Rzhang: Edge supports colors since 16215
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/edge\/(\d+)/) 
      && (parseInt(navigator.userAgent.toLowerCase().match(/edge\/\d+.(\d+)/)[1]) < 16215)) {
      return false;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ');
    //+ '+' + module.exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: ' + this.bgColor)

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {  
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  if (this.bgColor !== debug.bgColors[4]) {
    return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
  } else {
    return 'object' === typeof console
           && console.error
           && Function.prototype.apply.call(console.error, console, arguments);

  }
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Save LocalLog enable state.
 *
 * @param {Bool} state
 * @api private
 */

function saveLocalLogState(state) {
  try {
    if (null == state || state != false) {
      exports.storage.setItem('localLog', true);
    } else {
      exports.storage.setItem('localLog', false); 
    }
  } catch (e) {
  }
}

/**
 * Load `localLog` setting.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function loadLocalLogState() {
  var r = true;
  try {
      r = exports.storage.localLog;
  } catch (e) {
  }

  // If debug isn't set in LS
  if (!r ) {
    r = true;
  }

  return r;
}

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}

/**
 * LogStorage attempts to return the localForage (npm install
 * localforage).
 *
 * The LogStorage is for storing all logs in the browser
 * storage.
 * 
 * @return {LocalForage}
 * @api private
 * @author udta (17-11-23)
 */
function logStorage() {
  try {

    if (window.Promise != undefined) {
      return require('./localforage.nopromises.js');
    } else {
      return require('./localforage.js');
    }
  } catch (e) {}
}

function dbStorage() {
  try {
    return exports.logStorage.createInstance( { name: "DatabaseList",
           driver:  exports.logStorage.INDEXEDDB });
  } catch (e) {
  }
}

/**
 * Update the dbInformation in database "DatabaseList"
 * The info is a json: {TZ: xx, ConfID：xx， CallID: xx,
 * email: xx}
 *
 * @api public
 */
function updateDBInfo(info) {
    try {
      exports.dbStorage.setItem(exports.sessionStorage.dbName, info);
    } catch (e) {
    }
}

module.exports = require('./common')(exports);

var formatters = module.exports.formatters;

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};
