export class ApiFailure extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiFailure";
  }
}

export class UpstreamUnavailable extends ApiFailure {
  constructor(sourceName: string, options?: ErrorOptions) {
    super(
      503,
      "SOURCE_UNAVAILABLE",
      `${sourceName} is temporarily unavailable`,
      options,
    );
  }
}
