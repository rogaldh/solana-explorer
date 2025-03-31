import { NextResponse } from 'next/server';
import { Headers } from 'node-fetch';

import { fetchResource, isJson, isText, StatusError } from './feature';
import { errors } from './feature/errors';
import { checkURLForPrivateIP, isHTTPProtocol } from './feature/ip';

type Params = { params: object }

const USER_AGENT = process.env.NEXT_PUBLIC_METADATA_USER_AGENT ?? 'Solana Explorer';
const MAX_SIZE = process.env.NEXT_PUBLIC_METADATA_MAX_CONTENT_SIZE
    ? Number(process.env.NEXT_PUBLIC_METADATA_MAX_CONTENT_SIZE)
    : 10_000_000; // Increased to 10MB to handle larger responses
const TIMEOUT = process.env.NEXT_PUBLIC_METADATA_TIMEOUT
    ? Number(process.env.NEXT_PUBLIC_METADATA_TIMEOUT)
    : 10_000; // 10s

console.log('Metadata proxy configuration:', { MAX_SIZE, TIMEOUT, USER_AGENT });

/**
 *  Respond with error in a JSON format
 */
function respondWithError(status: keyof typeof errors, message?: string) {
    return NextResponse.json({ error: message ?? errors[status].message }, { status });
}

export async function GET(
    request: Request,
    { params: _params }: Params,
) {
    const isProxyEnabled = process.env.NEXT_PUBLIC_METADATA_ENABLED === 'true';

    if (!isProxyEnabled) {
        return respondWithError(404);
    }

    let uriParam: string;
    try {
        const url = new URL(request.url);
        const queryParam = url.searchParams.get('uri');

        if (!queryParam) {
            throw new Error('Absent URI');
        }

        uriParam = decodeURIComponent(queryParam);

        const parsedUrl = new URL(uriParam);

        // check that uri has supported protocol despite of any other checks
        if (!isHTTPProtocol(parsedUrl)) {
            console.error('Unsupported protocol', parsedUrl.protocol);
            return respondWithError(400);
        }

        const isPrivate = await checkURLForPrivateIP(parsedUrl);
        if (isPrivate) {
            console.error('Private IP detected', parsedUrl.hostname);
            return respondWithError(403);
        }
    } catch (_error) {
        console.error(_error);
        return respondWithError(400);
    }

    const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': USER_AGENT
    });

    let data;
    let resourceHeaders: Headers;

    try {
        const response = await fetchResource(uriParam, headers, TIMEOUT, MAX_SIZE);

        console.log('Response details:', {
            contentLength: response.headers.get('content-length'),
            contentType: response.headers.get('content-type'),
            dataIsArrayBuffer: response.data instanceof ArrayBuffer,
            dataIsBuffer: Buffer.isBuffer(response.data),
            dataLength: typeof response.data === 'string' ? response.data.length : 'not string',
            dataType: typeof response.data,
            uriParam
        });

        data = response.data;
        resourceHeaders = response.headers;
    } catch (e) {
        const status = (e as StatusError)?.status;
        switch (status) {
            case 413:
            case 415:
            case 500:
            case 504: {
                return respondWithError(status);
            }
            default:
                return respondWithError(500);
        }
    }

    // preserve original cache-control headers
    const contentLength = resourceHeaders.get('content-length');
    const responseHeaders: Record<string, string> = {
        'Cache-Control': resourceHeaders.get('cache-control') ?? 'no-cache',
        'Content-Type': resourceHeaders.get('content-type') ?? 'application/json; charset=utf-8',
        Etag: resourceHeaders.get('etag') ?? 'no-etag',
    };

    // Only set Content-Length if it exists in the original response
    if (contentLength) {
        responseHeaders['Content-Length'] = contentLength;
    }

    // Validate that all required headers are present
    const hasMissingHeaders = Object.values(responseHeaders).some(value => value == null);
    if (hasMissingHeaders) {
        return respondWithError(400);
    }

    if (data instanceof ArrayBuffer) {
        // Convert ArrayBuffer to Buffer for proper handling
        const buffer = Buffer.from(data);
        console.log('Binary response:', {
            bufferLength: buffer.length,
            contentType: resourceHeaders.get('content-type')
        });

        return new NextResponse(buffer, {
            headers: responseHeaders,
        });
    } else if (isJson(resourceHeaders)) {
        // For JSON data, ensure it's properly serialized
        console.log('JSON response:', {
            dataLength: typeof data === 'string' ? data.length : JSON.stringify(data).length,
            dataType: typeof data
        });

        // If data is already a string and supposed to be JSON, pass it directly
        if (typeof data === 'string') {
            return new NextResponse(data, {
                headers: {
                    ...responseHeaders,
                    'Content-Type': 'application/json; charset=utf-8',
                },
            });
        }

        // Otherwise use NextResponse.json which will serialize for us
        return NextResponse.json(data, {
            headers: responseHeaders,
        });
    } else if (isText(resourceHeaders)) {
        // For text responses, ensure proper encoding and content type

        console.log('Text response:', {
            H: resourceHeaders.get('content-length'),
            dataLength: data.length,
            dataType: typeof data
        });
        // Calculate byte length correctly for UTF-8 encoding
        const textBytes = Buffer.from(data, 'utf-8');
        const byteLength = textBytes.length;

        return new NextResponse(data, {
            headers: {
                ...responseHeaders,
                // return the byte length of the text data
                'Content-Length': byteLength.toString(),
            },
        });
    } else {
        return respondWithError(415);
    }
}
