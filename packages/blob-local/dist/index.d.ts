import { BlobStorageAdapterWithView } from '@hackkit/core';

type LocalBlobStorageOptions = {
    baseDir: string;
    filesRoutePrefix?: string;
    appBaseUrl?: string;
};
type LocalBlobStorage = BlobStorageAdapterWithView & {
    resolveAbsolutePath(key: string): string;
    ensureDirectoryForKey(key: string): Promise<string>;
};
declare function createLocalBlobStorage(options: LocalBlobStorageOptions): LocalBlobStorage;

export { type LocalBlobStorage, type LocalBlobStorageOptions, createLocalBlobStorage };
