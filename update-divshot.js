var fs = require('fs');
var http = require('http');
var push = require('divshot-push');

// Use the (not yet released) League API to fetch infor for all the games from
// the past two weeks, and generate a web page showing a list of the games and
// links to their videos. Then, upload the web page to Divshot in order to
// serve it statically and efficiently.

if (!process.env.DIVSHOT_TOKEN)
    throw new Error('DIVSHOT_TOKEN environment variable is not set.');

// Subtract the number of milliseconds in two weeks from the current date.
var now = new Date();
var twoWeeksAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7 * 2);
chain([
        [getProgrammingBlocks, twoWeeksAgo, now],
        getGameIds,
        getGameInfos,
        generateHtml,
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
                                if (parseInt(id, 10) != NaN) {
                                    var game = {id: id, matchTime: null};

                                    // Also save the datetime of the match,
                                    // since the datetime that the API reports
                                    // for individual games is sometimes null,
                                    // so we can't use it for sorting the games.
                                    if (Date.parse(match.dateTime) != NaN)
                                        game.matchTime = match.dateTime;

                                    gameIds.push(game);
                                }
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
            setTimeout(function () { getInfo(gameId); }, 10);
            return;
        }

        numRequests += 1;

        var apiUrl = 'http://na.lolesports.com/api/game/' + gameId.id + '.json';

        getAll(apiUrl,
                // On success
                function (data) {
                    console.log('getGameInfos() received: ' + data);

                    var gameInfo = JSON.parse(data);
                    gameInfo.matchTime = gameId.matchTime;

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

function generateHtml(games, callback) {
    // Sort games based on the match time, as opposed to the individual game
    // time, because the API sometimes returns null or wrong datetimes for game
    // info.
    games.sort(function (a, b) {
        var aTime = Date.parse(a.matchTime), bTime = Date.parse(b.matchTime);

        if (aTime != NaN && bTime != NaN)
            // Sort in descending order based on match time.
            return bTime - aTime;
        else
            return 0;
    });

    fs.readFile('./icons.svg', function (error, data) {
        if (error)
            throw new Error('Error reading SVG icons file: ' + error);

        var iconDefinitions = data.toString();

        var output = 
            '<!doctype html>' +
            html(['html',
                    ['head',
                        ['title', 'Semi-spoiler free League VODs'],
                        ['link', {href: 'style.css', rel: 'stylesheet'}]],
                        "<link href='http://fonts.googleapis.com/css?family=Open+Sans:400,700,300' rel='stylesheet' type='text/css'>",
                    ['body',
                        iconDefinitions,
                        ['header',
                            ['h1.title', 'Semi-spoiler free League of Legends VODs']],
                        ['main',
                            ['ul.games', games.map(generateGameHtml)]],
                        ['footer',
                            '<div>Icons made by <a href="http://www.flaticon.com/authors/freepik" title="Freepik">Freepik</a> from <a href="http://www.flaticon.com" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0">CC BY 3.0</a></div>',
                            '<div>Icons made by <a href="http://www.flaticon.com/authors/simpleicon" title="SimpleIcon">SimpleIcon</a> from <a href="http://www.flaticon.com" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0">CC BY 3.0</a></div>']]]);

        callback(output);
    });
}

function generateGameHtml(game) {
    // If the game doesn't have a video URL yet, don't list it.
    if (get(game, ['vods', 'vod', 'URL']) === undefined)
        return [];

    // Call decodeURIComponent on the URL to unescape any URL parameters, such
    // as time offset parameters for YouTube links.
    var vodUrl = decodeURIComponent(get(game, ['vods', 'vod', 'URL'], '#'));

    // Calculate teams' total gold and kills from individual players' info.
    var blueTeamKills = redTeamKills = blueTeamGold = redTeamGold = 0;
    var blueTeamId = get(game, ['contestants', 'blue', 'id'], 0).toString();
    var redTeamId = get(game, ['contestants', 'red', 'id'], 0).toString();
    if (game.players) {
        for (key in game.players) {
            if (game.players.hasOwnProperty(key)) {
                var player = game.players[key];

                if (player.teamId && player.teamId.toString() === blueTeamId) {
                    blueTeamKills += player.kills;
                    blueTeamGold += player.totalGold;
                }
                if (player.teamId && player.teamId.toString() === redTeamId) {
                    redTeamKills += player.kills;
                    redTeamGold += player.totalGold;
                }
            }
        }
    }

    // Convert game length to mm:ss format.
    var gameLength = null;
    if (game.gameLength) {
        var minutes = Math.floor(game.gameLength / 60);
        var seconds = game.gameLength % 60;
        gameLength = padZero(minutes) + ':' + padZero(seconds);
    }

    // Format gold as a string.
    blueTeamGoldString = (blueTeamGold / 1000).toFixed(1) + 'k';
    redTeamGoldString = (redTeamGold / 1000).toFixed(1) + 'k';

    // Get the logo URL from the game info, but rewrite the URL to point to a smaller version of the logo.
    // TODO: Get the small logo URL from the match info instead of hackily rewriting the URL.
    blueTeamLogo = get(game, ['contestants', 'blue', 'logoURL'], '').replace('s3fs-public/', 's3fs-public/styles/grid_medium_square/public/');
    redTeamLogo = get(game, ['contestants', 'red', 'logoURL'], '').replace('s3fs-public/', 's3fs-public/styles/grid_medium_square/public/');

    hasMultipleGames = game.maxGames && parseInt(game.maxGames, 10) > 1;

    return ['a.vod', {href: vodUrl},
               ['li.game',
                    !game.contestants ? null :
                    ['div.teams',
                        ['span.team',
                            blueTeamLogo ? ['img.team-logo', {src: blueTeamLogo}] : null,
                            ['span.team-name', get(game, ['contestants', 'blue', 'name'], 'Blue')]],
                        ['span.vs', ' vs. '],
                        ['span.team',
                            redTeamLogo ? ['img.team-logo', {src: redTeamLogo}] : null,
                            ['span.team-name', get(game, ['contestants', 'red', 'name'], 'Red')]]],
                    (hasMultipleGames && game.gameNumber) ? ['div.game-number', 'Game ' + game.gameNumber] : null,
                    gameLength === null ? null :
                    ['div.game-length', gameLength],
                    (blueTeamKills === 0 && redTeamKills === 0) ? null :
                    ['div.kills',
                        ['span.kill-score', blueTeamKills],
                        // Show "vs." instead of the icon for browsers that don't support SVG.
                        ['svg', {class: 'icon kill-icon'}, '<use xlink:href="#sword"> vs. </use>'],
                        ['span.kill-score', redTeamKills]],
                    (blueTeamGold === 0 && redTeamGold === 0) ? null :
                    ['div.gold',
                        ['span.gold-score', blueTeamGoldString],
                        ['svg', {class: 'icon gold-icon'}, '<use xlink:href="#coins"> vs. </use>'],
                        ['span.gold-score', redTeamGoldString]]]];
}

// Used to access nested properties of an object when you're not sure if the
// object actually has those properties. Returns fallbackValue if the object
// doesn't have the nested property.
//
// get(object, ['foo', 'bar'], 'Could not find foo bar')
//
// is equivalent to
//
// (function () {
//     if (object.hasOwnProperty('foo')) {
//         if (object.foo.hasOwnProperty('bar')) {
//             return object.foo.bar;
//         }
//     }
//
//     return 'Could not find foo bar';
// })
function get(object, keys, fallbackValue) {
    for (var i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        if (object !== null && typeof object === 'object' && object.hasOwnProperty(key))
            object = object[key];
        else
            return fallbackValue;
    }

    return object;
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
    if (tags.length === 0)
        return '';

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

        if (element === undefined)
            throw new Error('Elements passed to html() cannot be undefined: ' + JSON.stringify(tags));

        if (element === null)
            continue;
        else if (Array.isArray(element))
            output += html(element);
        else {
            output += element.toString();
        }
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
