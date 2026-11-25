import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false
});

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getBiblionumber(record) {
  const fields = asArray(record.controlfield);

  // Chercher le biblionumber dans le champ 001 uniquement
  const field001 = fields.find(
    f => f["@_tag"] === "001"
  );

  if (field001 && field001["#text"]) {
    return String(field001["#text"]).trim();
  }

  return null;
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8"
    };

    const createJsonResponse = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: corsHeaders
      });

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (request.method !== "GET") {
      return createJsonResponse({ error: "Méthode non autorisée" }, 405);
    }

    const url = new URL(request.url);
    const isbn = url.searchParams.get("isbn");
    const issn = url.searchParams.get("issn");

    if ((!isbn && !issn) || (isbn && issn)) {
      return createJsonResponse({
        error: "Fournir un ISBN ou un ISSN"
      }, 400);
    }

    const identifier = (isbn || issn).trim();

    // Validation stricte des ISBN et ISSN
    const isbnRegex = /^97[89][0-9]{9}[\dXx]$/;
    const issnRegex = /^\d{4}-\d{3}[Xx0-9]$/;
    
    if (isbn && !isbnRegex.test(identifier)) {
      return createJsonResponse({ error: "ISBN invalide" }, 400);
    }
    
    if (issn && !issnRegex.test(identifier)) {
      return createJsonResponse({ error: "ISSN invalide" }, 400);
    }

    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit")) || 5, 1),
      20
    );

    try {
      const sruUrl = new URL(env.SRU_URL);

      sruUrl.searchParams.set("version", "1.1");
      sruUrl.searchParams.set("operation", "searchRetrieve");
      sruUrl.searchParams.set("query", identifier);
      sruUrl.searchParams.set("maximumRecords", limit);
      sruUrl.searchParams.set("recordSchema", "marcxml");

      const response = await fetch(sruUrl, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return createJsonResponse({
          error: "Erreur du serveur SRU"
        }, 502);
      }

      const xml = await response.text();
      const data = parser.parse(xml);

      const sru = data.searchRetrieveResponse;

      if (!sru) {
        return createJsonResponse({ error: "Réponse SRU invalide" }, 502);
      }

      const records = asArray(sru.records?.record);

      const notices = records
        .map(item => {
          const marc = item.recordData?.record;

          if (!marc) return null;

          const biblionumber = getBiblionumber(marc);

          if (!biblionumber) return null;

          return {
            biblionumber,
            opac_url:
              `${env.OPAC_URL}?biblionumber=${encodeURIComponent(biblionumber)}`
          };
        })
        .filter(Boolean);

      return createJsonResponse({
        success: true,
        identifier,
        count: notices.length,
        total: Number(sru.numberOfRecords || 0),
        notices
      });

    } catch (error) {
      // Distinguer les types d'erreurs
      if (error.name === "AbortError") {
        return createJsonResponse({
          success: false,
          error: "Timeout - Demande trop longue"
        }, 408);
      } else if (error instanceof TypeError) {
        return createJsonResponse({
          success: false,
          error: "Erreur réseau - Impossible de contacter le serveur SRU"
        }, 502);
      } else {
        return createJsonResponse({
          success: false,
          error: "Impossible d'interroger Koha"
        }, 502);
      }
    }
  }
};