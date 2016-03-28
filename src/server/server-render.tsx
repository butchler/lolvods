import * as fs from 'fs';
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { minify } from 'html-minifier';

import * as util from './util';
import * as constants from '../shared/constants';
import { AppView } from '../shared/views';
import generateGameList from './generate-game-list';

main().then((renderedHtml) => {
    fs.writeFileSync(constants.OUTPUT_FILE, renderedHtml);

    if (util.numErrors > 0) {
        sendErrorReport(null);
    }
}).catch((error) => {
    sendErrorReport(error);

    throw error;
});

function sendErrorReport(error: Error | void): void {
    const logMessages = util.LOG.join("\n");

    if (error) {
        var errorReport =
`There was an unrecoverable error while rendering the app.

Stack trace:

${(error as Error).stack}

Log:

${logMessages}`;
    } else {
        var errorReport =
`There were ${util.numErrors} recoverable errors while rendering the app.

Log:

${logMessages}`;
    }

    // TODO: Send me an email when there is an error.
    console.log("\n" + errorReport);
}

// Generates the list of games using the lolesports unofficial API with
// generateGameList(), and then generates an index.html file that contains the
// rendered app using that game list. It also includes the CSS inline in the
// HTML and includes the game list as JSON data so that it can be referenced by
// the client side code to turn the server-rendered HTML into a live React
// application.
async function main(): Promise<string> {
    // For testing:
    //var games = JSON.parse(fs.readFileSync('data/games.json', 'utf8'));
    const games = await generateGameList();
    const appState = { games };

    // TODO: Maybe disable the options until the JavaScript has been loaded?
    util.log('Rendering app HTML.');
    const appHtml = ReactDOMServer.renderToString(<AppView {...appState} />);

    util.log('Loading CSS.');
    const css = fs.readFileSync(constants.CSS_FILE, 'utf8');

    const documentHtml =
`<!doctype html>
<html>
    <head>
        <title>Spoiler-free League of Legends VODs</title>

        <style>
            ${css}
        </style>

        <!-- Run the script asynchronously so that it can be downloaded
             in the background while the rest of the page loads. -->
        <script async src="bundle.js"></script>
    </head>
    <body>
        <div id="app-container">${appHtml}</div>

        <script>
            // Include the game data so that bundle.js can reference it.
            window['${constants.APP_STATE_VARIABLE}'] = ${JSON.stringify(appState)};
        </script>
    </body>
</html>`;

    // Minify HTML/CSS
    return minify(documentHtml, {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        minifyCSS: true,
        minifyJS: true
    });
}
