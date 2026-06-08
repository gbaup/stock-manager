// app/api/exchange-rate/route.ts
import { NextResponse } from "next/server";
import axios from "axios";

export async function GET() {
    try {
        // Paso 1: último cierre
        const { data: xmlCierre } = await axios.post(
            "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsultimocierre",
            `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="ultimocierre">
  <soapenv:Header/>
  <soapenv:Body>
    <cot:wsbcuultimocierre.Execute>
      <cot:Entrada><cot:Grupo>2</cot:Grupo></cot:Entrada>
    </cot:wsbcuultimocierre.Execute>
  </soapenv:Body>
</soapenv:Envelope>`,
            { headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' } }
        );

        const fecha = xmlCierre.match(/<Fecha>(.*?)<\/Fecha>/)?.[1];
        if (!fecha) throw new Error("No se pudo obtener la fecha de cierre");

        // Paso 2: cotización del dólar
        const { data: xmlCotiz } = await axios.post(
            "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones",
            `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">
  <soapenv:Header/>
  <soapenv:Body>
    <cot:wsbcucotizaciones.Execute>
      <cot:Entrada>
        <cot:Moneda><cot:item>2225</cot:item></cot:Moneda>
        <cot:FechaDesde>${fecha}</cot:FechaDesde>
        <cot:FechaHasta>${fecha}</cot:FechaHasta>
        <cot:Grupo>2</cot:Grupo>
      </cot:Entrada>
    </cot:wsbcucotizaciones.Execute>
  </soapenv:Body>
</soapenv:Envelope>`,
            { headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' } }
        );

        return NextResponse.json({
            fecha,
            compra: parseFloat(xmlCotiz.match(/<Compra>(.*?)<\/Compra>/)?.[1] ?? "0"),
            venta: parseFloat(xmlCotiz.match(/<Venta>(.*?)<\/Venta>/)?.[1] ?? "0"),
        });
    } catch (error) {
        return NextResponse.json(
            { error: "No se pudo obtener la cotización" },
            { status: 500 }
        );
    }
}