import { z } from "zod";

export const sendCallbackInputSchema = z
.object({
execution_id: z.string().min(1, "execution_id is required"),
status: z.enum(["completed", "error"]),
message: z.string().min(1, "message is required").max(500),
result_payload: z.record(z.any()).optional(),
error_code: z.string().max(100).nullable().optional()
})
.strict();

export type SendCallbackInput = z.infer<typeof sendCallbackInputSchema>;

export function validateSendCallbackInput(input: unknown) {
return sendCallbackInputSchema.safeParse(input);
}
