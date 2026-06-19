// Lightweight error carrying an HTTP status code for the error middleware.
export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
