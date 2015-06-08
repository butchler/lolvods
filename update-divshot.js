var fs = require('fs');
var push = require('divshot-push');

if (!process.env.DIVSHOT_TOKEN)
    throw new Error('DIVSHOT_TOKEN environment variable is not set.');

// Create index.html
var time = (new Date()).toString();
var output = '<h2>Updated on ' + time + '</h2>';

fs.writeFile('./app/index.html', output, function (error) {
    if (error) {
        console.log('Error creating index.html');
        throw error;
    }

    console.log('index.html created.');

    // Push index.html to Divshot.
    var pushStatus = push({
        root: process.cwd() + '/app',
        environment: 'development',
        config: { name: 'lolvods', 'clean_urls': true },
        token: process.env.DIVSHOT_TOKEN
    });

    pushStatus.onUpload('start', function () {
        console.log('Uploading index.html to Divshot.');
    });
    pushStatus.onUpload('end', function () {
        console.log('Upload complete.');
    });

    var onError = function (error) {
        console.log('Error uploading index.html to Divshot.');
        throw error;
    };
    pushStatus.onUpload('error', onError);
    pushStatus.onError(onError);
});
