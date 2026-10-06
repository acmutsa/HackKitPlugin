import { BlobStorageAdapterWithView } from '@hackkit/core';

type S3BlobStorageOptions = {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    filesRoutePrefix?: string;
    presignExpiresInSeconds?: number;
};
type S3BlobStorage = BlobStorageAdapterWithView & {
    getPresignedViewUrl(key: string): Promise<string>;
};
declare function createS3BlobStorage(options: S3BlobStorageOptions): S3BlobStorage;

export { type S3BlobStorage, type S3BlobStorageOptions, createS3BlobStorage };
