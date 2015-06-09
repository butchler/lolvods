var fs = require('fs');
var http = require('http');
var push = require('divshot-push');

if (!process.env.DIVSHOT_TOKEN)
    throw new Error('DIVSHOT_TOKEN environment variable is not set.');

var now = new Date();
// Subtract the number of milliseconds in two weeks from the current date.
var twoWeeksAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7 * 2);


chain([
        [getProgrammingBlocks, twoWeeksAgo, now],
        getMatchIDs,
        getGames,
        generateHTML,
        [writeToFile, './app/index.html']
]);

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

}

// Takes an array of functions (or an array with a function as the first
// argument and a list of arguments to that function), and calls the functions
// using callbacks, so that they can easily be chained together even if they
// don't return their results immediately.
//
// chain([a, [b, 1, 2, 3], c])
//
// is equivalent to
//
// a(function (result) {
//     b(1, 2, 3, result, function (result) {
//         c(result);
//     });
// });
function chain(functions, result, index) {
    // Validate index.
    if (typeof index === 'undefined')
        index = 0;
    if (typeof index !== 'number')
        throw new Error('Bad index for chain(). ' +
                'Only one argument should be passed to chain().');

    // Stop when we've reached the end of the function list.
    if (index >= functions.length)
        return;

    var f = functions[index];
    var args = [];

    if (Array.isArray(f)) {
        args = f.slice(1);
        f = f[0];
    }

    if (typeof f !== 'function')
        throw new Error('Arguments in array passed to chain() must be ' +
                'functions, or arrays with a function as the first element.');

    if (result !== undefined)
        args.push(result);

    var onResult = function (nextResult) {
        chain(functions, nextResult, index + 1);
    };
    args.push(onResult);

    var nextResult = f.apply(null, args);

    // If the function returns a result immediately instead of using the
    // callback, call the next function in the chain immediately.
    if (nextResult !== undefined)
        chain(functions, nextResult, index + 1);
}
