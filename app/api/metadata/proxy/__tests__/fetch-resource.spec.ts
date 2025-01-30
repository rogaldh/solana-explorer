/**
 * @jest-environment node
 */
import fetch, { Headers } from 'node-fetch';

import { fetchResource } from '../feature';

jest.mock('node-fetch', () => {
    const originalFetch = jest.requireActual('node-fetch')
    const mockFn = jest.fn();

    Object.assign(mockFn, originalFetch);

    return mockFn
});

/**
 *  mock valid response
 */
function mockFetchOnce(data: any = {}, headers: Headers = new Headers()) {
    // @ts-expect-error fetch does not have mocked fn
    fetch.mockResolvedValueOnce({
        headers,
        json: async () => data
    });
}

function mockFetchbinaryOnce(data: any = {}, headers: Headers = new Headers()) {
    // @ts-expect-error fetch does not have mocked fn
    fetch.mockResolvedValueOnce({
        arrayBuffer: async () => Buffer.from(data),
        headers
    });
}

/**
 *  mock error during process
 */
function mockRejectOnce<T extends Error>(error: T) {
    // @ts-expect-error fetch does not have mocked fn
    fetch.mockRejectedValueOnce(error);
}

describe('fetchResource', () => {
    const uri = 'http://hello.world/data.json' ;
    const headers = new Headers({ 'Content-Type': 'application/json' });

    afterEach(() => {
        jest.clearAllMocks();
    })

    it('should be called with proper arguments', async () => {
        mockFetchOnce({}, new Headers({ 'Content-Type': 'application/json, charset=utf-8' }));

        const resource = await fetchResource(uri, headers, 100, 100);

        expect(fetch).toHaveBeenCalledWith(uri, expect.anything());
        expect(resource.data).toEqual({});
    })

    it('should throw exception for unsupported media', async () => {
        mockFetchOnce();

        expect(() => {
            return fetchResource(uri, headers, 100, 100);
        }).rejects.toThrowError('Unsupported Media Type');
    })

    it('should throw exception upon exceeded size', async () => {
        mockRejectOnce(new Error('FetchError: content size at https://path/to/resour.ce over limit: 100'));

        expect(() => {
            return fetchResource(uri, headers, 100, 100);
        }).rejects.toThrowError('Max Content Size Exceeded');
    })

    it('should handle AbortSignal', async () => {
        class TimeoutError extends Error {
            constructor() {
                super()
                this.name = 'TimeoutError'
            }
        }
        mockRejectOnce(new TimeoutError());

        expect(() => {
            return fetchResource(uri, headers, 100, 100);
        }).rejects.toThrowError('Gateway Timeout')
    })

    it('should handle size overflow', async () => {
        mockRejectOnce(new Error('file is over limit: 100'));

        expect(() => {
            return fetchResource(uri, headers, 100, 100);
        }).rejects.toThrowError('Max Content Size Exceeded')
    })

    it('should handle unexpected result', async () => {
        // @ts-expect-error fetch does not have mocked fn
        fetch.mockRejectedValueOnce({ data: "unexpected exception" });

        const fn = () => {
            return fetchResource(uri, headers, 100, 100);
        }

        try {
            await fn();
        } catch(e: any) {
            expect(e.message).toEqual('General Error')
            expect(e.status).toEqual(500)
        }
    })

    it('should handle malformed JSON response gracefully', async () => {
        // Mock fetch to return a response with invalid JSON
        // @ts-expect-error fetch does not have mocked fn
        fetch.mockResolvedValueOnce({
            headers: new Headers({ 'Content-Type': 'application/json' }),
            // Simulate malformed JSON by rejecting during json parsing
            json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0') }
        });

        await expect(fetchResource(uri, headers, 100, 100)).rejects.toThrowError('Unsupported Media Type');
    });
})
