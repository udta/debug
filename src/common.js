
/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */
var sprintf = require("sprintf-js").sprintf;
var vsprintf = require("sprintf-js").vsprintf;

var argsToString = function(args) {
    var len = args.length;

    //sprintf-js did not support %o / %O
    args[0] = args[0].replace(/%o/g, "%s");

    switch (args.length) {
    case 1:
        return args[0];
    case 2:
        return sprintf(args[0], args[1]);
    case 3:
        return sprintf(args[0], args[1], args[2]);
    case 4:
        return sprintf(args[0], args[1], args[2], args[3]);
    case 5:
        return sprintf(args[0], args[1], args[2], args[3], args[4]);
    case 6:
        return sprintf(args[0], args[1], args[2], args[3], args[4], args[5]);
    case 7:
        return sprintf(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
    case 8:
        return sprintf(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7]);
    case 9:
        return sprintf(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8]);
    case 10:
        return sprintf(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9]);
    case 11:
        return sprintf(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10]);
    case 12:
        return sprintf(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10], args[11]);
    case 13:
        return sprintf(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10], args[11], args[12]);
    case 14:
        return sprintf(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10], args[11], args[12], args[13]);
    case 15:
        return sprintf(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10], args[11], args[12], args[13], args[14]);
    case 16:
        return sprintf(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10], args[11], args[12], args[13], args[14], args[15]);
    default:
        return null;
    }
}

    module.exports = function setup(env) {
    createDebug.debug = createDebug['default'] = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.enabledLocalLog = enabledLocalLog;
    createDebug.enableLocalLog = enableLocalLog;
    createDebug.disableLocalLog = disableLocalLog;
    createDebug.getLocalLogs = getLocalLogs;
    createDebug.getLocalDBName = getLocalDBName;
    //createDebug.humanize = require('ms');

    Object.keys(env).forEach(function(key) {
            createDebug[key] = env[key];
        });

    createDebug.keyBuffer = new Array();
    createDebug.logBuffer = new Array();

    if (!env.sessionStorage.dbName) {
        env.sessionStorage.setItem("dbName", "db_" + Math.random().toString(36).substr(2));
        env.sessionStorage.setItem("dbIndex", "0");
    }

    createDebug.logStorage.config( { name: env.sessionStorage.dbName,
        driver:  createDebug.logStorage.INDEXEDDB, storeName: "localLogs" });

    //Save dbName into indexedDB "DatabaseList"
    createDebug.dbStorage.getItem(env.sessionStorage.dbName).then(function(info) {
            if (info != null && info !== "[object Object]") { //Todo: figure out why info is [object Object], when dbName is not exisit.
                var infoJson = eval("(" + info + ")");
                if (infoJson.TS) {
                    infoJson.TS.push((new Date()).getTime());
                }
            } else {
                var infoJson = { TS: [ (new Date()).getTime() ], confID: env.sessionStorage.confID,
                    dbName: env.sessionStorage.dbName, userName: window.localStorage.userName, email: window.localStorage.email };
            }
            createDebug.updateDBInfo(sprintf("%j", infoJson));
        });


    if (!env.sessionStorage.dbIndex) {
        createDebug.logIndex = 0;
    } else {
        createDebug.logIndex = env.sessionStorage.dbIndex;
    }
    window.logIndex = createDebug.logIndex;


    /**
     * Active `debug` instances.
     */
    createDebug.instances = [ ];

    /**
     * The currently active debug mode names, and names to skip.
     */

    createDebug.names = [ ];
    createDebug.skips = [ ];

    /**
     * The currently state of Local Log.
     */
    createDebug.localLogState = true;

    /**
     * Map of special "%n" handling functions, for the debug "format" argument.
     *
     * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
     */

    createDebug.formatters = { };

    /**
     * Select a color.
     * @param {String} namespace
     * @return {Number}
     * @api private
     */

    function selectColor(namespace) {
        var hash = 0, i;

        for (i in namespace) {
            hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }

        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;

    /**
     * Select a background color.
     * @param {String} namespace
     * @return {Number}
     * @api private
     */

    function selectBGColor(namespace) {
        var hash = 0, i;

        var level = namespace.match(/:(\w+)/)[1];
        switch (level) {
        case 'DEBUG':
            i = 0;
            break;
        case 'LOG':
            i = 1;
            break;
        case 'INFO':
            i = 2;
            break;
        case 'WARN':
            i = 3;
            break;
        case 'ERROR':
            i = 4;
            break;
        case 'FATAL':
            i = 5;
            break;
        default:
            i = 2;
            break;
        }

        return createDebug.bgColors[i];
    }
    createDebug.selectBGColor = selectBGColor;

    /**
     * Create a debugger with the given `namespace`.
     *
     * @param {String} namespace
     * @return {Function}
     * @api public
     */

    function createDebug(namespace) {
        //var prevTime;

        function debug() {

            var date = new Date();
            // turn the `arguments` into a proper Array
            var args = new Array(arguments.length);
            for (var i = 0; i < args.length; i++) {
                args[i] = arguments[i];
            }

            args[0] = createDebug.coerce(args[0]);

            if ('string' !== typeof args[0]) {
                // anything else let's inspect with %O
                args.unshift('%O');
            }

            if (createDebug.localLogState === true) {
                //Save log into localforage whatever debug is disabled or not.
                var logTime = date.getFullYear() + "-" + (parseInt(date.getMonth()) + 1) + "-" + date.getDate() + "@" + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + "." + date.getMilliseconds();

                createDebug.keyBuffer.push(createDebug.logIndex + "-" + namespace)
                createDebug.logBuffer.push(createDebug.logIndex + "[" + logTime + "] " + namespace + ": " + argsToString(args));

                if (createDebug.keyBuffer.length >= 20) {
                    createDebug.logStorage.setItems(createDebug.keyBuffer.concat(), createDebug.logBuffer.concat()).then(function(value) {}).catch(function(err) {console.error(err);});
                    createDebug.keyBuffer = [ ];
                    createDebug.logBuffer = [ ];
                }
                createDebug.logIndex++;

                window.logIndex = createDebug.logIndex;
                window.sessionStorage.dbIndex = window.logIndex;
            }

            // disabled?
            if (!debug.enabled) return;

            var self = debug;

            // set `diff` timestamp
            //var curr = +date;
            //var ms = curr - (prevTime || curr);
            //self.diff = ms;
            //self.prev = prevTime;
            //self.curr = curr;
            //prevTime = curr;

            // apply any `formatters` transformations
            var index = 0;

            args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
                    // if we encounter an escaped % then don't increase the array index
                    if (match === '%%') return match;
                    index++;
                    var formatter = createDebug.formatters[format];
                    if ('function' === typeof formatter) {
                        var val = args[index];
                        match = formatter.call(self, val);

                        // now we need to remove `args[index]` since it's inlined in the `format`
                        args.splice(index, 1);
                        index--;
                    }
                    return match;
                });

            // apply env-specific formatting (colors, etc.)
            createDebug.formatArgs.call(self, args);

            var logFn = self.log || createDebug.log;
            logFn.apply(self, args);
        }

        debug.namespace = namespace;
        debug.enabled = createDebug.enabled(namespace);
        debug.useColors = createDebug.useColors();
        debug.color = selectColor(namespace);
        debug.bgColor = selectBGColor(namespace);
        debug.destroy = destroy;
        //debug.formatArgs = formatArgs;
        //debug.rawLog = rawLog;

        // env-specific initialization logic for debug instances
        if ('function' === typeof createDebug.init) {
            createDebug.init(debug);
        }

        createDebug.instances.push(debug);

        return debug;
    }

    function destroy() {
        var index = createDebug.instances.indexOf(this);
        if (index !== -1) {
            createDebug.instances.splice(index, 1);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Enables a debug mode by namespaces. This can include modes
     * separated by a colon and wildcards.
     *
     * @param {String} namespaces
     * @api public
     */

    function enable(namespaces) {
        createDebug.save(namespaces);

        createDebug.names = [ ];
        createDebug.skips = [ ];

        var i;
        var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
        var len = split.length;

        for (i = 0; i < len; i++) {
            if (!split[i]) continue; // ignore empty strings
            namespaces = split[i].replace(/\*/g, '.*?');
            if (namespaces[0] === '-') {
                createDebug.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
            } else {
                createDebug.names.push(new RegExp('^' + namespaces + '$'));
            }
        }

        for (i = 0; i < createDebug.instances.length; i++) {
            var instance = createDebug.instances[i];
            instance.enabled = createDebug.enabled(instance.namespace);
        }
    }

    /**
     * Disable debug output.
     *
     * @api public
     */

    function disable() {
        createDebug.enable('');
    }

    /**
     * Returns true if the given mode name is enabled, false otherwise.
     *
     * @param {String} name
     * @return {Boolean}
     * @api public
     */

    function enabled(name) {
        if (name[name.length - 1] === '*') {
            return true;
        }
        var i, len;
        for (i = 0, len = createDebug.skips.length; i < len; i++) {
            if (createDebug.skips[i].test(name)) {
                return false;
            }
        }
        for (i = 0, len = createDebug.names.length; i < len; i++) {
            if (createDebug.names[i].test(name)) {
                return true;
            }
        }
        return false;
    }

    /**
       * Enable LocalLog 
       *  
       * @api public
       */

    function enableLocalLog() {
        createDebug.saveLocalLogState(true);
        createDebug.localLogState = true;
    }

    /**
     * Disable LocalLog.
     *
     * @api public
     */

    function disableLocalLog() {
        createDebug.saveLocalLogState(false);
        createDebug.localLogState = false;
    }

    /**
     * Returns true if the LocalLog is enabled, false otherwise.
     *
     * @return {Boolean}
     * @api public
     */

    function enabledLocalLog() {
        return createDebug.localLogState;
    }

    /**
     * Get the local log 
     *
     * @param {String} filter  {String} dbName (null means current
     *        DB) {function} callback(logs)
     * @return {Array} logs window.logs =
     *         window.logs.filter(function(x){return (x !==
     *         (undefined || null || ''));});
     * @api public
     */

    function getLocalLogs(dbName, filter, callback) {

        function enabled(name, skips, names) {
            if (name[name.length - 1] === '*') {
                return true;
            }
            var i, len;

            for (i = 0, len = skips.length; i < len; i++) {
                if (skips[i].test(name)) {
                    return false;
                }
            }

            for (i = 0, len = names.length; i < len; i++) {
                if (names[i].test(name)) {
                    return true;
                }
            }
            return false;
        }

        var localLogs = new Array;
        skips = [ ];
        names = [ ];

        if (dbName && dbName != createDebug.sessionStorage.dbName) {
            var db = createDebug.logStorage.createInstance( { name: dbName, storeName: "localLogs" });
        } else {
            var db = createDebug.logStorage;
        }


        if (filter != '*') {
            //Process filter
            var i = 0;
            var split = (typeof filter === 'string' ? filter : '').split(/[\s,]+/);
            var len = split.length;

            for (i = 0; i < len; i++) {
                if (!split[i]) continue; // ignore empty strings
                filter = split[i].replace(/\*/g, '.*?');
                if (filter[0] === '-') {
                    skips.push(new RegExp('^' + filter.substr(1) + '$'));
                } else {
                    names.push(new RegExp('^' + filter + '$'));
                }
            }

            //Filter all keys
            db.keys().then(function(keys) {
                    for (var i = 0; i < keys.length; i++) {

                        //Remove the logIndex first "index-REALKEY"
                        var index = parseInt(keys[i]);
                        var key = keys[i].substr(index.toString().length + 1);

                        if (enabled(key, skips, names)) {
                            db.getItem(keys[i]).then(function(log) {
                                    var index = parseInt(log);
                                    localLogs[index] = '[' + index + ']' + log.substr(index.toString().length) + "\r\n";
                                }).catch(function(err) {})
                        }
                    }
                }).catch(function(err) {});

        } else {
            //Get all values
            db.getAllItems().then(function(logs) {
                    logs.forEach(function(log) {
                            var index = parseInt(log);
                            localLogs[index] = '[' + index + ']' + log.substr(index.toString().length) + "\r\n";
                        });

                    callback(localLogs);

                }).catch(function(err) {})
        }

        return;
    }

    /**
     * Get all Database name list 
     * @api public
     */

    function getLocalDBName(callback) {

        var localDBs = new Array;
        createDebug.dbStorage.getAllItems().then(function(infos) {
                infos.forEach(function(info) {
                        localDBs.push(JSON.parse(info));
                    })
                callback(localDBs);
            });

        return;
    }

    /**
     * Update the sipID and confSEQ in dbInformation in database 
     * "DatabaseList" . 
     * info should be { sipID: XXX, confSEQ: xxx, userName: aaa, 
     * email: bbb } 
     * 
     */
    function updateConfInfo(confInfo) {
        try {
            createDebug.dbStorage.getItem(createDebug.sessionStorage.dbName).then(function(info) {
                if (info != null && info !== "[object Object]") { //Todo: figure out why info is [object Object], when dbName is not exisit.
                    var infoJson = eval("(" + info + ")");

                    if (confInfo.sipID) {

                        if (!infoJson.sipID) {
                            infoJson.sipID = [ ];
                        }
                        infoJson.sipID.push(confInfo.sipID);
                    }

                    if (confInfo.confSEQ) {

                        if (!infoJson.confSEQ) {
                            infoJson.confSEQ = [ ];
                        }
                        infoJson.confSEQ.push(confInfo.confSEQ);
                    }

                    if (confInfo.userName) {
                        infoJson.userName = confInfo.userName;
                    }

                    if (confInfo.email) {
                        infoJson.email = confInfo.email;
                    }

                    infoJson.confID = createDebug.sessionStorage.confID;

                } else {
                    var infoJson = { TS: [ (new Date()).getTime() ], confID: createDebug.sessionStorage.confID,
                        dbName: createDebug.sessionStorage.dbName, userName: window.localStorage.userName, email: window.localStorage.email
                    };

                    if (confInfo.sipID) {
                        if (!infoJson.sipID) {
                            infoJson.sipID = [ ];
                        }
                        infoJson.sipID.push(confInfo.sipID);
                    }

                    if (confInfo.confSEQ) {

                        if (!infoJson.confSEQ) {
                            infoJson.confSEQ = [ ];
                        }
                        infoJson.confSEQ.push(confInfo.confSEQ);
                    }

                    if (confInfo.userName) {
                        infoJson.userName = confInfo.userName;
                    }

                    if (confInfo.email) {
                        infoJson.email = confInfo.email;
                    }

                }
                createDebug.updateDBInfo(sprintf("%j", infoJson));
            });
        } catch (e) {}
    }
    createDebug.updateConfInfo = updateConfInfo;

    /**
     * Flush buffer into DB
     * 
     */
    function flushLogBuffer() {
        try {
            if (createDebug.keyBuffer.length > 0) {
                createDebug.logStorage.setItems(createDebug.keyBuffer.concat(), createDebug.logBuffer.concat()).then(function(value) {}).catch(function(err) {console.error(err);});
                createDebug.keyBuffer = [ ];
                createDebug.logBuffer = [ ];
            }

        } catch (e) {}
    }
    createDebug.flushLogBuffer = flushLogBuffer;

    /**
     * Coerce `val`.
     *
     * @param {Mixed} val
     * @return {Mixed}
     * @api private
     */

    function coerce(val) {
        if (val instanceof Error) return val.stack || val.message;
        return val;
    }

    createDebug.enable(createDebug.load());

    createDebug.localLogState = createDebug.loadLocalLogState() === "false" ? false : true;

    return createDebug;
}
    