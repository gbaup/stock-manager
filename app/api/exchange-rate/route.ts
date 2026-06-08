import { NextResponse } from "next/server";
import { fetchExchangeRate, type ExchangeRateData } from "@/app/lib/exchange-rate";

export type ExchangeRateResponse = ExchangeRateData;

export async function GET() {
    try {
        const data = await fetchExchangeRate();
        return NextResponse.json<ExchangeRateResponse>(data);
    } catch {
        return NextResponse.json(
            { error: "No se pudo obtener la cotización" },
            { status: 500 }
        );
    }
}