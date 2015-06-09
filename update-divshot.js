var fs = require('fs');
var http = require('http');
var push = require('divshot-push');

if (!process.env.DIVSHOT_TOKEN)
    throw new Error('DIVSHOT_TOKEN environment variable is not set.');

var now = new Date();
// Subtract the number of milliseconds in two weeks from the current date.
var twoWeeksAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7 * 2);



chain(getProgrammingBlocks, twoWeeksAgo, now)
    .and(getMatchIDs)
    .and(getGames)
    .and(generateHTML)
    .and(writeToFile, './app/index.html');
//    .and(pushToDivshot, process.cwd() + '/app');

function getProgrammingBlocks(fromTime, toTime, callback) {
    var apiUrl = 'http://na.lolesports.com/api/programming.json?' +
        'parameters[method]=time&parameters[expand_matches]=1' +
        '&parameters[time]=' + formatTime(fromTime) +
        '&parameters[timeTo]=' + formatTime(toTime);

    http.get(apiUrl, function (response) {
        if (response.statusCode !== 200)
            throw new Error('API response returned status code ' + response.statusCode + ' instead of 200.');

        var data = '';
        response.on('data', function (chunk) {
            data += chunk;
        });
        response.on('end', function () {
            var programmingBlocks = JSON.parse(data);
            callback(programmingBlocks);
        });
    }).on('error', function (error) {
        throw new Error('Error during API request: ' + error.message);
    });
}

function getMatchIDs(programmingBlocks) {
    // TODO
    return programmingBlocks;
}

function getGames(matchIDs, callback) {
    // TODO
    callback(matchIDs);
}

function generateHTML(games) {
    // TODO
    return games;
}

function writeToFile(filename, data, doneCallback) {
    fs.writeFile(filename, data, function (error) {
        if (error) {
            console.log("Error creating '" + filename + "'.");
            throw error;
        }

        console.log("'" + filename + "' created.");

        doneCallback();
    });
}

function pushToDivshot(root, doneCallback) {
    // Push generated index.html to Divshot.
    var pushStatus = push({
        root: root,
        environment: 'development',
        config: { name: 'lolvods', 'clean_urls': true },
        token: process.env.DIVSHOT_TOKEN
    });

    pushStatus.onUpload('start', function () {
        console.log('Uploading to Divshot.');
    });
    pushStatus.onUpload('end', function () {
        console.log('Upload complete.');
        doneCallback();
    });

    var onError = function (error) {
        console.log('Error uploading to Divshot.');
        throw error;
    };
    pushStatus.onUpload('error', onError);
    pushStatus.onError(onError);
}

// Takes a Date object and returns a string of the form 'yyyy-MM-dd hh:mm'.
function formatTime(date) {
    var padZero = function(n) { return (n < 10 ? '0' : '') + n.toString(); }

    var yyyy = date.getFullYear().toString();
    // Months returned by Date.getMonth() start from zero.
    var MM = padZero(date.getMonth() + 1);
    var dd = padZero(date.getDate());
    // Date.getHours() also counts from zero.
    var hh = padZero(date.getHours() + 1);
    var mm = padZero(date.getMinutes());

    return yyyy + '-' + MM + '-' + dd + ' ' + hh + ':' + mm;
}

function chain() {
    if (arguments.length < 1)
        throw new Error('chain() requires at least one argument (the function to call).');

    // The first argument is the function to call.
    var f = arguments[0];

    if (typeof f !== 'function')
        throw new Error('The first argument to chain()/and() must be a function.');

    var andArguments = null;
    var returnCallback = function (result) {
        // If and() was called, call the next function in the chain, passing
        // along the result as the last argument before the callback argument.
        if (andArguments !== null) {
            var args = argumentsToArray(andArguments);
            args.push(result);
            chain.apply(null, args);
        }
    };

    // Add the callback function as the last argument and call the function.
    var args = argumentsToArray(arguments).slice(1);
    args.push(returnCallback);
    console.log('chain() args for ' + f.name + ': ' + args);
    var result = f.apply(null, args);

    // If the function returns a result, just call the next function in the
    // chain immediately.
    if (result !== undefined)
        return {
            and: function () {
                andArguments = arguments;
                returnCallback(result);
                // FIXME: Needs to return something
            }
        };
    // Otherwise, save the next function in the chain so that we can call it
    // when the returnCallback is called.
    else
        return {
            and: function () {
                // Save all of the arguments passed to and (the first argument
                // is the function, followed by arguments to the function).
                andArguments = arguments;
                // FIXME: Needs to return something
            }
        };
}

// Converts an arguments object into an array.
// According to MDN (https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Functions/arguments),
// using Array.slice on arguments prevents browser optimizations, so use a
// loop to create a new array instead.
function argumentsToArray(args) {
    var array = [];
    for (var i = 0; i < args.length; i += 1)
        array.push(args[i]);
    return array;
}
