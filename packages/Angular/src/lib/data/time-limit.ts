/**
 * A read that has not answered within its time limit.
 *
 * MJ's reads have no time limit of their own, so a request the server never answers leaves its caller
 * waiting for good: on the board, a spinner that only a browser refresh clears. Racing the read against
 * a timer turns that into a failure the caller can show with a Retry.
 */
export class TimeLimitExceeded extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeLimitExceeded';
    }
}

/**
 * Settles as `read` does, or rejects with {@link TimeLimitExceeded} carrying `message` once `ms` pass
 * first. The read itself keeps running; a caller that gives up on it must also ignore its reply.
 */
export function WithinTimeLimit<T>(read: Promise<T>, ms: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeLimitExceeded(message)), ms);
    });
    return Promise.race([read, limit]).finally(() => clearTimeout(timer));
}
