import * as fs from 'fs';
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import browserify = require('browserify');
import { minify } from 'uglify-js';

import { AppView } from '../shared/views';
import generateGameList from './generate-game-list';

main();

async function main() {
    //const games = await generateGameList();
    // TODO: Remove this.
    try {
        var games = JSON.parse(fs.readFileSync('data/games.json', 'utf8'));
    } catch (error) {
        console.error('Error reading games.json:', error);
        return;
    }

    // Write the game data to client/games.js, as if it were a source file in
    // the client code so that the data can be bundled together with the JavaScript.
    try {
        fs.writeFileSync(__dirname + '/../client/games.js', `module.exports = ${JSON.stringify(games)};`);
    } catch (error) {
        console.error('Error writing game list:', error);
        return;
    }

    try {
        var bundleJs = await createBundle(__dirname + '/../client/index.js');
    } catch (error) {
        console.error('Error creating browser bundle:', error);
        return;
    }

    try {
        fs.writeFileSync(__dirname + '/../../public/bundle.js', bundleJs);
    } catch (error) {
        console.error('Error writing browser bundle:', error);
        return;
    }

    // TODO: Maybe disable the options until the JavaScript has been loaded?
    const appHtml = ReactDOMServer.renderToString(<AppView games={games} />);

    try {
        var css = fs.readFileSync(__dirname + '/../../public/style.css', 'utf8');
    } catch (error) {
        console.error('Error reading CSS:', error);
        return;
    }

    const documentHtml =
       `<!doctype html>
        <html>
            <head>
                <title>Spoiler-free League of Legends VODs</title>

                <style>
                    ${css}
                </style>

                <!-- Defer the execution of the script so that it can be loaded
                    in the background while the rest of the page loads, but to only
                    run once the page has finished loading. -->
                <script defer src="bundle.js"></script>
            </head>
            <body>
                <div id="app-container">${appHtml}</div>
            </body>
        </html>`;

    // TODO: Minify HTML/CSS?

    console.log(documentHtml);

    try {
        fs.writeFileSync(__dirname + '/../../public/index.html', documentHtml);
    } catch (error) {
        console.error('Error writing index.html:', error);
        return;
    }
}

function createBundle(entry: string): Promise<string> {
    // Optimize/minify bundle.
    return new Promise((resolve, reject) => {
        browserify(entry).bundle((error, buffer) => {
            if (error) {
                reject(error);
            } else {
                const bundle = buffer.toString('utf8');

                // Minify the bundle with UglifyJS.
                try {
                    var minifiedBundle = minify(bundle, { fromString: true });
                } catch (error) {
                    reject(error);
                }

                resolve(minifiedBundle.code);
            }
        });
    });
}
