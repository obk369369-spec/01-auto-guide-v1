// main.ts (레포지토리 루트에 저장)
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

Deno.serve((req) => serveDir(req, {
  fsRoot: "./public",
  urlRoot: "",
}));
