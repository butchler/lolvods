var http = require('http');

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
};
exports.html = html;

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
exports.get = function(object, keys, fallbackValue) {
    for (var i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        if (object !== null && typeof object === 'object' && object.hasOwnProperty(key))
            object = object[key];
        else
            return fallbackValue;
    }

    return object;
};

// Wrapper for http.get that gets all of the data from the response before
// calling the onSuccess function.
exports.getAll = function(url, onSuccess, onError, onSuccessOrError) {
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
};

function padZero(n) {
    return (n < 10 ? '0' : '') + n.toString();
};
exports.padZero = padZero;

// Takes a Date object and returns a string of the form 'yyyy-MM-dd hh:mm'.
exports.formatTime = function(date) {

    var yyyy = date.getFullYear().toString();
    // Months returned by Date.getMonth() start from zero.
    var MM = padZero(date.getMonth() + 1);
    var dd = padZero(date.getDate());
    // Date.getHours() also counts from zero.
    var hh = padZero(date.getHours() + 1);
    var mm = padZero(date.getMinutes());

    return yyyy + '-' + MM + '-' + dd + ' ' + hh + ':' + mm;
};

// Takes a number and converts it to a strong, adding a '0' the beginning if
// the number is less than 10.

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
};
exports.chain = chain;
