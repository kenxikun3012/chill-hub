import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "chill-hub-session";
const isWeb = Platform.OS === "web";

/**
 * EXPO_PUBLIC_API_URL wins. In development on a phone, "localhost" would be the phone itself,
 * so the API is assumed to run on the same computer as the Expo dev server.
 */
function apiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured;
  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${!isWeb && devHost ? devHost : "localhost"}:3000/api/v1`;
}

const API_URL = apiUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Better Auth's error code, e.g. EMAIL_NOT_VERIFIED. */
    readonly code?: string,
    /** Validation details from our own endpoints. */
    readonly details?: string[],
  ) {
    super(message);
  }
}

/** The website uses an HttpOnly session cookie. The app keeps a bearer token in the device's secure storage. */
export const tokenStore = {
  get: () => (isWeb ? Promise.resolve(null) : SecureStore.getItemAsync(TOKEN_KEY)),
  set: (token: string) => (isWeb ? Promise.resolve() : SecureStore.setItemAsync(TOKEN_KEY, token)),
  clear: () => (isWeb ? Promise.resolve() : SecureStore.deleteItemAsync(TOKEN_KEY)),
};

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await tokenStore.get();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      // The app must not send cookies: the API checks the origin of any request that has them, and apps have no origin.
      credentials: isWeb ? "include" : "omit",
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach Chill Hub. Check your connection and try again.");
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    throw new ApiError(response.status, data?.message ?? "Something went wrong. Please try again.", data?.code, data?.details);
  }
  return data as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
