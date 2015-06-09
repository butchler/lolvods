var fs = require('fs');
var http = require('http');
var push = require('divshot-push');

if (!process.env.DIVSHOT_TOKEN)
    throw new Error('DIVSHOT_TOKEN environment variable is not set.');

var now = new Date();
// Subtract the number of milliseconds in two weeks from the current date.
//var twoWeeksAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7 * 2);
var twoWeeksAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2);

// Use the (not yet released) League API to fetch infor for all the games from
// the past two weeks, and generate a web page showing a list of the games and
// links to their videos.
chain([
        [getProgrammingBlocks, twoWeeksAgo, now],
        getGameIds,
        getGameInfos,
        generateHTML,
        [writeToFile, './app/index.html'],
        //[pushToDivshot, process.cwd() + '/app']
]);

function getProgrammingBlocks(fromTime, toTime, callback) {
    var apiUrl = 'http://na.lolesports.com/api/programming.json?' +
        'parameters[method]=time&parameters[expand_matches]=1' +
        '&parameters[time]=' + formatTime(fromTime) +
        '&parameters[timeTo]=' + formatTime(toTime);

    getAll(apiUrl,
            function (data) {
                console.log('getProgrammingBlocks() received: ' + data);

                var programmingBlocks = JSON.parse(data);
                callback(programmingBlocks);
            },
            function (error) {
                throw new Error('Error during API request: ' + error.message);
            });
}

// Extract all of the game IDs from the list of programming blocks returned by
// the API.
function getGameIds(programmingBlocks) {
    var gameIds = [];

    if (Array.isArray(programmingBlocks)) {
        programmingBlocks.forEach(function (block) {
            if (block.hasOwnProperty('matches') && Array.isArray(block.matches)) {
                block.matches.forEach(function (match) {
                    if (match.hasOwnProperty('gamesInfo')) {
                        var games = match.gamesInfo;
                        for (key in games) {
                            if (games.hasOwnProperty(key) &&
                                    games[key].hasOwnProperty('id')) {
                                var id = games[key].id;
                                // Verify that the ID is a number.
                                if (parseInt(id, 10) != NaN)
                                    gameIds.push(id);
                            }
                        }
                    }
                });
            }
        });
    }

    if (gameIds.length === 0)
        throw new Error('getGameIds() could not find any game IDs.');

    console.log('getGameIds() returned ' + JSON.stringify(gameIds));

    return gameIds;
}

function getGameInfos(gameIds, callback) {
    var gameInfos = [];

    // Make sure we aren't making too many simultaneous requests to the League API.
    var numRequests = 0;
    var maxRequests = 2;
    var requestsLeft = gameIds.length;

    function getInfo(gameId) {
        // If there are too many simultaneous requests, try again after a delay.
        if (numRequests >= maxRequests) {
            setTimeout(function () { getInfo(gameId); }, 100);
            return;
        }

        numRequests += 1;

        var apiUrl = 'http://na.lolesports.com/api/game/' + gameId + '.json';

        getAll(apiUrl,
                // On success
                function (data) {
                    console.log('getGameInfos() received: ' + data);

                    var gameInfo = JSON.parse(data);

                    gameInfos.push(gameInfo);
                },
                // On error
                function (error) {
                    throw new Error('Error getting game info from API: ' + error);
                },
                // After success or error
                function () {
                    numRequests -= 1;
                    requestsLeft -= 1;
                    if (requestsLeft === 0)
                        callback(gameInfos);
                });
    }

    gameIds.forEach(getInfo);
}

// Wrapper for http.get that gets all of the data from the response before
// calling the onSuccess function.
function getAll(url, onSuccess, onError, onSuccessOrError) {
    console.log("Getting URL '" + url + "'.");

    http.get(url, function (response) {
        if (response.statusCode !== 200)
            throw new Error('HTTP response returned status code ' +
                    response.statusCode + ' instead of 200.');

        var data = '';
        response.on('data', function (chunk) {
            data += chunk;
        });
        response.on('end', function () {
            if (onSuccess !== undefined)
                onSuccess(data);
            if (onSuccessOrError !== undefined)
                onSuccessOrError('success', data);
        });
    }).on('error', function (error) {
        if (onError !== undefined)
            onError(error);
        if (onSuccessOrError !== undefined)
            onSuccessOrError('error', error);
    });
}

