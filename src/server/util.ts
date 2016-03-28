import * as http from 'http';
import * as https from 'https';
import { Dict } from '../shared/interfaces';

// Generator function that iterates over all of the own properties of
// the given object.
//
// Can be used with a for..of loop like so:
//
// for (let entry of util.entries(object)) {
//     const value = entry[0], key = entry[1];
//     // Do something with key/value.
// }
//
// However, if you pass it an iterable object, like an Array, it will just
// iterate over the iterable, allowing you to iterate over arrays and objects
// in the same way. Think of it as underscore/lodash's forEach function, but
// using for..of instead of a callback function.
export function entries(object: Dict<any>): IterableIterator<[any, string]>;
export function entries(object: Iterable<any>): IterableIterator<[any, number]>;
export function *entries(object: Dict<any> | Iterable<any>): IterableIterator<[any, string | number]> {
    if (isIterable(object)) {
        // If it is iterable, just iterate over it using a for..of loop.
        let index = 0;
        for (let value of object as Iterable<any>) {
            yield [value, index];
            index += 1;
        }
    } else {
        // If it is a dictionary, iterate over all of its own properties.
        const dict = object as Dict<any>;
        for (const property in dict) {
            if (dict.hasOwnProperty(property)) {
                yield [dict[property], property];
            }
        }
    }
}

export function isIterable(object: any | Iterable<any>): boolean {
    return object !== null && object !== undefined && typeof object[Symbol.iterator] === 'function';
}

// Same as entries, but just returns the value instead of a [value, key] pair:
//
// for (let value of util.values(object)) {
//     // Do something with value.
// }
export function *values(object: Dict<any> | Iterable<any>): IterableIterator<any> {
    for (let entry of entries(object)) {
        yield entry[0];
    }
}

export function filterObject(object: Dict<any>, filterCondition: (value: any, key: string) => boolean): Dict<any> {
    const filteredObject: Dict<any> = {};

    for (let entry of entries(object)) {
        const value = entry[0], key = entry[1];
        if (filterCondition(value, key)) {
            filteredObject[key] = value;
        }
    }

    return filteredObject;
}

export function fetchUrl(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        log(`Fetching URL "${url}"...`);

        const protocol = url.startsWith('https:') ? https : http;

        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP response returned status code ${response.statusCode} instead of 200 for URL "${url}".`));
                return;
            }

            let data = '';
            response.on('data', (chunk: string) => {
                data += chunk;
            });
            response.on('end', () => {
                log(`Finished fetching URL "${url}"`);
                resolve(data);
            });
        }).on('error', (error: Error) => {
            reject(error);
        });
    });
}

// Replacement for console.log that allows us to get a list of log messages so
// that we can send it along with an error message for debugging.
export const LOG = new Array<string>();
export function log(message: string) {
    LOG.push(message);
    process.stdout.write(message + "\n");
}

export var numErrors = 0;
export function error(message: string) {
    numErrors += 1;
    LOG.push(`(Error) ${message}`);
    process.stderr.write(message + "\n");
}
