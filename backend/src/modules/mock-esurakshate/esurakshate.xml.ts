import { XMLBuilder, XMLParser } from "fast-xml-parser";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: true,
  trimValues: true,
});

const xmlBuilder = new XMLBuilder({
  format: true,
  ignoreAttributes: false,
});

export function parseFactoryXml(xml: string): unknown {
  return xmlParser.parse(xml);
}

export function buildFactoryXml(payload: Record<string, unknown>): string {
  return xmlBuilder.build(payload);
}
