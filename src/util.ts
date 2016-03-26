import * as http from 'http';
import { Dict } from './interfaces';

export function forEach(object: Array<any>, callback: (value: any, index: number) => void): void;
export function forEach(object: Dict<any>, callback: (value: any, key?: string) => void): void;
export function forEach(object: Array<any> | Dict<any>, callback: (value: any, key?: string | number) => void): void {
    if (Array.isArray(object)) {
        const length = object.length;

        for (let i = 0; i < length; i++) {
            callback(object[i], i);
        }
    } else {
        for (const property in object) {
            if (object.hasOwnProperty(property)) {
                callback(object[property], property);
            }
        }
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
