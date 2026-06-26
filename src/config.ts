import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
PORT: z
.string()
.default("8080")
.transform((value) => Number(value))
.pipe(z.number().int().positive()),
LOVABLE_CALLBACK_URL: z.string().url(),
CALLBACK_TIMEOUT_MS: z
.string()
.default("10000")
.transform((value) => Number(value))
.pipe(z.number().int().positive()),
CALLBACK_SOURCE: z.string().default("miltonmail"),
MILTON_CALLBACK_SECRET: z.string().min(1)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
console.error("Invalid environment configuration:");
console.error(JSON.stringify(parsed.error.flatten(), null, 2));
process.exit(1);
}

export const config = parsed.data;
