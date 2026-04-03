import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";

export async function POST() {
  // This only works in local development.
  // In production (Vercel), scoring is handled by the cron job.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { message: "Scoring runs automatically via cron in production." },
      { status: 200 }
    );
  }

  // process.cwd() is web/ — step up to project root for Python + jobs
  const projectRoot = path.resolve(process.cwd(), "..");
  const venvPython  = path.join(projectRoot, ".venv", "bin", "python");
  const pythonPath  = require("fs").existsSync(venvPython) ? venvPython : "python3";
  const scriptPath  = path.join(projectRoot, "jobs", "run_inference.py");

  return new Promise<Response>((resolve) => {
    execFile(pythonPath, [scriptPath], { cwd: path.join(projectRoot, "jobs") }, (error, stdout, stderr) => {
      if (error) {
        console.error("Inference error:", stderr);
        resolve(NextResponse.json({ error: stderr }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ message: stdout.trim() }, { status: 200 }));
      }
    });
  });
}
