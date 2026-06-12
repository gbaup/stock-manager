import axios from 'axios';
import { cacheTag, cacheLife } from 'next/cache';

export type ExchangeRateData = {
  fecha: string;
  compra: number;
  venta: number;
  nombre: string;
};

export type RateSource = 'live' | 'fallback';

export type RateResult = {
  value: number;
  source: RateSource;
  asOf: string; // YYYY-MM-DD
};

// Fallback rate, used only when the BCU fetch fails. Surfaced to the UI so
// users know the displayed conversion is an estimate, not the live rate.
export const FALLBACK_RATE = 40.5;

async function fetchFromBcu(): Promise<ExchangeRateData> {
  'use cache';
  cacheLife('hours');
  cacheTag('exchange-rate');

  const { data: xmlCierre } = await axios.post(
    'https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsultimocierre',
    `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="ultimocierre">
  <soapenv:Header/>
  <soapenv:Body>
    <cot:wsbcuultimocierre.Execute>
      <cot:Entrada><cot:Grupo>2</cot:Grupo></cot:Entrada>
    </cot:wsbcuultimocierre.Execute>
  </soapenv:Body>
</soapenv:Envelope>`,
    { headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' }, timeout: 8000 }
  );

  const fecha = xmlCierre.match(/<Fecha>(.*?)<\/Fecha>/)?.[1];
  if (!fecha) throw new Error('No se pudo obtener la fecha de cierre');

  const { data: xmlCotiz } = await axios.post(
    'https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones',
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
    { headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' }, timeout: 8000 }
  );

  const compra = parseFloat(xmlCotiz.match(/<TCC>(.*?)<\/TCC>/)?.[1] ?? '');
  if (!compra) throw new Error('No se pudo obtener la cotización del dólar');

  return {
    fecha,
    nombre: xmlCotiz.match(/<Nombre>(.*?)<\/Nombre>/)?.[1] ?? '',
    compra,
    venta: parseFloat(xmlCotiz.match(/<TCV>(.*?)<\/TCV>/)?.[1] ?? '0'),
  };
}

// BCU publishes once daily; cached for 1 hour across all renders and actions.
// Returns the raw BCU payload when available; throws if the call fails.
export async function fetchExchangeRate(): Promise<ExchangeRateData> {
  return fetchFromBcu();
}

// Resolves the rate to use right now. If the live source fails, returns the
// fallback so callers (purchases, sales, UI previews) never block on a flaky API.
export async function getRate(): Promise<RateResult> {
  try {
    const data = await fetchFromBcu();
    return { value: data.compra, source: 'live', asOf: data.fecha };
  } catch {
    return { value: FALLBACK_RATE, source: 'fallback', asOf: new Date().toISOString().slice(0, 10) };
  }
}

// Convenience wrapper used by callers that only need the numeric rate.
export async function getExchangeRate(): Promise<number> {
  return (await getRate()).value;
}
