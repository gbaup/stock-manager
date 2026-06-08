import axios from "axios";

export type ExchangeRateData = {
  fecha: string;
  compra: number;
  venta: number;
  nombre: string;
};

export async function fetchExchangeRate(): Promise<ExchangeRateData> {
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

  return {
    fecha,
    nombre: xmlCotiz.match(/<Nombre>(.*?)<\/Nombre>/)?.[1] ?? "",
    compra: parseFloat(xmlCotiz.match(/<TCC>(.*?)<\/TCC>/)?.[1] ?? "0"),
    venta: parseFloat(xmlCotiz.match(/<TCV>(.*?)<\/TCV>/)?.[1] ?? "0"),
  };
}

export async function getExchangeRate(): Promise<number> {
  const data = await fetchExchangeRate();
  return data.compra;
}
