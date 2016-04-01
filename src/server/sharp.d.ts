declare module "sharp" {
    interface Sharp {
        resize: (width: number, height: number) => Sharp;
        max: () => Sharp;
        toFormat: (format: string) => Sharp;
        toFile: (file: string) => Promise<ImageInfo>;
    }

    interface ImageInfo {
        format: string;
        size: number;
        width: number;
        height: number;
        channels: number;
    }

    var sharpFunction: (fileOrBuffer: string | Buffer) => Sharp;
    export = sharpFunction;
}
