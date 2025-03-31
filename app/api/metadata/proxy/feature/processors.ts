import { default as fetch } from 'node-fetch';

import { errors, matchMaxSizeError } from './errors';

/**
 * process binary data and catch any specific errors
 */
export async function processBinary(data: fetch.Response){
    const headers = data.headers;

    try{
        // request binary data to check for max-size excess
        const buffer = await data.arrayBuffer();

        return { data: buffer, headers };
    } catch(error) {
        if (matchMaxSizeError(error)) {
            throw errors[413];
        } else {
            // inform about any unexpected error.
            // might be a good one to track by Sentry, for example
            console.debug(error);
            throw errors[500];
        }
    }
}

/**
 * process text data as json and handle specific errors
 */
export async function processJson(data: fetch.Response){
    const headers = data.headers;

    try{
        // First try to get the data as text to avoid potential JSON parsing issues
        const text = await data.text();
        
        console.log('Raw JSON text length:', text.length);
        
        // Then parse it as JSON
        try {
            const json = JSON.parse(text);
            return { data: json, headers };
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw parseError;
        }
    } catch(error) {
        if (matchMaxSizeError(error)) {
            throw errors[413];
        } else if (error instanceof SyntaxError) {
            // Handle JSON syntax errors specifically
            throw errors[415];
        } else {
            // inform about any unexpected error.
            // might be a good one to track by Sentry, for example
            console.debug(error);
            throw errors[500];
        }
    }
}

/**
 * process text data as text
 */
export async function processText(data: fetch.Response){
    const headers = data.headers;

    try{
        const text = await data.text();

        return { data: text, headers };
    } catch(error) {
        // inform about any unexpected error.
        console.debug(error);
        throw errors[500];
    }
}