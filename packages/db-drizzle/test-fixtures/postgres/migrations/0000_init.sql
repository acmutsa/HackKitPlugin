CREATE TABLE "sample_record" (
	"id" text PRIMARY KEY NOT NULL,
	"active" boolean NOT NULL,
	"score" double precision NOT NULL,
	"metadata" jsonb NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
