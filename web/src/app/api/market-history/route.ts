import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), "..", "daily_coffee_market.csv");
    if (!fs.existsSync(csvPath)) {
      return new NextResponse("CSV not found", { status: 404 });
    }
    const csvData = fs.readFileSync(csvPath, "utf-8");
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}