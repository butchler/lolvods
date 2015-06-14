var fs = require('fs');
var http = require('http');
var push = require('divshot-push');
var util = require('./util.js');

// Use the (not yet released) League API to fetch infor for all the games from
// the past two weeks, and generate a web page showing a list of the games and
// links to their videos. Then, upload the web page to Divshot in order to
// serve it statically and efficiently.

if (!process.env.DIVSHOT_TOKEN)
    throw new Error('DIVSHOT_TOKEN environment variable is not set.');

// Subtract the number of milliseconds in two weeks from the current date.
var now = new Date();
var twoWeeksAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7 * 2);
util.chain([
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
        '&parameters[time]=' + util.formatTime(fromTime) +
        '&parameters[timeTo]=' + util.formatTime(toTime);

    util.getAll(apiUrl,
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

        util.getAll(apiUrl,
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
            util.html(['html',
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
    if (util.get(game, ['vods', 'vod', 'URL']) === undefined)
        return [];

    // Call decodeURIComponent on the URL to unescape any URL parameters, such
    // as time offset parameters for YouTube links.
    var vodUrl = decodeURIComponent(util.get(game, ['vods', 'vod', 'URL'], '#'));

    // Calculate teams' total gold and kills from individual players' info.
    var blueTeamKills = redTeamKills = blueTeamGold = redTeamGold = 0;
    var blueTeamId = util.get(game, ['contestants', 'blue', 'id'], 0).toString();
    var redTeamId = util.get(game, ['contestants', 'red', 'id'], 0).toString();
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
        gameLength = util.padZero(minutes) + ':' + util.padZero(seconds);
    }

    // Format gold as a string.
    blueTeamGoldString = (blueTeamGold / 1000).toFixed(1) + 'k';
    redTeamGoldString = (redTeamGold / 1000).toFixed(1) + 'k';

    // Get the logo URL from the game info, but rewrite the URL to point to a smaller version of the logo.
    // TODO: Get the small logo URL from the match info instead of hackily rewriting the URL.
    blueTeamLogo = util.get(game, ['contestants', 'blue', 'logoURL'], '').replace('s3fs-public/', 's3fs-public/styles/grid_medium_square/public/');
    redTeamLogo = util.get(game, ['contestants', 'red', 'logoURL'], '').replace('s3fs-public/', 's3fs-public/styles/grid_medium_square/public/');

    hasMultipleGames = game.maxGames && parseInt(game.maxGames, 10) > 1;

    return ['a.vod', {href: vodUrl},
               ['li.game',
                    !game.contestants ? null :
                    ['div.teams',
                        ['span.team',
                            blueTeamLogo ? ['img.team-logo', {src: blueTeamLogo}] : null,
                            ['span.team-name', util.get(game, ['contestants', 'blue', 'name'], 'Blue')]],
                        ['span.vs', ' vs. '],
                        ['span.team',
                            redTeamLogo ? ['img.team-logo', {src: redTeamLogo}] : null,
                            ['span.team-name', util.get(game, ['contestants', 'red', 'name'], 'Red')]]],
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

function writeToFile (filename, data, doneCallback) {
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
