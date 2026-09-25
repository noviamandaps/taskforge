import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        ok: true,
        service: "taskforge-api",
        phase: "workspace-foundation",
    });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    });
}