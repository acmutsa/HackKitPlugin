import { Effect, ParseResult, Schema } from "effect";
import { ZodError } from "zod";
import { HackKitError } from "./errors";
import { boundaryError, type BoundaryError } from "./effect";

class ParserIssue extends ParseResult.Type {
	constructor(
		ast: Schema.Schema.Any["ast"],
		input: unknown,
		readonly cause: unknown,
	) {
		super(
			ast,
			input,
			cause instanceof Error ? cause.message : "Invalid input",
		);
	}
}

/** Keep the exported parser contract, including transformations and field error details. */
export function schemaFromParser<T>(parser: {
	parse(input: unknown): T;
}): Schema.Schema<T, unknown> {
	return Schema.declare<T, unknown, readonly []>([], {
		decode: () => (input, _options, ast) =>
			Effect.try({
				try: () => parser.parse(input),
				catch: (error) => new ParserIssue(ast, input, error),
			}),
		encode: () => (input) => Effect.succeed(input),
	});
}

export function decodeInput<T>(
	parser: { parse(input: unknown): T },
	input: unknown,
): Effect.Effect<T, BoundaryError> {
	return Schema.decodeUnknown(schemaFromParser(parser))(input).pipe(
		Effect.mapError((error) => {
			const issue = error.issue;
			if (issue instanceof ParserIssue)
				return issue.cause instanceof ZodError
					? HackKitError.fromZod(issue.cause)
					: boundaryError(issue.cause);
			return new HackKitError(
				"VALIDATION_ERROR",
				"Invalid HackKit input.",
				{ cause: error },
			);
		}),
	);
}
