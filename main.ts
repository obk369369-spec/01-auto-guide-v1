// main.ts
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // 1) 워드 템플릿 다운로드용 API
  if (url.pathname === "/api/guide-template") {
    try {
      const file = await Deno.readFile("./public/guide-template.docx");
      return new Response(file, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition":
            "attachment; filename=\"WIC_자동화_안내서_템플릿.docx\"",
        },
      });
    } catch (e) {
      console.error(e);
      return new Response("template not found", { status: 500 });
    }
  }

  // 2) 나머지는 /public 아래 정적 파일 제공
  return serveDir(req, {
    fsRoot: "public",
    urlRoot: "",
    showDirListing: false,
  });
}

Deno.serve(handler);