function generateHTML(games) {
    // TODO: Sort games newest to oldest.
    // Cannot use game.dateTime because it seems to have the same time for all
    // games in the same block. Probably have to get the time from the match
    // info.

    var body =
['body',
    ['h1.title', 'Semi-spoiler free League of Legends VODs'],
    ['ul.games',
        games.map(function (game) {
            // Calculate teams' total gold and kills from individual players' info.
            var blueTeamKills = redTeamKills = blueTeamGold = redTeamGold = 0;
            var blueTeamId = game.contestants.blue.id.toString();
            var redTeamId = game.contestants.red.id.toString();
            for (key in game.players) {
                if (game.players.hasOwnProperty(key)) {
                    var player = game.players[key];

                    if (player.teamId.toString() === blueTeamId) {
                        blueTeamKills += player.kills;
                        blueTeamGold += player.totalGold;
                    }
                    if (player.teamId.toString() === redTeamId) {
                        redTeamKills += player.kills;
                        redTeamGold += player.totalGold;
                    }
                }
            }

            // Convert game length to mm:ss format.
            var minutes = Math.floor(game.gameLength / 60);
            var seconds = game.gameLength % 60;
            var gameLength = padZero(minutes) + ':' + padZero(seconds);

            // Format gold as a string.
            blueTeamGoldString = (blueTeamGold / 1000).toFixed(1) + 'k';
            redTeamGoldString = (redTeamGold / 1000).toFixed(1) + 'k';

            return ['a', {href: game.vods.vod.URL},
                        ['li.game',
                            ['div.teams',
                                ['span.team-name', game.contestants.blue.name],
                                ['span.vs-icon', ' vs. '],
                                ['span.team-name', game.contestants.red.name]],
                            ['div.game-length', gameLength],
                            ['div.kills',
                                ['span.kill-score', blueTeamKills],
                                ['span.kill-icon', ' vs. '],
                                ['span.kill-score', redTeamKills]],
                            ['div.gold',
                                ['span.gold-score', blueTeamGoldString],
                                ['span.gold-icon', ' vs. '],
                                ['span.gold-score', redTeamGoldString]]]];
        })]];

    return '<!doctype html>' +
        html(['html',
                ['head',
                    ['title', 'Semi-spoiler free League VODs']],
                body]);
}

// Recursively generates HTML given an array of tag names, attributes, and
// contents.
//
// html(['p' 'Hello, world ' ['a' {href: 'http://example.com/'} "Here's a link!"])
//
// returns
//
// '<p>Hello, world <a href="http://example.com">Here's a link!</a></p>'
function html(tags) {
    if (tags.length < 1)
        throw new Error('The array passed to html() must have at least one ' +
                'element (the tag name): ' + JSON.stringify(tags));

    // If the argument is a list of arrays, apply html() to each array in the
    // list and return the concatenated output.
    if (tags.every(Array.isArray)) {
        return String.prototype.concat.apply('', tags.map(html));
    }

    var tag = tags[0];
    if (typeof tag !== 'string')
        throw new Error('First element in array for html() must be a string or array: ' + JSON.stringify(tags));

    // Check if there is an attributes object.
    var attributes = null;
    var hasAttributes = false;
    if (tags.length >= 1 && typeof tags[1] === 'object' && !Array.isArray(tags[1])) {
        attributes = tags[1];
        hasAttributes = true;
    }

    // If tag name contains a period, make everything after the period the
    // class name.
    var classMatch = /\.(.*)/.exec(tag);
    if (classMatch !== null) {
        var className = classMatch[1];
        attributes = attributes || {};
        attributes.class = className;

        // Remove the class name from the tag.
        tag = tag.replace(/\..*/, '');
    }

    var output = '<' + tag;
    if (attributes !== null) {
        // TODO: Validate attributes.
        for (key in attributes) {
            if (attributes.hasOwnProperty(key)) {
                // Escape any quotation marks in the value string
                var value = attributes[key].replace(/"/, '\\"');
                output += ' ' + key + '="' + value + '"';
            }
        }
    }
    output += '>';

    // TODO: Insert new lines and spaces to make the output readable.
    for (var i = hasAttributes ? 2 : 1; i < tags.length; i += 1) {
        var element = tags[i];

        if (Array.isArray(element))
            output += html(element);
        else
            output += element.toString();
    }

    output += '</' + tag + '>';

    return output;
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

    var yyyy = date.getFullYear().toString();
    // Months returned by Date.getMonth() start from zero.
    var MM = padZero(date.getMonth() + 1);
    var dd = padZero(date.getDate());
    // Date.getHours() also counts from zero.
    var hh = padZero(date.getHours() + 1);
    var mm = padZero(date.getMinutes());

    return yyyy + '-' + MM + '-' + dd + ' ' + hh + ':' + mm;
}

// Takes a number and converts it to a strong, adding a '0' the beginning if
// the number is less than 10.
function padZero(n) {
    return (n < 10 ? '0' : '') + n.toString();
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
