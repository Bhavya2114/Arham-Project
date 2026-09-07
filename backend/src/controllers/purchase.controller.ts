import { Request, Response, NextFunction } from 'express';
import * as purchaseService from '../services/purchase.service';
import { extractInvoiceFromBuffer } from '../services/geminiInvoice.service';
import { successResponse } from '../utils/apiResponse';
import { Supplier } from '../models/Supplier';
import { Product } from '../models/Product';

export const getPurchases = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const purchases = await purchaseService.getPurchases();
    res.status(200).json(successResponse('Purchases retrieved successfully', purchases));
  } catch (error) {
    next(error);
  }
};

export const getPurchaseById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const purchase = await purchaseService.getPurchaseById(id);
    if (!purchase) {
      res.status(404).json({ success: false, message: 'Purchase record not found' });
      return;
    }
    res.status(200).json(successResponse('Purchase record retrieved successfully', purchase));
  } catch (error) {
    next(error);
  }
};

export const createPurchase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const createdBy = req.user!.id;
    const purchase = await purchaseService.createPurchase(req.body, createdBy);
    res.status(201).json(successResponse('Purchase record created successfully', purchase));
  } catch (error) {
    next(error);
  }
};

export const extractPurchaseBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('[BACKEND] Request reached /api/purchases/extract-bill route');
    const file = req.file;
    console.log('[BACKEND] Uploaded file details:', {
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
    });

    if (!file) {
      res.status(400).json({ success: false, message: 'Purchase bill file is required.' });
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      res.status(413).json({ success: false, message: 'Purchase bill must not exceed 10 MB.' });
      return;
    }

    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const fileNameLower = file.originalname ? file.originalname.toLowerCase() : '';
    const validExt = ['.pdf', '.jpg', '.jpeg', '.png'].some((ext) => fileNameLower.endsWith(ext));
    const validMime = !file.mimetype || allowedMimeTypes.includes(file.mimetype.toLowerCase());

    if (!validExt || !validMime) {
      res.status(400).json({
        success: false,
        message: 'Unsupported file type. Allowed formats: PDF, JPG, JPEG, PNG.',
      });
      return;
    }

    const extractionResult = await extractInvoiceFromBuffer(
      file.buffer,
      file.mimetype || 'application/octet-stream',
      file.originalname
    );

    const extracted = extractionResult.extracted;

    // 1. Supplier Matching Logic against existing database
    let matchedSupplier: any = null;
    if (extracted.supplier?.supplierName || extracted.supplier?.supplierGSTIN) {
      const allSuppliers = await Supplier.find({ isDeleted: { $ne: true } }).lean();
      const gstinToMatch = extracted.supplier.supplierGSTIN ? extracted.supplier.supplierGSTIN.trim().toLowerCase() : '';
      const nameToMatch = extracted.supplier.supplierName ? extracted.supplier.supplierName.trim().toLowerCase() : '';

      // Match 1: By GSTIN
      if (gstinToMatch) {
        const supByGst = allSuppliers.find(
          (s) => s.gstNumber && s.gstNumber.trim().toLowerCase() === gstinToMatch
        );
        if (supByGst) {
          matchedSupplier = {
            id: supByGst._id.toString(),
            name: supByGst.name,
            gstNumber: supByGst.gstNumber,
            matched: true,
            isNew: false,
          };
        }
      }

      // Match 2: By exact supplier name or companyName
      if (!matchedSupplier && nameToMatch) {
        const rawExtractedTrimmed = extracted.supplier.supplierName?.trim();
        const supByName = allSuppliers.find(
          (s) =>
            (s.name && s.name.trim() === rawExtractedTrimmed) ||
            (s.companyName && s.companyName.trim() === rawExtractedTrimmed)
        );
        if (supByName) {
          matchedSupplier = {
            id: supByName._id.toString(),
            name: supByName.name,
            gstNumber: supByName.gstNumber,
            matched: true,
            isNew: false,
          };
        }
      }

      // Match 3: By case-insensitive supplier name or companyName
      if (!matchedSupplier && nameToMatch) {
        const supByCaseName = allSuppliers.find(
          (s) =>
            (s.name && s.name.trim().toLowerCase() === nameToMatch) ||
            (s.companyName && s.companyName.trim().toLowerCase() === nameToMatch)
        );
        if (supByCaseName) {
          matchedSupplier = {
            id: supByCaseName._id.toString(),
            name: supByCaseName.name,
            gstNumber: supByCaseName.gstNumber,
            matched: true,
            isNew: false,
          };
        }
      }

      // Match 4: By normalized business name (handling "Pvt Ltd", "Private Limited", "Ltd", "LLP", "M/s", etc.)
      if (!matchedSupplier && nameToMatch) {
        const normalizeBizName = (str: string) => {
          return str
            .toLowerCase()
            .replace(/\b(pvt|private|ltd|limited|llp|inc|corp|corporation|co|company|enterprises|traders|m\/s|messrs)\b\.?/gi, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
        };

        const normExtracted = normalizeBizName(nameToMatch);
        if (normExtracted.length >= 3) {
          const supByNorm = allSuppliers.find((s) => {
            const normName = s.name ? normalizeBizName(s.name) : '';
            const normComp = s.companyName ? normalizeBizName(s.companyName) : '';
            return (
              (normName && (normName === normExtracted || (normName.length >= 5 && normExtracted.length >= 5 && (normName.includes(normExtracted) || normExtracted.includes(normName))))) ||
              (normComp && (normComp === normExtracted || (normComp.length >= 5 && normExtracted.length >= 5 && (normComp.includes(normExtracted) || normExtracted.includes(normComp)))))
            );
          });
          if (supByNorm) {
            matchedSupplier = {
              id: supByNorm._id.toString(),
              name: supByNorm.name,
              gstNumber: supByNorm.gstNumber,
              matched: true,
              isNew: false,
            };
          }
        }
      }
    }

    if (!matchedSupplier) {
      matchedSupplier = {
        matched: false,
        isNew: true,
        name: extracted.supplier?.supplierName || 'New Supplier',
        gstNumber: extracted.supplier?.supplierGSTIN || '',
        state: extracted.supplier?.supplierState || '',
        stateCode: extracted.supplier?.supplierStateCode || '',
        address: extracted.supplier?.supplierAddress || '',
        phone: extracted.supplier?.supplierPhone || '',
      };
    }

    // 2. Product Matching Logic per Extracted Item against existing database
    const allProducts = await Product.find({ isDeleted: { $ne: true } }).lean();
    const matchedItems = extracted.items.map((item) => {
      const nameToMatch = item.itemName ? item.itemName.trim().toLowerCase() : '';
      let matchedProduct: any = null;

      if (nameToMatch) {
        // Match 1: Exact product name
        let pMatch = allProducts.find((p) => p.name && p.name.trim() === item.itemName.trim());

        // Match 2: Case-insensitive product name
        if (!pMatch) {
          pMatch = allProducts.find((p) => p.name && p.name.trim().toLowerCase() === nameToMatch);
        }

        // Match 3: SKU match
        if (!pMatch) {
          pMatch = allProducts.find((p) => p.sku && p.sku.trim().toLowerCase() === nameToMatch);
        }

        // Match 4: Normalized name comparison (trim spaces / alphanumeric only)
        if (!pMatch) {
          const normalizedItem = nameToMatch.replace(/[^a-z0-9]/g, '');
          if (normalizedItem.length >= 3) {
            pMatch = allProducts.find((p) => {
              const normP = p.name ? p.name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
              return normP && (normP === normalizedItem || (normP.length >= 5 && normalizedItem.length >= 5 && (normP.includes(normalizedItem) || normalizedItem.includes(normP))));
            });
          }
        }

        if (pMatch) {
          matchedProduct = {
            id: pMatch._id.toString(),
            name: pMatch.name,
            sku: pMatch.sku,
            currentStock: pMatch.currentStock,
            costPrice: pMatch.costPrice,
            gstRate: pMatch.gstRate,
            matched: true,
            isNew: false,
          };
        }
      }

      if (!matchedProduct) {
        matchedProduct = {
          matched: false,
          isNew: true,
          name: item.itemName,
          unit: item.unit || 'Pcs',
          costPrice: item.unitPrice || 0,
          gstRate: item.gstRate !== undefined ? item.gstRate : 18,
          hsnCode: item.hsnSac || undefined,
        };
      }

      const lineGst = (item as any).taxAmount !== undefined && (item as any).taxAmount !== null
        ? Number((item as any).taxAmount)
        : ((item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0));

      return {
        extractedItemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit || 'Pcs',
        unitPrice: item.unitPrice,
        gstPercent: item.gstRate,
        taxAmount: lineGst,
        cgstAmount: item.cgstAmount,
        sgstAmount: item.sgstAmount,
        igstAmount: item.igstAmount,
        lineTotal: item.lineTotal,
        matchedProduct,
        matched: matchedProduct.matched === true,
        isNew: matchedProduct.isNew === true,
      };
    });

    const responsePayload = {
      ...extractionResult,
      matching: {
        supplier: matchedSupplier,
        items: matchedItems,
      },
    };

    res.status(200).json(successResponse('Purchase bill extracted successfully', responsePayload));
  } catch (error) {
    next(error);
  }
};
