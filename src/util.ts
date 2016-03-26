import * as http from 'http';
import { Dict } from './interfaces';

export function defer(deferredFunction: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            deferredFunction();
            resolve();
        }, 0);
    });
}

export function delay(milliseconds: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(resolve, milliseconds);
    });
}

export function forEach<V>(object: Dict<V>, callback: (value: V, key: string) => void): void {
    for (const property in object) {
        if (object.hasOwnProperty(property)) {
            callback(object[property], property);
        }
    }
}

export function forEachArray<V>(array: Array<V>, callback: (value: V, index: number) => void): void {
    const length = array.length;

    for (let i = 0; i < length; i++) {
        callback(array[i], i);
    }
}

export function filterObject<V>(object: Dict<V>, filterCondition: (value: V, key: string) => boolean): Dict<V> {
    const filteredObject = {} as Dict<V>;

    forEach(object, (value, key) => {
        if (filterCondition(value, key)) {
            filteredObject[key] = value;
        }
    });

    return filteredObject;
}

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

export function fetchUrl(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        console.log(`Fetching URL "${url}"...`);

        http.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP response returned status code ${response.statusCode} instead of 200 for URL "${url}".`));
                return;
            }

            let data = '';
            response.on('data', (chunk: string) => {
                data += chunk;
            });
            response.on('end', () => {
                console.log(`Finished fetching URL "${url}"`);
                resolve(data);
            });
        }).on('error', (error: Error) => {
            reject(error);
        });
    });
}

// TODO: Implement using async/await.
interface BottleneckCallback {
    (done: () => void): void;
}
export function createBottleneck(numSimultaneous: number): (callback: BottleneckCallback) => void {
    const callbacks = new Array<BottleneckCallback>();
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
        } else {
            numRunning += 1;

            callback(onDone);
        }
    }
}
