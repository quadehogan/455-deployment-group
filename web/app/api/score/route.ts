import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";

export async function POST() {
  // Resolve paths: process.cwd() is web/, jobs/ is one level up
  const projectRoot = path.resolve(process.cwd(), "..");
  const jobsDir = path.join(projectRoot, "jobs");
  const scriptPath = path.join(jobsDir, "run_inference.py");

  if (!existsSync(scriptPath)) {
    return NextResponse.json(
      { error: `Script not found: ${scriptPath}` },
      { status: 500 },
    );
  }

  // Try venv python first, fall back to python3
  const venvPython = path.join(projectRoot, ".venv", "bin", "python");
  const pythonPath = existsSync(venvPython) ? venvPython : "python3";

  return new Promise<Response>((resolve) => {
    execFile(
      pythonPath,
      [scriptPath],
      { cwd: jobsDir, timeout: 120_000 },
      (error, stdout, stderr) => {
        if (error) {
          console.error("Scoring error:", stderr);
          resolve(
            NextResponse.json(
              { error: stderr || error.message },
              { status: 500 },
            ),
          );
        } else {
          resolve(
            NextResponse.json({ message: stdout.trim() }, { status: 200 }),
          );
        }
      },
    );
  });
}
