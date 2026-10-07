export interface MockApiRequest {
    method: string;
    pathname: string;
    searchParams: URLSearchParams;
    /** The request body, already read; empty for a request without one. */
    text: string;
    /** Needed only by `/api/reports`: the package's own renderer, from the build. */
    formatMarkdownDocument?: (markdown: string, options?: { title?: string }) => string;
}

export interface MockApiResponse {
    status: number;
    contentType: string;
    body: string;
}

export const mockApi: {
    /** `null` for a path the mock API does not own. */
    handle(request: MockApiRequest): Promise<MockApiResponse | null>;
    PEOPLE_COUNT: number;
};
