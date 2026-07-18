import { NextRequest } from "next/server";
import { proxy } from "./proxy";

export async function middleware(request: NextRequest) {
  return await proxy(request);
}

export { config } from "./proxy";
