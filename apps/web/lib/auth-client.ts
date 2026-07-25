"use client";

import { createAuthClient } from "better-auth/react";
import { hackkitClient } from "@hackkit/auth-better-auth/client";

export const authClient = createAuthClient({ plugins: [hackkitClient()] });
