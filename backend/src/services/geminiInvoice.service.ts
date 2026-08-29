import { GoogleGenAI } from '@google/genai';
import { extractedBillSchema, ExtractedBillData } from '../validators/billExtraction.validator';

const SYSTEM_EXTRACTION_PROMPT = `
You are an expert Indian GST Purchase Invoice / Supplier Bill OCR Data Extractor.
Analyze the provided document/image of a supplier invoice and extract all structured data into JSON.

CRITICAL INSTRUCTIONS:
1. EXTRACT ONLY VISIBLE DATA. Never invent, hallucinate, or guess missing information.
2. If an invoice field is absent, return null.
3. Preserve line items exactly as shown on the bill. Do NOT merge distinct items.
4. All monetary and rate values MUST be pure numbers (e.g. 10670.40, 18, 9). Do NOT include currency symbols ("₹") or percent signs ("%").
5. Normalize all dates to "YYYY-MM-DD" format (e.g., "22-Jun-26" or "22/06/2026" becomes "2026-06-22"). If a date is unreadable or absent, return null.
6. Understand Indian GST structures:
   - If GST is 18% with CGST 9% and SGST 9%, set gstRate=18, cgstRate=9, sgstRate=9, igstRate=0.
   - For interstate purchases with IGST 18%, set gstRate=18, cgstRate=0, sgstRate=0, igstRate=18.
7. Return ONLY valid JSON adhering strictly to the JSON schema without free-form markdown or explanations.

JSON SCHEMA:
{
  "supplier": {
    "supplierName": "string or null",
    "supplierGSTIN": "string or null",
    "supplierAddress": "string or null",
    "supplierState": "string or null",
    "supplierStateCode": "string or null",
    "supplierPhone": "string or null"
  },
  "invoice": {
    "invoiceNumber": "string or null",
    "invoiceDate": "YYYY-MM-DD string or null",
    "poNumber": "string or null",
    "paymentTerms": "string or null",
    "deliveryNoteNo": "string or null",
    "deliveryNoteDate": "YYYY-MM-DD string or null",
    "ewayBillNo": "string or null",
    "placeOfSupply": "string or null",
    "irn": "string or null",
    "acknowledgementNumber": "string or null",
    "acknowledgementDate": "YYYY-MM-DD string or null"
  },
  "items": [
    {
      "itemName": "string",
      "hsnSac": "string or null",
      "quantity": number,
      "unit": "string or null",
      "unitPrice": number,
      "discountPercent": number,
      "discountAmount": number,
      "taxableAmount": number,
      "gstRate": number,
      "cgstRate": number,
      "cgstAmount": number,
      "sgstRate": number,
      "sgstAmount": number,
      "igstRate": number,
      "igstAmount": number,
      "lineTotal": number
    }
  ],
  "totals": {
    "taxableAmount": number,
    "totalDiscount": number,
    "totalCGST": number,
    "totalSGST": number,
    "totalIGST": number,
    "totalGST": number,
    "roundOff": number,
    "grandTotal": number
  }
}
`;

export interface ExtractionResult {
  extracted: ExtractedBillData;
  metadata: {
    fileName: string;
    fileType: string;
  };
  validation: {
    itemsCalculationMatch: boolean;
    totalsCalculationMatch: boolean;
    warnings: string[];
  };
}

export const extractInvoiceFromBuffer = async (
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractionResult> => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY environment variable is not configured on backend server.');
    (error as any).statusCode = 500;
    throw error;
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const ai = new GoogleGenAI({ apiKey });

  const base64Data = buffer.toString('base64');

  let responseText = '';
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
        SYSTEM_EXTRACTION_PROMPT,
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    responseText = response.text || '';
  } catch (err: any) {
    console.error('Gemini API call error:', err);
    const error = new Error(`Gemini AI service error: ${err.message || 'Extraction failed'}`);
    (error as any).statusCode = 502;
    throw error;
  }

  if (!responseText || !responseText.trim()) {
    const error = new Error('Empty response received from Gemini API.');
    (error as any).statusCode = 502;
    throw error;
  }

  // Clean markdown json fences if present
  let cleanJson = responseText.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  let rawParsed: any;
  try {
    rawParsed = JSON.parse(cleanJson);
  } catch (err) {
    const error = new Error('Failed to parse Gemini response as JSON.');
    (error as any).statusCode = 502;
    throw error;
  }

  // Validate extracted data schema using Zod
  const validationResult = extractedBillSchema.safeParse(rawParsed);
  if (!validationResult.success) {
    console.error('Gemini response Zod validation errors:', validationResult.error.format());
    const error = new Error('Gemini response did not match expected bill extraction schema.');
    (error as any).statusCode = 502;
    throw error;
  }

  const extracted = validationResult.data;

  // Run Diagnostic Mathematical Validation
  const warnings: string[] = [];
  let itemsCalculationMatch = true;

  extracted.items.forEach((item, index) => {
    const gross = item.quantity * item.unitPrice;
    const expectedTaxable = gross - item.discountAmount;

    // Check item taxable amount tolerance
    if (Math.abs(expectedTaxable - item.taxableAmount) > 1.0) {
      itemsCalculationMatch = false;
      warnings.push(
        `Item #${index + 1} ("${item.itemName}") taxable amount mismatch: calculated ${expectedTaxable.toFixed(
          2
        )}, extracted ${item.taxableAmount.toFixed(2)}`
      );
    }
  });

  const sumTaxable = extracted.items.reduce((acc, item) => acc + item.taxableAmount, 0);
  const expectedGrandTotal = extracted.totals.taxableAmount + extracted.totals.totalGST + extracted.totals.roundOff;
  let totalsCalculationMatch = true;

  if (Math.abs(sumTaxable - extracted.totals.taxableAmount) > 1.0) {
    totalsCalculationMatch = false;
    warnings.push(
      `Totals taxable amount mismatch: sum of items (${sumTaxable.toFixed(
        2
      )}) does not match total taxable (${extracted.totals.taxableAmount.toFixed(2)})`
    );
  }

  if (Math.abs(expectedGrandTotal - extracted.totals.grandTotal) > 1.0) {
    totalsCalculationMatch = false;
    warnings.push(
      `Grand total mismatch: calculated (${expectedGrandTotal.toFixed(
        2
      )}) does not match extracted grand total (${extracted.totals.grandTotal.toFixed(2)})`
    );
  }

  return {
    extracted,
    metadata: {
      fileName,
      fileType: mimeType,
    },
    validation: {
      itemsCalculationMatch,
      totalsCalculationMatch,
      warnings,
    },
  };
};
