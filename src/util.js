"use strict";
const http = require('http');
function defer(deferredFunction) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            deferredFunction();
            resolve();
        }, 0);
    });
}
exports.defer = defer;
function delay(milliseconds) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, milliseconds);
    });
}
exports.delay = delay;
function forEach(object, callback) {
    for (const property in object) {
        if (object.hasOwnProperty(property)) {
            callback(object[property], property);
        }
    }
}
exports.forEach = forEach;
function forEachArray(array, callback) {
    const length = array.length;
    for (let i = 0; i < length; i++) {
        callback(array[i], i);
    }
}
exports.forEachArray = forEachArray;
function filterObject(object, filterCondition) {
    const filteredObject = {};
    forEach(object, (value, key) => {
        if (filterCondition(value, key)) {
            filteredObject[key] = value;
        }
    });
    return filteredObject;
}
exports.filterObject = filterObject;
/*export function filterMap<K, V>(map: Map<K, V>, filterCondition: (value: V, key: K) => boolean): Map<K, V> {
    const filteredMap = new Map<K, V>();

    map.forEach((value, key) => {
        if (filterCondition(value, key)) {
            filteredMap.set(key, value);
        }
    });

    return filteredMap;
}

export function mergeIntoMap<K, V>(into: Map<K, V>, from: Map<K, V>): void {
    from.forEach((value, key) => into.set(key, value));
}*/
/*export function stringifyWithMap(object: any): string {
    // Convert any ES6 maps into objects of the form:
    //
    // {
    //     __isES6Map: true,
    //     entries: [[key,value],[key,value],...]
    // }
    //
    // and then return JSON.stringify on that object.

    const serializeMaps = (object: any): any => {
        const serializedObject: any = {};

        for (const property in object) {
            if (object.hasOwnProperty(property)) {
                const value: any = object[property];

                if (value instanceof Map) {
                    // If it is an ES6 map, convert it to serializeable format.
                    serializedObject[property] = {
                        __isES6Map: true,
                        entries: [...value]
                    };
                } else if (value !== null && typeof value === 'object') {
                    // If it's an object, recur and serialize any child
                    // properties that are ES6 maps.
                    serializedObject[property] = serializeMaps(value);
                } else {
                    // If it's a primitive, just copy it over.
                    serializedObject[property] = value;
                }
            }
        }

        return serializedObject;
    };

    return JSON.stringify(serializeMaps(object));
}

export function mapToJson(map: Map<any, any>): string {
    // Converts the map to an array of [key,value] pairs.
    // See http://www.2ality.com/2015/08/es6-map-json.html
    return JSON.stringify([...map]);
}

export function jsonToMap(json: string): Map<any, any> {
    return new Map<any, any>(JSON.parse(json));
}*/
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        console.log(`Fetching URL "${url}"...`);
        http.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP response returned status code ${response.statusCode} instead of 200 for URL "${url}".`));
                return;
            }
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                console.log(`Finished fetching URL "${url}"`);
                resolve(data);
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}
exports.fetchUrl = fetchUrl;
function createBottleneck(numSimultaneous) {
    const callbacks = new Array();
    let numRunning = 0;
    const onDone = () => {
        numRunning -= 1;
        if (numRunning < numSimultaneous && callbacks.length > 0) {
            const callback = callbacks.pop();
            numRunning += 1;
            callback(onDone);
        }
    };
    return function (callback) {
        if (numRunning === numSimultaneous) {
            callbacks.push(callback);
        }
        else {
            numRunning += 1;
            callback(onDone);
        }
    };
}
exports.createBottleneck = createBottleneck;
